// Arnês de auditoria do FreeAI via CDP (WebSocket nativo do Node, sem dependência nova).
// Uso: node scripts/ui-audit.js [porta]   (app sobe com --remote-debugging-port=9222)
// Toda asserção é medida no app em execução: shell, IPC real, gates, atalhos e telas.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.argv[2] || '9222';
const REPO = path.join(__dirname, '..');
const SHOTS = '/tmp/freeai-audit-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const getJSON = (name) => new Promise((res, rej) => {
  http.get(`http://127.0.0.1:${PORT}${name}`, (r) => {
    let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

const grepCount = (pattern, dirs, filter) => execSync(
  `grep -rniE ${JSON.stringify(pattern)} ${dirs} --include=*.ts 2>/dev/null${filter ? ' | grep -v ' + JSON.stringify(filter) : ''} | wc -l`,
  { cwd: REPO, encoding: 'utf8' }).trim();

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.console = [];
    this.crashed = false;
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); return; }
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        if (!/Electron Security Warning/.test(text)) this.console.push(msg.params.type + ': ' + text.slice(0, 180));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.console.push('EXCEPTION: ' + String(d.exception?.description || d.text).slice(0, 180));
      } else if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
        if (!/Electron Security Warning/.test(msg.params.entry.text)) {
          this.console.push(msg.params.entry.level + ' ' + (msg.params.entry.source || '') + ': ' + msg.params.entry.text.slice(0, 180));
        }
      } else if (msg.method === 'Inspector.targetCrashed') {
        this.crashed = true;
      }
    });
  }
  open() { return new Promise((r) => this.ws.addEventListener('open', r)); }
  send(method, params = {}) {
    const mid = ++this.id;
    return new Promise((resolve) => { this.pending.set(mid, resolve); this.ws.send(JSON.stringify({ id: mid, method, params })); });
  }
  async js(expression) {
    const out = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.result?.exceptionDetails) {
      throw new Error(out.result.exceptionDetails.exception?.description || out.result.exceptionDetails.text);
    }
    return out.result?.result?.value;
  }
  async shot(name) {
    await this.send('Page.bringToFront');
    const s = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(s.result.data, 'base64'));
  }
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '\n       medido: ' + detail : ''));
};
const key = (k, mods) =>
  `window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: k, bubbles: true, ...mods })}))`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const targets = await getJSON('/json');
  const renderer = targets.find((t) => t.type === 'page' && /dist\/renderer|localhost/.test(t.url || ''));
  if (!renderer) { console.log('SEM ALVO RENDERER — suba o app com --remote-debugging-port'); process.exit(1); }
  console.log('# alvo: ' + renderer.url);

  const cdp = new Cdp(renderer.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Inspector.enable');
  await wait(1200);

  // --- shell ---
  const shell = await cdp.js(`(() => ({
    activity: !!document.querySelector('[aria-label="Activity Bar"]'),
    navButtons: document.querySelectorAll('[aria-label="Activity Bar"] button').length,
    composer: !!document.querySelector('textarea'),
    bodyText: (document.body.innerText || '').length }))()`);
  check('shell renderizado (activity bar + composer)', !!shell.activity && !!shell.composer && shell.bodyText > 50, JSON.stringify(shell));

  const glyphs = await cdp.js(`(() => {
    const els = [...document.querySelectorAll('span,button,p,h1,h2')].filter(e => (e.innerText || '').trim().length > 3);
    const zero = [];
    for (const e of els) {
      if (e.closest('.hidden')) continue; // tooltip de hover é 0x0 por design
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) zero.push((e.innerText || '').slice(0, 24));
    }
    return { checked: els.length, zero: zero.slice(0, 5) }; })()`);
  check('texto visível com dimensões reais (fonte da máquina)', glyphs.zero.length === 0, JSON.stringify(glyphs));

  // --- persistência ---
  const conv = await cdp.js(`window.freeai.listConversations().then(r => ({n: r.length, first: r[0] && {id: r[0].id, title: r[0].title, msgs: r[0].totalMessages}}))`);
  check('conversations:list devolve o storage em disco', typeof conv?.n === 'number' && conv.n > 0, JSON.stringify(conv));
  const status = await cdp.js('window.freeai.getProviderStatus()');
  check('provider:get_status responde', !!status && typeof status === 'object', JSON.stringify(status));

  // --- gates de filesystem ---
  const tree = await cdp.js(`window.freeai.fsTree(${JSON.stringify(path.join(REPO, 'src'))}).then(r => ({ error: r.error || null, n: (r.entries || []).length }))`);
  check('fs:tree lê diretório real', !tree.error && tree.n > 0, JSON.stringify(tree));

  const escRead = await cdp.js(`window.freeai.fsReadFile(${JSON.stringify(path.join(os.homedir(), '.config/freeai/sessions.json'))}, ${JSON.stringify(REPO)}).then(r => r.error || 'LEU')`);
  check('fs:readFile bloqueia leitura fora da raiz', /Fora da pasta/.test(String(escRead)), String(escRead).slice(0, 80));

  const escWrite = await cdp.js(`window.freeai.fsWriteFile('/tmp/freeai-audit-escrita.txt', 'x', ${JSON.stringify(REPO)}).then(r => r.error || 'ESCREVEU')`);
  check('fs:writeFile bloqueia escrita fora da raiz',
    /Fora da pasta/.test(String(escWrite)) && !fs.existsSync('/tmp/freeai-audit-escrita.txt'), String(escWrite).slice(0, 80));

  const cmd = await cdp.js(`window.freeai.executeCommand('echo ok-$((2+3))', ${JSON.stringify(os.homedir())}).then(r => r.stdout.trim() + '|exit=' + r.exitCode)`);
  check('system:execute_command executa de verdade', cmd === 'ok-5|exit=0', String(cmd));

  // --- id de conversa (controlado pelo renderer) saindo da pasta ---
  const storageDir = path.join(os.homedir(), '.config', 'freeai', 'storage');
  const auditId = `freeai-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const traversalId = `../${auditId}`;
  const decoy = path.join(storageDir, `${auditId}.json`);
  const original = '{"marca":"original"}';
  try {
    fs.writeFileSync(decoy, original, { flag: 'wx' });
    const upsert = await cdp.js(`window.freeai.upsertMessage(${JSON.stringify(traversalId)}, {id:'m1', role:'user', content:'sobrescrito'})
      .then(() => 'ok').catch(e => 'ERR:' + e.message)`);
    const decoyAfter = fs.existsSync(decoy) ? fs.readFileSync(decoy, 'utf8') : '(sumiu)';
    check('storage: upsertMessage não escreve fora de storage/conversations', decoyAfter === original,
      `upsertMessage(${JSON.stringify(traversalId)}) => ${upsert}; arquivo sentinela preservado? ${decoyAfter === original}`);

    const del = await cdp.js(`window.freeai.deleteConversation(${JSON.stringify(traversalId)}).then(() => 'ok').catch(e => 'ERR:' + e.message)`);
    check('storage: deleteConversation não apaga fora de storage/conversations',
      fs.existsSync(decoy) && fs.readFileSync(decoy, 'utf8') === original,
      `deleteConversation(${JSON.stringify(traversalId)}) => ${del}; arquivo sentinela preservado? ${fs.existsSync(decoy)}`);
  } finally {
    if (fs.existsSync(decoy)) fs.unlinkSync(decoy);
  }

  const readOutside = await cdp.js(`window.freeai.getConversationWindow('../projects', 0, 50)
    .then(r => ({ total: r.total, amostra: JSON.stringify(r).slice(0, 70) }))`);
  check('storage: getMessageWindow rejeita IDs fora de storage/conversations',
    readOutside.total === 0 && readOutside.amostra.includes('"messages":[]'),
    `id inválido => ${JSON.stringify(readOutside)}`);

  // --- atalhos e telas ---
  const shortcuts = await cdp.js(`[...document.querySelectorAll('[aria-label="Activity Bar"] kbd')].map(k => k.textContent)`);
  check('tooltips de atalho renderizados', Array.isArray(shortcuts) && shortcuts.length > 0, JSON.stringify(shortcuts));

  await cdp.js(key('p', { ctrlKey: true }));
  await wait(500);
  const explorer = await cdp.js(`({ text: /File Explorer|Explorer/i.test(document.body.innerText), w: document.querySelector('[aria-label="Sidebar panel"]')?.getBoundingClientRect().width ?? -1 })`);
  check('Ctrl+P abre o explorer', explorer.text && explorer.w > 50, JSON.stringify(explorer));
  await cdp.shot('02-explorer');

  const before = await cdp.js(`document.querySelector('[aria-label="Sidebar panel"]')?.getBoundingClientRect().width ?? -1`);
  await cdp.js(key('b', { ctrlKey: true }));
  await wait(500);
  const after = await cdp.js(`document.querySelector('[aria-label="Sidebar panel"]')?.getBoundingClientRect().width ?? -1`);
  check('Ctrl+B alterna o painel lateral', before !== after, `before=${before} after=${after}`);
  await cdp.js(key('b', { ctrlKey: true }));

  await cdp.js(key(',', { ctrlKey: true }));
  await wait(500);
  const settings = await cdp.js(`(() => { const t = document.body.innerText; return {
    tela: /Provedor de IA Padr/i.test(t), deepseek: /DeepSeek/.test(t), gemini: /Gemini/.test(t),
    kimi: /Kimi/.test(t), qwen: /Qwen/.test(t), meta: /Meta AI/.test(t), phantomPort: /17613/.test(t) }; })()`);
  check('Configurações listam os provedores que a UI oferece', settings.tela && settings.kimi && settings.qwen,
    JSON.stringify(settings));
  check('Configurações não exibem dado inventado', !settings.phantomPort,
    `a tela mostra "Porta IPC Local 17613 (WS)"; ocorrências de 17613 no código: ${grepCount('17613', 'src')}`);
  await cdp.shot('03-settings');

  await cdp.js(`(() => { const b = [...document.querySelectorAll('[aria-label="Activity Bar"] button')];
    const t = b.find(x => /Scheduled|Tasks/i.test(x.getAttribute('aria-label') || x.title || '')); if (t) t.click(); return !!t; })()`);
  await wait(600);
  const tasks = await cdp.js(`(() => { const t = document.body.innerText; return {
    showsLastRun: /Hoje .s 09:00|15 min atr|Ontem .s/.test(t), keepAlive: /Keep-Alive/.test(t) }; })()`);
  const schedulerLines = grepCount('cron|schedul', 'src/main');
  check('Tasks agendadas têm executor real no main', schedulerLines !== '0',
    `a tela exibe lastRun ("Hoje às 09:00", "15 min atrás"); linhas de agendador em src/main: ${schedulerLines}`);
  await cdp.shot('04-tasks');

  await cdp.js(`(() => { const b = [...document.querySelectorAll('[aria-label="Activity Bar"] button')];
    const s = b.find(x => /Skills/i.test(x.getAttribute('aria-label') || x.title || '')); if (s) s.click(); return !!s; })()`);
  await wait(600);
  const skillsText = await cdp.js(`/ZeroScript MCP Protocol/.test(document.body.innerText)`);
  const mcpLines = grepCount('new Client|ModelContextProtocol|mcp-client|@modelcontextprotocol', 'src/main src/preload');
  check('Skills: cada habilidade anunciada existe no app', !skillsText || mcpLines !== '0',
    `SkillsView anuncia "ZeroScript MCP Protocol" como habilidade ativa; linhas de cliente MCP no main/preload: ${mcpLines}`);
  await cdp.shot('05-skills');

  // --- abrir conversa real e conferir render ---
  await cdp.js(`(() => {
    const c = [...document.querySelectorAll('[aria-label="Activity Bar"] button')]
      .find(x => x.getAttribute('aria-label') === 'Conversations');
    if (c) c.click();
    return !!c;
  })()`);
  await wait(1000);
  const opened = await cdp.js(`(() => {
    const rows = [...document.querySelectorAll('[aria-label="Sidebar panel"] div.group.relative')];
    const chat = () => (document.querySelector('main') || document.body).innerText.replace(/\\s+/g, ' ');
    const antes = chat();
    const ativa = rows.findIndex(r => (r.className || '').includes('bg-ag-bg-active'));
    const alvo = rows.find((r, i) => i !== ativa && (r.innerText || '').length > 20);
    if (alvo) ['mousedown', 'mouseup', 'click'].forEach(t => alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
    return new Promise(r => setTimeout(() => r({
      linhas: rows.length, indexAtiva: ativa, clicada: !!alvo,
      previewLinha: (alvo ? alvo.innerText : '').replace(/\\s+/g, ' ').slice(0, 40),
      mudou: chat() !== antes, depois: chat().slice(0, 60)
    }), 1700)); })()`);
  check('clicar numa conversa troca o conteúdo do chat', opened.mudou && opened.clicada, JSON.stringify(opened));
  await cdp.shot('06-conversa');

  // --- protocolo de ferramenta vazando para o usuário ---
  const previews = await cdp.js(`window.freeai.listConversations().then(r => r.map(c => (c.preview || '').replace(/\\s+/g, ' ').slice(0, 60)))`);
  const leaked = previews.filter((p) => /tool_call name=|DSML|MCP_TOOL|Continue working on the user/.test(p));
  check('nenhum preview guarda protocolo cru de ferramenta', leaked.length === 0,
    `conversas com protocolo no lugar da resposta: ${JSON.stringify(leaked)}`);
  const inCanvas = await cdp.js(`(() => {
    const t = document.querySelector('[aria-label="Chat"], main')?.innerText || document.body.innerText;
    return /tool_call name=/.test(t);
  })()`);
  check('chat visível não mostra XML de ferramenta como texto', !inCanvas,
    'o texto <tool_call name="..."> aparece renderizado como mensagem');

  // --- títulos ---
  // mensagem cujo conteúdo é protocolo cru: some da tela (react-markdown descarta tag desconhecida)
  const invisivel = await cdp.js(`(() => {
    const rows = [...document.querySelectorAll('[aria-label="Sidebar panel"] div.group.relative')];
    const alvo = rows.find(r => /tool_call|toolcall/i.test(r.innerText));
    if (!alvo) return { encontrada: false };
    ['mousedown', 'mouseup', 'click'].forEach(t => alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
    return new Promise(r => setTimeout(() => {
      const main = document.querySelector('main');
      const texto = (main.innerText || '').replace(/\\s+/g, ' ');
      r({ encontrada: true, preview: (alvo.innerText || '').replace(/\\s+/g, ' ').slice(0, 40),
        protocoloNoDOM: /tool_call/.test(main.innerHTML), protocoloVisivel: /tool_call/.test(texto) });
    }, 1500));
  })()`);
  check('mensagem com protocolo cru não pode desaparecer da tela',
    !invisivel.encontrada || (invisivel.protocoloNoDOM && invisivel.protocoloVisivel),
    JSON.stringify(invisivel));

  const versao = await cdp.js(`(() => {
    const t = (document.querySelector('header, [class*="TitleBar"]') || document.body).innerText;
    return (t.match(/\\d+\\.\\d+(?:\\.\\d+)?/) || [null])[0];
  })()`);
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
  check('barra de título mostra a versão real do app', versao === pkg,
    `a UI exibe "${versao}"; package.json diz "${pkg}"`);

  const untitled = await cdp.js(`window.freeai.listConversations().then(r => {
    const comMsg = r.filter(c => c.totalMessages > 0);
    return { semTitulo: comMsg.filter(c => c.title === 'New Conversation').length, total: comMsg.length };
  })`);
  check('conversa com mensagem ganha título derivado', untitled.semTitulo === 0,
    `${untitled.semTitulo} de ${untitled.total} conversas continuam "New Conversation" (título só muda se o usuário renomear)`);

  check('renderer não travou durante a sessão', !cdp.crashed, 'Inspector.targetCrashed=' + cdp.crashed);
  check('nenhum erro real de console na sessão', cdp.console.length === 0, cdp.console.slice(0, 6).join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passaram ===`);
  console.log('=== screenshots em ' + SHOTS + ' ===');
  cdp.ws.close();
  process.exit(0);
})().catch((e) => { console.error('ERRO ARNÊS:', e.message); process.exit(2); });
