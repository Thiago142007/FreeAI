export interface ParsedToolCall {
  name: string;
  parameters: Record<string, any>;
  rawBlock: string;
}

function cleanAndParseJson(raw: string): any {
  let cleaned = raw.trim();
  // Remove markdown code fences se houver
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function parseParamValue(raw: string): any {
  if (!raw) return raw;
  const first = raw[0];
  if (first === '{' || first === '[' || first === '"' || /^-?\d/.test(raw) || raw === 'true' || raw === 'false' || raw === 'null') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// Mensagem enviada quando o modelo emite chamada de ferramenta em formato desconhecido.
const TOOL_CALL_CLOSE = '<' + '/tool_call>';

export const TOOL_FORMAT_FALLBACK =
  'Your previous tool call could not be parsed by the local executor, so nothing ran. ' +
  'Do NOT reuse that format. Re-emit the SAME tool call using exactly this format, with valid JSON inside:\n\n' +
  '<tool_call name="tool_name">\n{"param": "value"}\n' + TOOL_CALL_CLOSE + '\n\n' +
  'Put any reasoning before the block, and emit only one block.';

// Detecta marcação de ferramenta que nenhum formato conhecido reconheceu. É o gatilho do
// fallback no orquestrador: sem ele a corrida pararia mostrando o protocolo cru ao usuário.
export function looksLikeToolCall(text: string): boolean {
  if (!text) return false;
  return /[<｜|]\s*[|｜]*DSML/i.test(text)
    || /\binvoke\s+name\s*=\s*["'][^"']+["']/i.test(text)
    || /<(?:function|tool|call)[\s_]*name\s*=/i.test(text)
    || /<tool_call[\s>]/i.test(text)
    || /###MCP_TOOL###/i.test(text)
    || /<\s*im_start\s*>\s*functions\./i.test(text)
    || /```(?:json)?\s*\{\s*"(?:tool|command)"\s*:/i.test(text);
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  // Format 1: XML tag: <tool_call name="tool_name">{"param": "val"}</tool_call> ou <tool_call name="...">
  const xmlRegex = /<tool_call(?:\s+name=["']([^"']+)["'])?>([\s\S]*?)<\/tool_call>/gi;
  let xmlMatch;
  while ((xmlMatch = xmlRegex.exec(text)) !== null) {
    try {
      let name = xmlMatch[1];
      const body = xmlMatch[2].trim();
      const params = cleanAndParseJson(body);

      if (!name && params.name) {
        name = params.name;
      }
      if (name) {
        toolCalls.push({
          name: name.trim(),
          parameters: params.parameters || params.params || params.args || params,
          rawBlock: xmlMatch[0],
        });
      }
    } catch {
      // not valid json inside tag
    }
  }

  // Format 2: ZeroScript / MCP Markdown block: ###MCP_TOOL### ... ###END_MCP_TOOL###
  const mcpRegex = /###MCP_TOOL###([\s\S]*?)###END_MCP_TOOL###/gi;
  let mcpMatch;
  while ((mcpMatch = mcpRegex.exec(text)) !== null) {
    try {
      const data = cleanAndParseJson(mcpMatch[1].trim());
      const name = data.tool || data.command || data.name;
      const parameters = data.parameters || data.params || data.args || {};
      if (name) {
        toolCalls.push({
          name: name.trim(),
          parameters,
          rawBlock: mcpMatch[0],
        });
      }
    } catch {
      // ignore
    }
  }

  // Format 3: JSON code block: ```json\n{"tool": "run_command", ...}\n```
  const jsonBlockRegex = /```(?:json)?\s*\{[\s\S]*?"(?:tool|command)":\s*"([^"]+)"[\s\S]*?\}\s*```/gi;
  let jsonMatch;
  while ((jsonMatch = jsonBlockRegex.exec(text)) !== null) {
    try {
      const jsonContent = jsonMatch[0].replace(/```(?:json)?/g, '').trim();
      const data = cleanAndParseJson(jsonContent);
      const name = data.tool || data.command;
      const parameters = data.parameters || data.params || data.args || {};
      if (name) {
        toolCalls.push({
          name: name.trim(),
          parameters,
          rawBlock: jsonMatch[0],
        });
      }
    } catch {
      // ignore
    }
  }

  // Format 4: DeepSeek DSML. No payload real o marcador é "<｜｜DSML｜｜ invoke ...>" — ou
  // seja, U+FF5C ao redor de "DSML", sem ">" antes do nome da tag, e barra de fechamento
  // antes ou depois das barras verticais. O corpo pode ser JSON puro ou pares <parameter>.
  const M = '<[|｜\\s]*/?[|｜\\s]*DSML[|｜\\s]*>?\\s*';
  const dsmlRegex = new RegExp(
    `${M}invoke\\s+name=["']([^"']+)["']\\s*>([\\s\\S]*?)${M}(?:invoke|calls|tool_calls)\\s*>`,
    'gi'
  );
  let dsmlMatch;
  while ((dsmlMatch = dsmlRegex.exec(text)) !== null) {
    const name = dsmlMatch[1];
    const body = dsmlMatch[2];
    const params: Record<string, any> = {};

    const paramRegex = new RegExp(`${M}parameter\\s+name=["']([^"']+)["'][^>]*>([\\s\\S]*?)${M}parameter\\s*>`, 'gi');
    let pMatch;
    while ((pMatch = paramRegex.exec(body)) !== null) {
      params[pMatch[1]] = parseParamValue(pMatch[2].trim());
    }

    if (Object.keys(params).length === 0) {
      const jsonish = body.split(new RegExp(M))[0].trim();
      if (jsonish.startsWith('{') || jsonish.startsWith('[')) {
        try {
          const parsed = JSON.parse(jsonish);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            Object.assign(params, parsed);
          } else {
            params.value = parsed;
          }
        } catch {
          // corpo não é JSON utilizável; segue sem parâmetros
        }
      }
    }

    toolCalls.push({
      name: name.trim(),
      parameters: params,
      rawBlock: dsmlMatch[0],
    });
  }

  return toolCalls;
}
