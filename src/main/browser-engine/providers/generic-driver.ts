import { WebContents } from 'electron';
import { DriverCallbacks } from './deepseek-driver';
import { WebProviderConfig } from './provider-configs';

export interface GenericSendOptions {
  modelId?: string;
  capabilityId?: string;
}

const LOGIN_HINT = (name: string) =>
  `${name}: não há sessão ativa — abra a aba Browser (Ctrl+Shift+B), clique em Conectar Conta e faça login; depois reenvie a mensagem.`;

export class GenericDriver {
  private webContents: WebContents | null = null;
  private isGenerating = false;
  private lastUrl = '';

  constructor(private config: WebProviderConfig) {}

  public setWebContents(webContents: WebContents) {
    this.webContents = webContents;
  }

  private async eval<T>(expr: string): Promise<T | null> {
    if (!this.webContents || this.webContents.isDestroyed()) return null;
    try {
      return (await this.webContents.executeJavaScript(expr)) as T;
    } catch {
      return null;
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async waitForReady(maxWaitMs = 20000): Promise<'ready' | 'auth' | 'timeout'> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (this.webContents?.isLoading()) {
        await this.sleep(400);
        continue;
      }
      if (await this.eval<boolean>(this.config.loginBlockExpr)) return 'auth';
      if (await this.eval<boolean>(this.config.readyExpr)) return 'ready';
      await this.sleep(400);
    }
    if (await this.eval<boolean>(this.config.loginBlockExpr)) return 'auth';
    return 'timeout';
  }

  private async applyCapability(capabilityId?: string) {
    if (!capabilityId || !this.webContents) return;
    const cap = this.config.capabilities?.find((c) => c.id === capabilityId);
    if (!cap || !cap.route) return;
    if (this.lastUrl !== cap.route) {
      this.lastUrl = cap.route;
      this.webContents.loadURL(cap.route, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
      await this.sleep(3000);
    }
  }

  private async applyModel(modelId?: string) {
    const { modelPicker, models } = this.config;
    if (!modelId || !modelPicker || !models || !this.webContents) return;
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    const triggerOk = await this.eval<boolean>(
      `(() => { const t = document.querySelector(${JSON.stringify(modelPicker.triggerSel)}); if (!t) return false; t.click(); return true; })()`
    );
    if (!triggerOk) return;
    await this.sleep(600);

    await this.eval<boolean>(
      `(() => {
        const label = ${JSON.stringify(model.label.toLowerCase())};
        const items = [...document.querySelectorAll(${JSON.stringify(modelPicker.itemSel)})]
          .filter(e => e.offsetParent !== null && (e.textContent || '').toLowerCase().includes(label));
        if (!items.length) return false;
        items[0].click(); return true;
      })()`
    );
    await this.sleep(400);
  }

  public async injectAndSend(prompt: string, callbacks: DriverCallbacks, opts: GenericSendOptions = {}): Promise<string> {
    if (!this.webContents) {
      throw new Error(`${this.config.name}: sessão headless não inicializada. Verifique sua conexão com a internet.`);
    }

    this.isGenerating = true;
    try {
      callbacks.onStatusChange?.(`Conectando ao ${this.config.name}...`);
      await this.applyCapability(opts.capabilityId);
      const state = await this.waitForReady();
      if (state === 'auth') {
        this.isGenerating = false;
        throw new Error(LOGIN_HINT(this.config.name));
      }
      if (state === 'timeout') {
        this.isGenerating = false;
        throw new Error(
          `${this.config.name}: a interface de chat de ${this.config.chatUrl} não apareceu em 20s ` +
          (this.config.experimental ? '(provedor experimental — os seletores podem precisar de ajuste).' : '— verifique login/CAPTCHA na aba Browser (Ctrl+Shift+B).')
        );
      }

      if (opts.modelId) await this.applyModel(opts.modelId);

      callbacks.onStatusChange?.(`Enviando para ${this.config.name}...`);
      const editorKind = this.config.editorKind;
      const editorSel = this.config.editorSel;
      const injected = await this.eval<boolean>(`(() => {
        const sel = ${JSON.stringify(editorSel)};
        let els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null);
        let el = els[els.length - 1];
        if (!el) return false;
        if (el.tagName === 'TEXTAREA' || el.isContentEditable !== true) {
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(prompt)}); else el.value = ${JSON.stringify(prompt)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (el.isContentEditable) {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, ${JSON.stringify(prompt)});
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      })()`);
      if (!injected) {
        this.isGenerating = false;
        throw new Error(`${this.config.name}: caixa de texto do chat não encontrada (layout pode ter mudado).`);
      }

      await this.sleep(400);
      const sendExpr = this.config.sendExpr
        ? this.config.sendExpr
        : `(() => { const b = [...document.querySelectorAll(${JSON.stringify(this.config.sendSel || 'button[type=submit]')})].filter(e => e.offsetParent !== null).pop(); if (b) { b.click(); return true; } return false; })()`;
      const sent = await this.eval<boolean>(sendExpr);
      if (!sent) {
        await this.eval<boolean>(`(() => { const el = document.querySelector(${JSON.stringify(editorSel)}); if (!el) return false; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })); return true; })()`);
      }

      let lastText = '';
      let lastThinking = '';
      let stablePolls = 0;
      const startTime = Date.now();
      const maxTimeoutMs = 180000;
      let sawGenerating = false;

      while (this.isGenerating && Date.now() - startTime < maxTimeoutMs) {
        await this.sleep(500);

        const errScan = (await this.eval<string>(this.config.errorScanExpr)) || '';
        if (errScan && this.config.usageLimitRe && new RegExp(this.config.usageLimitRe, 'i').test(errScan)) {
          this.isGenerating = false;
          throw new Error(`LIMITE_ATINGIDO ${this.config.name}: ${errScan.split('\n')[0].slice(0, 200)}`);
        }

        const res = await this.eval<{ text: string; thinking: string }>(this.config.readExpr);
        if (res) {
          if (res.thinking && res.thinking !== lastThinking) {
            lastThinking = res.thinking;
            callbacks.onThinking(lastThinking);
          }
          if (res.text && res.text !== lastText) {
            const delta = res.text.length > lastText.length ? res.text.substring(lastText.length) : res.text;
            lastText = res.text;
            stablePolls = 0;
            callbacks.onToken(delta, lastText);
          } else if (lastText.length > 0) {
            stablePolls++;
          }
        }

        const generating = await this.eval<boolean>(this.config.generatingExpr);
        if (generating) sawGenerating = true;
        // O botão de stop pode sumir antes do último trecho chegar: exige texto estável,
        // senão a resposta volta truncada no meio.
        if (!generating && lastText.length > 0 && stablePolls >= 3 && Date.now() - startTime > 4000 && sawGenerating) break;
        // alguns sites nunca mostram botão de stop — saímos por texto estável
        if (!generating && lastText.length > 0 && stablePolls >= 3 && Date.now() - startTime > 12000 && !sawGenerating) break;
      }

      this.isGenerating = false;
      if (!lastText) {
        const finalErr = (await this.eval<string>(this.config.errorScanExpr)) || '';
        throw new Error(
          `${this.config.name}: nenhuma resposta capturada em 180s. ` +
          (finalErr ? `A página informou: "${finalErr.split('\n')[0].slice(0, 160)}"` : 'Verifique a aba Browser (Ctrl+Shift+B) para CAPTCHA/limites.')
        );
      }
      return lastText;
    } catch (err) {
      this.isGenerating = false;
      throw err;
    }
  }

  public stop() {
    this.isGenerating = false;
  }
}
