// http_get inspirado no ZeroScript: busca uma URL e, com `query`,
// retorna só as seções correspondentes com contexto, economizando tokens
export async function httpGet(params: {
  url: string;
  query?: string;
  returnFull?: boolean;
  contextLines?: number;
}): Promise<string> {
  if (!/^https?:\/\//i.test(params.url)) {
    throw new Error('http_get: url deve começar com http:// ou https://');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let body: string;
  try {
    const res = await (globalThis as any).fetch(params.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) FreeAI-Agent/1.0' },
    });
    if (!res.ok) throw new Error(`http_get: HTTP ${res.status} ${res.statusText}`);
    body = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const text = htmlToText(body);
  const MAX = 60000;

  if (!params.query || params.returnFull) {
    return text.slice(0, MAX);
  }

  const lines = text.split('\n');
  const q = params.query.toLowerCase();
  const ctx = params.contextLines ?? 3;
  const out: string[] = [];
  let matches = 0;

  for (let i = 0; i < lines.length && matches < 20; i++) {
    if (lines[i].toLowerCase().includes(q)) {
      matches++;
      const from = Math.max(0, i - ctx);
      const to = Math.min(lines.length - 1, i + ctx);
      out.push(`--- match ${matches} (linha ${i + 1}) ---`);
      out.push(...lines.slice(from, to + 1));
      i = to;
    }
  }

  if (matches === 0) return `http_get: "${params.query}" não encontrado em ${params.url} (${text.length} chars baixados)`;
  return out.join('\n').slice(0, MAX);
}

function htmlToText(html: string): string {
  if (!/<[a-z/]/i.test(html)) return html;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter((l, idx, arr) => l && l !== arr[idx - 1])
    .join('\n');
}
