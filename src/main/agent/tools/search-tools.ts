export async function searchWeb(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return `Search request failed with status: ${response.status}`;
    }

    const html = await response.text();
    const results: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = regex.exec(html)) !== null && count < 5) {
      const cleanText = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        results.push(`- ${cleanText}`);
        count++;
      }
    }

    if (results.length === 0) {
      return `No direct search snippets found for "${query}".`;
    }

    return `Search results for "${query}":\n${results.join('\n')}`;
  } catch (err: any) {
    return `Web search failed: ${err.message}`;
  }
}
