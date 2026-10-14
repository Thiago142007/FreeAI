// Mede glifos perdidos: textContent (o que o DOM diz) vs innerText (o que a tela renderiza).
const http = require('http');
const j = (p) => new Promise((res, rej) => {
  http.get('http://127.0.0.1:9222' + p, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
(async () => {
  const t = (await j('/json')).find((x) => /dist\/renderer/.test(x.url || ''));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await new Promise((r) => ws.addEventListener('open', r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  const js = async (e) => {
    const o = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (o.result && o.result.exceptionDetails) throw new Error(JSON.stringify(o.result.exceptionDetails).slice(0, 200));
    return o.result.result.value;
  };
  const out = await js(`(() => {
    const rows = [];
    for (const el of document.querySelectorAll('span, div, button, p')) {
      const tc = (el.textContent || '').trim();
      if (tc.length < 6 || tc.length > 120 || el.children.length > 3) continue;
      const it = (el.innerText || '').trim();
      if (it !== tc.replace(/\\s+/g, ' ') && it.replace(/\\s+/g, '').length < tc.replace(/\\s+/g, '').length) {
        rows.push({ fonte: getComputedStyle(el).fontFamily.slice(0, 34), esperado: tc.slice(0, 42), renderizado: it.replace(/\\n/g, ' ').slice(0, 42) });
      }
    }
    const probe = (font) => {
      const s = document.createElement('span');
      s.style.cssText = 'position:fixed;left:-9999px;top:0;font:' + font;
      s.textContent = 'Nova Conversation Desktop 05:37 PM';
      document.body.appendChild(s);
      const r = s.getBoundingClientRect();
      s.remove();
      return Math.round(r.width);
    };
    return JSON.stringify({
      afetados: rows.length,
      exemplos: rows.slice(0, 6),
      larguras: {
        inter: probe('14px Inter, system-ui, sans-serif'),
        dejavuMono: probe('14px "DejaVu Sans Mono", monospace'),
        genericMono: probe('14px monospace')
      }
    }, null, 1);
  })()`);
  console.log(out);
  process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(2); });
