import { WebContents } from 'electron';
import { DriverCallbacks } from './deepseek-driver';

export class GeminiDriver {
  private webContents: WebContents | null = null;
  private isGenerating: boolean = false;

  constructor(webContents?: WebContents) {
    if (webContents) this.webContents = webContents;
  }

  public setWebContents(webContents: WebContents) {
    this.webContents = webContents;
  }

  public async injectAndSend(prompt: string, callbacks: DriverCallbacks): Promise<string> {
    if (!this.webContents) {
      throw new Error(
        'Gemini: sessão headless não inicializada. Verifique sua conexão com a internet.'
      );
    }

    this.isGenerating = true;

    try {
      const injectionScript = `
        (() => {
          const editor = document.querySelector('.ql-editor[contenteditable="true"]');
          if (!editor) return false;

          editor.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, ${JSON.stringify(prompt)});

          setTimeout(() => {
            const sendBtn = document.querySelector('button[aria-label*="Send"], button[mat-icon="arrow_upward"]');
            if (sendBtn) sendBtn.click();
          }, 200);
          return true;
        })()
      `;

      const injected = await this.webContents.executeJavaScript(injectionScript);
      if (!injected) {
        this.isGenerating = false;
        throw new Error(
          'Gemini: a caixa de chat do gemini.google.com não está disponível — provavelmente exige login. ' +
          'Abra a aba Browser (Ctrl+Shift+B) e clique em Conectar Conta no Google Gemini.'
        );
      }

      let lastText = '';
      const startTime = Date.now();

      while (this.isGenerating && Date.now() - startTime < 90000) {
        await new Promise((r) => setTimeout(r, 300));
        const checkScript = `
          (() => {
            const responses = document.querySelectorAll('model-response');
            const last = responses.length > 0 ? responses[responses.length - 1] : null;
            const content = last ? (last.querySelector('message-content')?.innerText || '') : '';
            const thoughts = last ? (last.querySelector('model-thoughts')?.innerText || '') : '';
            const isBusy = !!document.querySelector('mat-icon[fonticon="stop"]');
            return { text: content, thinking: thoughts, isGenerating: isBusy };
          })()
        `;

        try {
          const res = await this.webContents.executeJavaScript(checkScript);
          if (res) {
            if (res.thinking) callbacks.onThinking(res.thinking);
            if (res.text && res.text !== lastText) {
              const delta = res.text.substring(lastText.length);
              lastText = res.text;
              callbacks.onToken(delta, lastText);
            }
            if (!res.isGenerating && lastText.length > 0 && Date.now() - startTime > 2500) {
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
          'Gemini: nenhuma resposta foi capturada em 90s. A página pode exigir login ou ter travado (aba Browser, Ctrl+Shift+B).'
        );
      }
      return lastText;
    } catch (err: any) {
      console.error('Gemini Driver Error:', err);
      this.isGenerating = false;
      throw err;
    }
  }

  public stop() {
    this.isGenerating = false;
  }
}
