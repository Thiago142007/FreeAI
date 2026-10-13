// Configurações de provedores web baseadas nos providers validados do
// ZeroScript-Free (seletores DOM verificados nos sites em 2026-07/08).
// Cada expressão é JS avaliado via executeJavaScript na janela headless.

export interface ModelOption {
  id: string;
  label: string;
}

export interface CapabilityOption {
  id: string;
  label: string;
  route?: string;
  experimental?: boolean;
}

export interface WebProviderConfig {
  id: string;
  name: string;
  chatUrl: string;
  editorSel: string;
  editorKind: 'textarea' | 'contenteditable';
  sendSel?: string;
  sendExpr?: string;
  readyExpr: string;
  generatingExpr: string;
  readExpr: string;
  loginBlockExpr: string;
  errorScanExpr: string;
  usageLimitRe?: string;
  busyRe?: string;
  models?: ModelOption[];
  modelPicker?: { triggerSel: string; itemSel: string };
  capabilities?: CapabilityOption[];
  experimental?: boolean;
}

const ERR_SURF = `[role="alert"],[class*="toast"],[class*="error"],[class*="alert"],[class*="notification"]`;
const ERROR_SCAN = `(() => { const els = [...document.querySelectorAll('${ERR_SURF}')].filter(e => e.offsetParent !== null); return els.map(e => e.innerText).join('\\n').slice(0, 800); })()`;

const GENERIC_READ = `(() => {
  const sels = ['[class*="assistant-message"]', '[class*="message-assistant"]', '[class*="response"] .markdown', '.markdown'];
  for (const s of sels) {
    const els = [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null);
    const last = els[els.length - 1];
    if (last && (last.innerText || '').trim().length > 1) return { text: last.innerText.trim(), thinking: '' };
  }
  return { text: '', thinking: '' };
})()`;

export const KIMI_CONFIG: WebProviderConfig = {
  id: 'kimi',
  name: 'Kimi',
  chatUrl: 'https://www.kimi.com/',
  editorSel: '.chat-input-editor',
  editorKind: 'contenteditable',
  sendSel: '.send-button-container',
  readyExpr: `!!document.querySelector('.chat-input-editor')`,
  generatingExpr: `!!document.querySelector('.send-button-container.stop')`,
  readExpr: `(() => {
    const segs = [...document.querySelectorAll('.segment-assistant')].filter(e => e.offsetParent !== null);
    const last = segs[segs.length - 1];
    if (!last) return { text: '', thinking: '' };
    const body = last.querySelector('.segment-content-box .markdown-container') || last.querySelector('.segment-content-box') || last.querySelector('.segment-content');
    const th = last.querySelector('.thinking-container');
    return { text: body ? (body.innerText || '') : '', thinking: th ? th.innerText : '' };
  })()`,
  loginBlockExpr: `(() => {
    return [...document.querySelectorAll('.login-modal-mask, .modal-mask')].some(e => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 40;
    });
  })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'rate.?limit|too many requests|daily|limit reached|upgrade|subscribe|优先级|排队',
  busyRe: 'something went wrong|please try again|server is busy|系统繁忙',
  models: [
    { id: 'instant', label: 'Instantané' },
    { id: 'k2.6', label: 'K2.6' },
    { id: 'k3', label: 'K3' },
    { id: 'k3-swarm', label: 'K3 Swarm' },
  ],
  modelPicker: { triggerSel: '.current-model', itemSel: '.model-item' },
  capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }],
};

export const GLM_CONFIG: WebProviderConfig = {
  id: 'glm',
  name: 'GLM (Z.ai)',
  chatUrl: 'https://chat.z.ai/',
  editorSel: '#chat-input',
  editorKind: 'textarea',
  sendSel: '#send-message-button',
  readyExpr: `!!document.querySelector('#chat-input')`,
  generatingExpr: `(() => {
    const c = document.querySelector('.messageInputContainer') || document;
    return [...c.querySelectorAll('button')].some(b => b.id !== 'send-message-button'
      && /rounded-full/.test(b.className) && /bg-black|bg-white/.test(b.className)
      && !b.querySelector('svg'));
  })()`,
  readExpr: `(() => {
    const a = [...document.querySelectorAll('.chat-assistant')].filter(e => e.offsetParent !== null);
    const last = a[a.length - 1];
    if (!last) return { text: '', thinking: '' };
    const th = last.querySelector('.thinking-chain-container')
      || document.querySelector('.thinking-chain-container:last-of-type');
    const clone = last.cloneNode(true);
    clone.querySelectorAll('.thinking-chain-container').forEach(e => e.remove());
    return { text: (clone.innerText || '').trim(), thinking: th ? th.innerText : '' };
  })()`,
  loginBlockExpr: `(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return false; const r = d.getBoundingClientRect(); return r.width > 40 && getComputedStyle(d).display !== 'none'; })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'rate.?limit|too many requests|daily|usage limit|quota|upgrade|系统繁忙|请稍后再试',
  busyRe: 'something went wrong|try again later|server is busy|no response',
  capabilities: [
    { id: 'vision', label: 'Imagens (entrada)' },
    { id: 'image_gen', label: 'Gerar imagem', experimental: true },
  ],
};

export const ARENA_CONFIG: WebProviderConfig = {
  id: 'arena',
  name: 'Arena AI',
  chatUrl: 'https://arena.ai/text/direct',
  editorSel: 'form textarea',
  editorKind: 'textarea',
  sendExpr: `(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null
      && /send message|envoyer/i.test(b.getAttribute('aria-label') || ''));
    if (b) { b.click(); return true; } return false;
  })()`,
  readyExpr: `!!document.querySelector('form textarea')`,
  generatingExpr: `(() => {
    return [...document.querySelectorAll('button')].some(b => b.offsetParent !== null
      && /stop generation|arr[êe]ter/i.test(b.getAttribute('aria-label') || ''));
  })()`,
  readExpr: `(() => {
    const car = document.querySelector('[role="region"][aria-roledescription="carousel"]');
    if (car) {
      const slide = car.querySelector('[aria-roledescription="slide"] .prose');
      if (slide) return { text: (slide.innerText || '').trim(), thinking: '' };
    }
    const root = document.querySelector('ol.flex-col-reverse') || document.querySelector('ol');
    if (!root) return { text: '', thinking: '' };
    const asst = [...root.children].filter(li => li.querySelector('.prose') && !String(li.className).includes('justify-end'));
    const last = asst[asst.length - 1];
    return { text: last ? (last.querySelector('.prose').innerText || '').trim() : '', thinking: '' };
  })()`,
  loginBlockExpr: `(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find(d => d.getBoundingClientRect().width > 40);
    if (dlg) return true;
    return [...document.querySelectorAll('iframe')].some(f => /challenges.cloudflare.com|hcaptcha|recaptcha/.test(f.src) && f.offsetParent !== null);
  })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'too many requests|rate.?limit|limit reached|daily|upgrade',
  busyRe: 'something went wrong|try again later|failed to',
  models: [{ id: 'direct', label: 'Direct' }],
  capabilities: [
    { id: 'vision', label: 'Imagens (entrada)' },
    { id: 'web_search', label: 'Pesquisa Web', route: 'https://arena.ai/search/', experimental: true },
    { id: 'image_gen', label: 'Gerar imagem', route: 'https://arena.ai/image/', experimental: true },
  ],
};

export const QWEN_CONFIG: WebProviderConfig = {
  id: 'qwen',
  name: 'Qwen',
  chatUrl: 'https://chat.qwen.ai/',
  editorSel: 'textarea.message-input-textarea',
  editorKind: 'textarea',
  sendSel: 'button.send-button',
  readyExpr: `!!document.querySelector('textarea.message-input-textarea')`,
  generatingExpr: `!!document.querySelector('button.stop-button')`,
  readExpr: `(() => {
    const a = [...document.querySelectorAll('.qwen-chat-message-assistant')].filter(e => e.offsetParent !== null);
    const last = a[a.length - 1];
    if (!last) return { text: '', thinking: '' };
    const c = last.querySelector('.response-message-content.phase-answer') || last.querySelector('.response-message-content');
    const th = last.querySelector('.qwen-chat-thinking-tool-status-card-wraper');
    return { text: c ? (c.innerText || '') : '', thinking: th ? th.innerText : '' };
  })()`,
  loginBlockExpr: `(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.getBoundingClientRect().width > 40; })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'reached.{0,20}(daily|usage|quota|free)|daily.{0,10}(usage|message|limit)|usage limit|quota.{0,15}(exceeded|reached)|please wait.{0,12}\\d+\\s*hour|每日.{0,6}(额度|限制)',
  busyRe: 'something went wrong|please try again|server is busy|系统繁忙',
  models: [
    { id: 'qwen3.7-plus', label: 'Qwen3.7-Plus' },
    { id: 'qwen3.7-max', label: 'Qwen3.7-Max' },
    { id: 'qwen3.8-max-preview', label: 'Qwen3.8-Max-Preview' },
  ],
  modelPicker: { triggerSel: '[class*="model-selector"]', itemSel: '[class*="model-item___"]' },
  capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }],
};

export const META_CONFIG: WebProviderConfig = {
  id: 'meta',
  name: 'Meta AI',
  chatUrl: 'https://www.meta.ai/',
  editorSel: '[data-testid="composer-input"]',
  editorKind: 'contenteditable',
  sendSel: '[data-testid="composer-send-button"]',
  readyExpr: `!!document.querySelector('[data-testid="composer-send-button"]')`,
  generatingExpr: `!!document.querySelector('[data-testid="composer-stop-button"]')`,
  readExpr: `(() => {
    const a = [...document.querySelectorAll('[data-testid="assistant-message"]')].filter(e => e.offsetParent !== null);
    const last = a[a.length - 1];
    if (!last) return { text: '', thinking: '' };
    const th = last.querySelector('[data-testid="thinking-status"],[data-testid="subagent-cot-list"]')
      || document.querySelector('[data-testid="thinking-status"]');
    return { text: (last.innerText || '').trim(), thinking: th ? th.innerText : '' };
  })()`,
  loginBlockExpr: `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => d.getBoundingClientRect().width > 40); return !!d; })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'rate.?limit|too many requests|daily|usage limit|upgrade|exceeded',
  busyRe: 'something went wrong|try again later',
  models: [
    { id: 'instant', label: 'Instantané' },
    { id: 'reflexion', label: 'Réflexion' },
  ],
  modelPicker: {
    triggerSel: '[data-testid="composer-mode-dropdown-button"]',
    itemSel: '[id^="radix"], [data-testid^="composer-mode-option-"]',
  },
  capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }],
};

export const DOLA_CONFIG: WebProviderConfig = {
  id: 'dola',
  name: 'Dola AI',
  chatUrl: 'https://www.dola.com/chat',
  editorSel: 'textarea',
  editorKind: 'textarea',
  sendExpr: `(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null
      && /send|enviar|发送/i.test((b.getAttribute('aria-label') || '') + b.textContent) && b.querySelector('svg,path'));
    if (b) { b.click(); return true; } return false;
  })()`,
  readyExpr: `!!document.querySelector('textarea')`,
  generatingExpr: `(() => {
    return [...document.querySelectorAll('button')].some(b => b.offsetParent !== null
      && /stop|cancel|parar/i.test(b.getAttribute('aria-label') || b.textContent || ''));
  })()`,
  readExpr: GENERIC_READ,
  loginBlockExpr: `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => d.getBoundingClientRect().width > 40 && /log|sign|entrar|登录/i.test(d.innerText || '')); return !!d; })()`,
  errorScanExpr: ERROR_SCAN,
  usageLimitRe: 'limit|quota|upgrade|daily|too many',
  busyRe: 'try again|something went wrong',
  capabilities: [
    { id: 'image_gen', label: 'Gerar imagem', route: 'https://www.dola.com/chat/create-image', experimental: true },
  ],
  experimental: true,
};

export const WEB_PROVIDER_CONFIGS: Record<string, WebProviderConfig> = {
  kimi: KIMI_CONFIG,
  glm: GLM_CONFIG,
  arena: ARENA_CONFIG,
  qwen: QWEN_CONFIG,
  meta: META_CONFIG,
  dola: DOLA_CONFIG,
};

// Meta dados espelhados no renderer ficam em src/renderer/src/provider-meta.ts
