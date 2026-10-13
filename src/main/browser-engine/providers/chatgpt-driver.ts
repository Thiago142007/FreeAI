import { WebContents } from 'electron';
import { DriverCallbacks } from './deepseek-driver';

export class ChatGPTDriver {
  private webContents: WebContents | null = null;
  private isGenerating: boolean = false;

  constructor(webContents?: WebContents) {
    if (webContents) this.webContents = webContents;
  }

  public setWebContents(webContents: WebContents) {
    this.webContents = webContents;
  }

  public async waitForReady(maxWaitMs = 15000): Promise<boolean> {
    if (!this.webContents) return false;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        if (!this.webContents.isLoading()) {
          const hasInput = await this.webContents.executeJavaScript(`
            !!(document.querySelector('#prompt-textarea') ||
               document.querySelector('#mobile-composer-prompt') ||
               document.querySelector('textarea') ||
               document.querySelector('[contenteditable="true"]'))
          `);
          if (hasInput) return true;
        }
      } catch {
        // Ignora erros temporários enquanto o DOM carrega
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  public async injectAndSend(prompt: string, callbacks: DriverCallbacks): Promise<string> {
    if (!this.webContents) {
      throw new Error(
        'ChatGPT: sessão headless não inicializada. Verifique sua conexão com a internet.'
      );
    }

    this.isGenerating = true;

    try {
      callbacks.onStatusChange?.('Aguardando carregamento da interface do ChatGPT...');
      const ready = await this.waitForReady(15000);
      if (!ready) {
        this.isGenerating = false;
        throw new Error(
          'ChatGPT: a página chatgpt.com não exibiu a caixa de chat em 15s. ' +
          'Provavelmente exige login ou exibiu verificação — abra a aba Browser (Ctrl+Shift+B) e conecte a conta.'
        );
      }

      callbacks.onStatusChange?.('Injetando solicitação no ChatGPT...');

      // 1. Injeta o prompt na caixa de texto do ChatGPT
      const injectionScript = `
        (() => {
          const el = document.querySelector('#prompt-textarea') ||
                     document.querySelector('#mobile-composer-prompt') ||
                     document.querySelector('textarea') ||
                     document.querySelector('[contenteditable="true"]');
          if (!el) return false;

          el.focus();
          if (el.tagName === 'TEXTAREA') {
            el.value = ${JSON.stringify(prompt)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, ${JSON.stringify(prompt)});
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }

          setTimeout(() => {
            const btn = document.querySelector('button[data-testid="send-button"]') ||
                        document.querySelector('#composer-submit-button') ||
                        document.querySelector('button[aria-label*="Send"]') ||
                        document.querySelector('button[aria-label*="Enviar"]') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send') || b.querySelector('svg'));
            if (btn) btn.click();
          }, 250);

          return true;
        })()
      `;

      const injected = await this.webContents.executeJavaScript(injectionScript);
      if (!injected) {
        this.isGenerating = false;
        throw new Error(
          'ChatGPT: não encontrei a caixa de texto do chat. O site pode ter mudado de layout ou exigido login (aba Browser, Ctrl+Shift+B).'
        );
      }

      callbacks.onStatusChange?.('Recebendo resposta em streaming do ChatGPT...');

      // 2. Monitoramento de resposta em streaming
      let lastText = '';
      const startTime = Date.now();
      const maxTimeoutMs = 120000;

      while (this.isGenerating && Date.now() - startTime < maxTimeoutMs) {
        await new Promise((r) => setTimeout(r, 300));

        const extractionScript = `
          (() => {
            // 1. Tenta seletores diretos de markdown / assistente
            const msgs = document.querySelectorAll('[data-message-author-role="assistant"], .markdown');
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              const text = last ? last.innerText.trim() : '';
              const isBusy = !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]');
              if (text) return { text, isBusy };
            }

            // 2. TreeWalker para capturar após "ChatGPT said:"
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let foundChatGPT = false;
            let responseText = '';
            let node;
            while (node = walker.nextNode()) {
              const val = node.nodeValue ? node.nodeValue.trim() : '';
              if (val === 'ChatGPT said:') {
                foundChatGPT = true;
                continue;
              }
              if (foundChatGPT) {
                if (val.includes('ChatGPT is AI') || val.includes('Chat with ChatGPT')) {
                  break;
                }
                if (val) responseText += (responseText ? '\\n' : '') + val;
              }
            }

            const isBusy = !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]');
            return { text: responseText, isBusy };
          })()
        `;

        try {
          const res = await this.webContents.executeJavaScript(extractionScript);
          if (res) {
            if (res.text && res.text !== lastText) {
              const delta = res.text.substring(lastText.length);
              lastText = res.text;
              callbacks.onToken(delta, lastText);
            }

            // Se terminou de gerar e já passou pelo menos 2.5s
            if (!res.isBusy && lastText.length > 0 && Date.now() - startTime > 2500) {
              break;
            }
          }
        } catch {
          break;
        }
      }

      this.isGenerating = false;
      if (!lastText) {
        throw new Error(
          'ChatGPT: nenhuma resposta foi capturada em 120s. A página pode ter travado, exigido login ou exibido verificação (aba Browser, Ctrl+Shift+B).'
        );
      }
      return lastText;
    } catch (err: any) {
      console.error('ChatGPT Driver Error:', err);
      this.isGenerating = false;
      throw err;
    }
  }

  public stop() {
    this.isGenerating = false;
  }
}
