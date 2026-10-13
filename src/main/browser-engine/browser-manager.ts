import { BrowserWindow, session } from 'electron';
import { SessionStore } from './session-store';
import { DeepSeekDriver, DriverCallbacks } from './providers/deepseek-driver';
import { GeminiDriver } from './providers/gemini-driver';
import { ChatGPTDriver } from './providers/chatgpt-driver';
import { GenericDriver, GenericSendOptions } from './providers/generic-driver';
import { WEB_PROVIDER_CONFIGS } from './providers/provider-configs';
import { openLoginWindow } from '../auth/login-window';

type ProviderId = 'deepseek' | 'gemini' | 'chatgpt' | string;

export class BrowserManager {
  private sessionStore: SessionStore;
  private deepseekDriver: DeepSeekDriver;
  private geminiDriver: GeminiDriver;
  private chatgptDriver: ChatGPTDriver;
  private genericDrivers: Map<string, GenericDriver> = new Map();
  private backgroundWindows: Map<string, BrowserWindow> = new Map();

  private static readonly PROVIDER_URLS: Record<string, string> = {
    deepseek: 'https://chat.deepseek.com',
    gemini: 'https://gemini.google.com',
    chatgpt: 'https://chatgpt.com',
    ...Object.fromEntries(Object.values(WEB_PROVIDER_CONFIGS).map((c) => [c.id, c.chatUrl])),
  };

  private static readonly USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  constructor() {
    this.sessionStore = new SessionStore();
    this.deepseekDriver = new DeepSeekDriver();
    this.geminiDriver = new GeminiDriver();
    this.chatgptDriver = new ChatGPTDriver();
    for (const [id, config] of Object.entries(WEB_PROVIDER_CONFIGS)) {
      this.genericDrivers.set(id, new GenericDriver(config));
    }
    // Nenhuma janela ou conexão web é disparada no boot do sistema
  }

  private isLegacy(provider: ProviderId): boolean {
    return provider === 'deepseek' || provider === 'gemini' || provider === 'chatgpt';
  }

  private async ensureBackgroundWindow(provider: ProviderId): Promise<BrowserWindow | null> {
    let win = this.backgroundWindows.get(provider);
    const targetUrl = BrowserManager.PROVIDER_URLS[provider] || BrowserManager.PROVIDER_URLS.chatgpt;

    if (!win || win.isDestroyed()) {
      try {
        const partition = this.sessionStore.getPartition(provider);
        const ses = session.fromPartition(partition);

        win = new BrowserWindow({
          show: false,
          width: 1280,
          height: 800,
          webPreferences: {
            session: ses,
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Impede abertura de popups
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

        win.loadURL(targetUrl, { userAgent: BrowserManager.USER_AGENT });

        if (provider === 'deepseek') {
          this.deepseekDriver.setWebContents(win.webContents);
        } else if (provider === 'gemini') {
          this.geminiDriver.setWebContents(win.webContents);
        } else if (provider === 'chatgpt') {
          this.chatgptDriver.setWebContents(win.webContents);
        } else {
          this.genericDrivers.get(provider)?.setWebContents(win.webContents);
        }

        this.backgroundWindows.set(provider, win);
      } catch (err) {
        console.error(`Erro ao criar janela em background para ${provider}:`, err);
        return null;
      }
    } else if (!win.webContents.getURL().startsWith(targetUrl)) {
      // Janela reutilizada está presa em tela de login ou URL antiga — recarrega
      // para absorver a sessão gravada pela janela de login
      win.loadURL(targetUrl, { userAgent: BrowserManager.USER_AGENT });
    }

    // Aguarda o término do carregamento da página (até 15 segundos)
    const startTime = Date.now();
    while (win.webContents.isLoading() && Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 250));
    }

    return win;
  }

  public resetProvider(provider: ProviderId) {
    const win = this.backgroundWindows.get(provider);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    this.backgroundWindows.delete(provider);
  }

  public async sendPrompt(
    provider: ProviderId,
    prompt: string,
    callbacks: DriverCallbacks,
    opts: GenericSendOptions = {}
  ): Promise<string> {
    const win = await this.ensureBackgroundWindow(provider);
    if (!win) {
      throw new Error(`Não foi possível abrir a sessão web de ${provider}. Verifique a internet.`);
    }

    switch (provider) {
      case 'gemini':
        return this.geminiDriver.injectAndSend(prompt, callbacks);
      case 'chatgpt':
        return this.chatgptDriver.injectAndSend(prompt, callbacks);
      case 'deepseek':
        return this.deepseekDriver.injectAndSend(prompt, callbacks);
      default: {
        const driver = this.genericDrivers.get(provider);
        if (!driver) throw new Error(`Provedor desconhecido: ${provider}`);
        return driver.injectAndSend(prompt, callbacks, opts);
      }
    }
  }

  public stop(provider: ProviderId) {
    if (provider === 'gemini') this.geminiDriver.stop();
    else if (provider === 'chatgpt') this.chatgptDriver.stop();
    else if (provider === 'deepseek') this.deepseekDriver.stop();
    else this.genericDrivers.get(provider)?.stop();
  }

  public markSession(provider: ProviderId, ok: boolean) {
    this.sessionStore.setSessionMeta(provider, { isAuthenticated: ok });
  }

  public getAllSessionStatus(): Record<string, boolean> {
    const providers = ['deepseek', 'gemini', 'chatgpt', ...Object.keys(WEB_PROVIDER_CONFIGS)];
    const out: Record<string, boolean> = {};
    for (const p of providers) {
      out[p] = this.sessionStore.getSessionMeta(p).isAuthenticated;
    }
    return out;
  }

  public openLogin(provider: ProviderId, onComplete: (ok: boolean) => void) {
    return openLoginWindow(provider, this.sessionStore, (success) => {
      // Descarta a janela em background envelhecida para a próxima mensagem
      // usar a sessão recém-autenticada
      this.resetProvider(provider);
      onComplete(success);
    });
  }

  public getSessionStore(): SessionStore {
    return this.sessionStore;
  }
}
