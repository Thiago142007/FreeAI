import { WebContents } from 'electron';

export interface DriverCallbacks {
  onToken: (token: string, fullText: string) => void;
  onThinking: (thinkingText: string) => void;
  onStatusChange?: (status: string) => void;
}

export class DeepSeekDriver {
  private webContents: WebContents | null = null;
  private isGenerating: boolean = false;

  constructor(webContents?: WebContents) {
    if (webContents) {
      this.webContents = webContents;
    }
  }

  public setWebContents(webContents: WebContents) {
    this.webContents = webContents;
  }

  public async waitForReady(maxWaitMs = 12000): Promise<{ isReady: boolean; isSignIn: boolean }> {
    if (!this.webContents) return { isReady: false, isSignIn: false };
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        if (!this.webContents.isLoading()) {
          const info = await this.webContents.executeJavaScript(`
            ({
              isSignIn: window.location.href.includes('sign_in') || !!document.querySelector('input[type="password"]'),
              hasInput: !!document.querySelector('textarea')
            })
          `);
          if (info.isSignIn) return { isReady: false, isSignIn: true };
          if (info.hasInput) return { isReady: true, isSignIn: false };
        }
      } catch {
        // Ignora erros transitórios
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return { isReady: false, isSignIn: false };
  }

  public async injectAndSend(prompt: string, callbacks: DriverCallbacks): Promise<string> {
    if (!this.webContents) {
      throw new Error(
        'DeepSeek: sessão headless não inicializada. Verifique sua conexão com a internet e tente novamente.'
      );
    }

    this.isGenerating = true;

    try {
      callbacks.onStatusChange?.('Conectando ao DeepSeek...');
      const check = await this.waitForReady(10000);

      if (check.isSignIn) {
        this.isGenerating = false;
        throw new Error(
          'DeepSeek ainda não tem sessão ativa — abra a aba Browser (Ctrl+Shift+B), clique em Conectar Conta e faça login; depois reenvie a mensagem.'
        );
      }

      if (!check.isReady) {
        this.isGenerating = false;
        throw new Error(
          'DeepSeek: a página chat.deepseek.com não carregou uma área de chat utilizável em 10s. ' +
          'Verifique a internet, ou faça login via aba Browser (Ctrl+Shift+B).'
        );
      }

      callbacks.onStatusChange?.('Injetando prompt no DeepSeek...');

      // 1. Injeta o prompt na caixa de texto do DeepSeek
      const injectionScript = `
        (() => {
          const ta = document.querySelector('textarea');
          if (!ta) return false;

          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(ta, ${JSON.stringify(prompt)});
          } else {
            ta.value = ${JSON.stringify(prompt)};
          }
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));

          setTimeout(() => {
            const sendBtn = document.querySelector('.ds-button--primary') || document.querySelector('button[type="submit"]');
            if (sendBtn) sendBtn.click();
          }, 200);
          return true;
        })()
      `;

      const injected = await this.webContents.executeJavaScript(injectionScript);
      if (!injected) {
        this.isGenerating = false;
        throw new Error(
          'DeepSeek: não encontrei a caixa de texto do chat na página. ' +
          'O site pode ter mudado de layout ou exigido verificação manual (aba Browser, Ctrl+Shift+B).'
        );
      }

      // 2. Monitora a resposta em streaming
      let lastText = '';
      let lastThinking = '';
      let stablePolls = 0;
      const startTime = Date.now();
      const maxTimeoutMs = 120000;

      while (this.isGenerating && Date.now() - startTime < maxTimeoutMs) {
        await new Promise((r) => setTimeout(r, 300));

        const stateScript = `
          (() => {
            const thinkingEl = document.querySelector('.ds-think-content');
            // A resposta pode vir dividida em vários blocos .ds-markdown: ler apenas o último
            // devolve um fragmento e a mensagem chega cortada ao usuário.
            const hosts = [...document.querySelectorAll('.ds-message')].reverse();
            const host = hosts.find((m) => m.querySelector('.ds-markdown')) || null;
            const blocks = host ? [...host.querySelectorAll('.ds-markdown')] : [];
            const stopBtn = document.querySelector('.ds-loading') || document.querySelector('.ds-button--primary svg rect');

            return {
              thinking: thinkingEl ? thinkingEl.innerText : '',
              text: blocks.map((e) => e.innerText).join('\\n'),
              isGenerating: !!stopBtn
            };
          })()
        `;

        try {
          const result = await this.webContents.executeJavaScript(stateScript);
          if (result) {
            if (result.thinking && result.thinking !== lastThinking) {
              lastThinking = result.thinking;
              callbacks.onThinking(lastThinking);
            }

            if (result.text && result.text !== lastText) {
              const delta = result.text.substring(lastText.length);
              lastText = result.text;
              stablePolls = 0;
              callbacks.onToken(delta, lastText);
            } else if (lastText.length > 0) {
              stablePolls++;
            }

            // O indicador de geração some antes do último trecho chegar e o DeepSeek faz
            // pausas reais de ~1s no meio da resposta: exige 8 polls (~2,4s) sem mudança.
            if (!result.isGenerating && lastText.length > 0 && Date.now() - startTime > 6000 && stablePolls >= 8) {
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
          'DeepSeek: aguardando 120s nenhuma resposta foi capturada. ' +
          'A conta pode ter atingido limite, ou a página exibiu CAPTCHA (verifique na aba Browser, Ctrl+Shift+B).'
        );
      }
      return lastText;
    } catch (err: any) {
      console.error('DeepSeek Driver Error:', err);
      this.isGenerating = false;
      throw err;
    }
  }

  public stop() {
    this.isGenerating = false;
  }
}
