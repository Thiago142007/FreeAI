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

// Mensagem HTML exibida enquanto a página carrega, substituindo a tela em branco
function buildLoadingHTML(providerName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; gap: 16px;
  }
  .spinner {
    width: 36px; height: 36px; border: 3px solid #333;
    border-top-color: #7c3aed; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 14px; color: #888; }
  .hint { font-size: 12px; color: #555; }
</style></head>
<body>
  <div class="spinner"></div>
  <p>Carregando ${providerName}…</p>
  <p class="hint">Aguarde. Se travar, pressione F5 ou Ctrl+R para recarregar.</p>
</body></html>`;
}

// Mensagem HTML exibida quando a página falha ao carregar
function buildErrorHTML(providerName: string, url: string, errorDesc: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; gap: 12px; padding: 32px; text-align: center;
  }
  h2 { font-size: 16px; color: #ef4444; }
  p { font-size: 13px; color: #888; }
  .code { font-size: 11px; color: #555; font-family: monospace; margin-top: 4px; }
  button {
    margin-top: 12px; padding: 8px 20px; background: #7c3aed; color: #fff;
    border: none; border-radius: 6px; font-size: 13px; cursor: pointer;
  }
  button:hover { background: #6d28d9; }
</style></head>
<body>
  <h2>Falha ao carregar a página</h2>
  <p>${providerName} não respondeu. Verifique sua conexão com a internet.</p>
  <p class="code">${errorDesc}</p>
  <button onclick="location.reload()">Tentar Novamente</button>
  <p style="font-size:11px;color:#444;margin-top:8px;">Você também pode pressionar F5 ou Ctrl+R para recarregar.</p>
</body></html>`;
}

export function openLoginWindow(
  provider: string,
  sessionStore: SessionStore,
  onComplete: (success: boolean) => void
): BrowserWindow {
  const partition = sessionStore.getPartition(provider);
  const ses = session.fromPartition(partition);
  const genericConfig = WEB_PROVIDER_CONFIGS[provider];
  const providerDisplayName = genericConfig?.name ?? provider.toUpperCase();
  const targetUrl = LOGIN_URLS[provider] || genericConfig?.chatUrl || 'https://chat.deepseek.com';

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: `FreeAI — Conectar Conta (${providerDisplayName})`,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // ── Exibe tela de carregamento enquanto a página real não chega ──────────────
  win.webContents.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(buildLoadingHTML(providerDisplayName))
  );

  // Carrega a URL real logo em seguida
  win.webContents.loadURL(targetUrl);

  // ── F5 e Ctrl+R / Cmd+R: recarregar a página na janela de login ─────────────
  win.webContents.on('before-input-event', (_event, input) => {
    if (win.isDestroyed()) return;

    const isReload =
      input.key === 'F5' ||
      (input.key === 'r' && (input.control || input.meta));

    if (isReload && input.type === 'keyDown') {
      // Exibe tela de carregamento antes do reload para evitar tela em branco
      win.webContents
        .loadURL(
          'data:text/html;charset=utf-8,' + encodeURIComponent(buildLoadingHTML(providerDisplayName))
        )
        .then(() => {
          if (!win.isDestroyed()) win.webContents.loadURL(targetUrl);
        })
        .catch(() => {});
    }
  });

  // ── Retry automático quando a página falha ao carregar ──────────────────────
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (win.isDestroyed()) return;
    // Ignora erros de cancelamento que acontecem quando substituímos uma carga
    // em andamento (ERR_ABORTED = -3)
    if (errorCode === -3) return;

    console.warn(
      `[login-window] Falha ao carregar ${validatedURL}: ${errorCode} ${errorDescription}`
    );

    // Exibe página de erro amigável com botão para tentar novamente
    win.webContents
      .loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(buildErrorHTML(providerDisplayName, validatedURL, `${errorCode}: ${errorDescription}`))
      )
      .catch(() => {});
  });

  // ── Reexibe tela de carregamento quando o usuário navega dentro da janela ───
  win.webContents.on('did-start-loading', () => {
    if (win.isDestroyed()) return;
    // Atualiza o título para sinalizar que está carregando
    win.setTitle(`FreeAI — Carregando ${providerDisplayName}…`);
  });

  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.setTitle(`FreeAI — Conectar Conta (${providerDisplayName})`);
  });

  // ────────────────────────────────────────────────────────────────────────────

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

    // Ignora páginas internas (tela de carregamento/erro injetadas acima)
    if (url.startsWith('data:')) return false;

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
    // Usa setSessionMeta diretamente para que o login explícito sempre grave,
    // seja true ou false (o usuário fechou a janela sem fazer login).
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
