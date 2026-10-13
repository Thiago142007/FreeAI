import { BrowserWindow, session } from 'electron';
import { SessionStore } from '../browser-engine/session-store';
import { WEB_PROVIDER_CONFIGS } from '../browser-engine/providers/provider-configs';

const AUTH_COOKIE_MARKERS: Record<string, { domain: string; name: string }> = {
  deepseek: { domain: '.chat.deepseek.com', name: 'js_token' },
  gemini: { domain: '.google.com', name: 'SID' },
  chatgpt: { domain: '.chatgpt.com', name: '__Secure-next-auth.session-token' },
};

const LOGIN_URLS: Record<string, string> = {
  deepseek: 'https://chat.deepseek.com/sign_in',
  gemini: 'https://gemini.google.com',
  chatgpt: 'https://chatgpt.com/auth/login',
};

export function openLoginWindow(
  provider: string,
  sessionStore: SessionStore,
  onComplete: (success: boolean) => void
): BrowserWindow {
  const partition = sessionStore.getPartition(provider);
  const ses = session.fromPartition(partition);
  const genericConfig = WEB_PROVIDER_CONFIGS[provider];

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: `FreeAI — Conectar Conta (${provider.toUpperCase()})`,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(LOGIN_URLS[provider] || genericConfig?.chatUrl || 'https://chat.deepseek.com');

  const marker = AUTH_COOKIE_MARKERS[provider];

  const hasAuthCookie = async (): Promise<boolean> => {
    if (!marker) return false;
    try {
      const cookies = await ses.cookies.get({ domain: marker.domain, name: marker.name });
      return cookies.length > 0;
    } catch {
      return false;
    }
  };

  // Sessão é detectada pela UI real: composer presente e sem modal de login.
  // DeepSeek/Gemini/ChatGPT guardam a sessão em localStorage, não em cookie nomeado.
  const isAuthedPage = async (): Promise<boolean> => {
    if (win.isDestroyed()) return false;
    const url = win.webContents.getURL();
    if (url.includes('sign_in') || url.includes('/auth/')) return false;
    if (win.webContents.isLoading()) return false;

    if (genericConfig) {
      if (!url.startsWith(`https://${new URL(genericConfig.chatUrl).hostname}`)) return false;
      try {
        if (await win.webContents.executeJavaScript(genericConfig.loginBlockExpr)) return false;
        return !!(await win.webContents.executeJavaScript(genericConfig.readyExpr));
      } catch {
        return false;
      }
    }

    const urlOk =
      (provider === 'deepseek' && url.startsWith('https://chat.deepseek.com/')) ||
      (provider === 'gemini' && url.startsWith('https://gemini.google.com/app')) ||
      (provider === 'chatgpt' && url.startsWith('https://chatgpt.com/'));
    if (!urlOk) return false;
    try {
      const hasComposer = await win.webContents.executeJavaScript(`(() => {
        const el = document.querySelector('textarea') ||
                   document.querySelector('#prompt-textarea') ||
                   document.querySelector('.ql-editor[contenteditable="true"]') ||
                   document.querySelector('[data-testid="composer-input"]');
        return !!el && !document.querySelector('input[type="password"]');
      })()`);
      return !!hasComposer;
    } catch {
      return false;
    }
  };

  let finished = false;
  let uiAuthDetected = false;
  let stableHits = 0;

  const finish = async () => {
    if (finished) return;
    finished = true;
    const authenticated = uiAuthDetected || (await hasAuthCookie());
    sessionStore.setSessionMeta(provider, { isAuthenticated: authenticated });
    onComplete(authenticated);
  };

  // Vigia a sessão; quando o login se completa, a janelinha se encerra sozinha
  // e o provedor passa a operar apenas em background.
  // Exige leituras consecutivas: durante o redirect do OAuth a página fica sem o
  // bloqueio de login por instantes, e fechar cedo derruba a sessão antes de gravar.
  const REQUIRED_STABLE_HITS = 3;
  const poll = setInterval(async () => {
    if (win.isDestroyed()) {
      clearInterval(poll);
      return;
    }
    if (await isAuthedPage()) {
      stableHits++;
      if (stableHits < REQUIRED_STABLE_HITS) return;
      uiAuthDetected = true;
      clearInterval(poll);
      win.close();
    } else {
      stableHits = 0;
    }
  }, 1500);

  win.on('close', () => {
    clearInterval(poll);
    finish();
  });

  return win;
}
