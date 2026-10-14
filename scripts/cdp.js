// Mini-cliente CDP para o FreeAI (usa WebSocket global do Node, sem dependencias).
// Uso: node scripts/cdp.js <role> "<expr JS>"
//   role = renderer  -> alvo file://.../dist/renderer/index.html
//   role = provider  -> alvo chat.deepseek.com (conversa real do provedor)
const http = require('http');

const ROLE_RE = {
  renderer: /dist\/renderer|localhost|file:\/\//,
  provider: /chat\.deepseek\.com|use\.ai|gemini|chatgpt|kimi|glm|arena|qwen|meta|dola/
};

function getTargets() {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222/json', (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function main() {
  const role = process.argv[2] || 'renderer';
  const expr = process.argv[3] || 'document.title';
  const targets = await getTargets();
  const re = ROLE_RE[role] || ROLE_RE.renderer;
  const t = targets.find(x => x.type === 'page' && re.test(x.url || ''));
  if (!t) { console.error('ALVO NAO ENCONTRADO para role=' + role); console.error(targets.map(x => x.url)); process.exit(3); }
  console.error('# alvo: ' + (t.url || '').slice(0, 70));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r));
  await send('Runtime.enable', {});
  const out = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (out.result && out.result.exceptionDetails) {
    console.log('EXCEPTION:', JSON.stringify(out.result.exceptionDetails, null, 2));
  } else {
    console.log(JSON.stringify(out.result ? out.result.result : out, null, 2));
  }
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
