export interface ParsedToolCall {
  name: string;
  parameters: Record<string, any>;
  rawBlock: string;
}

// ─── JSON repair ────────────────────────────────────────────────────────────

/**
 * Tenta parsear o JSON como está; se falhar, aplica um conjunto progressivo
 * de heurísticas de reparo antes de desistir.
 */
function cleanAndParseJson(raw: string): any {
  let cleaned = raw.trim();

  // Remove markdown code fences se houver
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Tentativa direta
  try {
    return JSON.parse(cleaned);
  } catch {
    // continua para reparos
  }

  // Reparo 1: aspas escapadas de forma errada dentro de strings
  let repaired = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '"' && !escaped) {
      if (!inString) {
        inString = true;
        repaired += char;
      } else {
        let next = i + 1;
        while (next < cleaned.length && /\s/.test(cleaned[next])) next++;
        if (next === cleaned.length || ',}:]'.includes(cleaned[next])) {
          inString = false;
          repaired += char;
        } else {
          repaired += '\\"';
        }
      }
    } else {
      repaired += char;
    }
    if (char === '\\' && !escaped) escaped = true;
    else escaped = false;
  }

  try {
    return JSON.parse(repaired);
  } catch {
    // continua para reparo 2
  }

  // Reparo 2: trailing commas  {"a":1,}  →  {"a":1}
  const noTrailingComma = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(noTrailingComma);
  } catch {
    // continua
  }

  // Reparo 3: chaves não fechadas — adiciona '}'  e/ou ']' no final até parsear
  let padded = cleaned;
  for (let tries = 0; tries < 5; tries++) {
    padded += '}';
    try { return JSON.parse(padded); } catch { /* segue */ }
    padded = padded.slice(0, -1) + ']';
    try { return JSON.parse(padded); } catch { padded = cleaned + '}'.repeat(tries + 1); }
  }

  // Reparo 4: aspas simples ao redor de chaves/valores
  const singleToDouble = cleaned
    .replace(/(['"])?([a-zA-Z_]\w*)(['"])?\s*:/g, '"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  try {
    return JSON.parse(singleToDouble);
  } catch {
    // desiste
  }

  throw new SyntaxError(`JSON irrecuperável: ${cleaned.slice(0, 120)}`);
}

function parseParamValue(raw: string): any {
  if (!raw) return raw;
  const first = raw[0];
  if (
    first === '{' ||
    first === '[' ||
    first === '"' ||
    /^-?\d/.test(raw) ||
    raw === 'true' ||
    raw === 'false' ||
    raw === 'null'
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ─── Detecção de marcação de ferramenta não reconhecida ──────────────────────

/**
 * Detecta marcação de ferramenta que nenhum formato conhecido reconheceu. É o
 * gatilho do fallback no orquestrador: sem ele a corrida pararia mostrando o
 * protocolo cru ao usuário.
 */
export function looksLikeToolCall(text: string): boolean {
  if (!text) return false;
  return (
    /[<｜|]\s*[|｜]*DSML/i.test(text) ||
    /\binvoke\s+name\s*=\s*["'][^"']+["']/i.test(text) ||
    /<(?:function|tool|call)[\s_]*name\s*=/i.test(text) ||
    /<tool_call[\s>]/i.test(text) ||
    /###MCP_TOOL###/i.test(text) ||
    /<\s*im_start\s*>\s*functions\./i.test(text) ||
    /```(?:json)?\s*\{\s*"(?:tool|command)"\s*:/i.test(text) ||
    // Formato simples sem XML: {"tool":"run_command","command":"..."}
    /\{\s*"(?:tool|command|function_call)"\s*:/i.test(text) ||
    // Modelo escreveu o nome da ferramenta seguido de parâmetros em bloco
    /\brun_command\s*[\({]/i.test(text) ||
    /\bwrite_to_file\s*[\({]/i.test(text) ||
    /\bview_file\s*[\({]/i.test(text)
  );
}

// ─── Parsers por formato ─────────────────────────────────────────────────────

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  function add(tc: ParsedToolCall) {
    const duplicateIndex = toolCalls.findIndex(
      (existing) =>
        existing.rawBlock.includes(tc.rawBlock) || tc.rawBlock.includes(existing.rawBlock)
    );
    if (duplicateIndex === -1) {
      toolCalls.push(tc);
    } else if (tc.rawBlock.includes(toolCalls[duplicateIndex].rawBlock)) {
      toolCalls[duplicateIndex] = tc;
    }
  }

  // ── Format 1: XML tag ────────────────────────────────────────────────────
  // <tool_call name="tool_name">{"param": "val"}</tool_call>
  // Aceita também ausência de atributo name (nome vem dentro do JSON).
  const xmlRegex =
    /<tool_call(?:\s+name=["']([^"']+)["'])?>([\s\S]*?)(?:<\/tool_call>|(?=<tool_call(?:\s|>))|$)/gi;
  let xmlMatch: RegExpExecArray | null;
  while ((xmlMatch = xmlRegex.exec(text)) !== null) {
    try {
      let name = xmlMatch[1];
      const body = xmlMatch[2].trim();
      if (!body) continue;
      const params = cleanAndParseJson(body);
      if (!name && params.name) name = params.name;
      if (name) {
        add({
          name: name.trim(),
          parameters: params.parameters ?? params.params ?? params.args ?? params,
          rawBlock: xmlMatch[0],
        });
      }
    } catch {
      // bloco XML com JSON inválido — tenta extrair ao menos o nome
    }
  }

  // ── Format 2: ZeroScript / MCP Markdown block ────────────────────────────
  // ###MCP_TOOL###...###END_MCP_TOOL###
  const mcpRegex = /###MCP_TOOL###([\s\S]*?)###END_MCP_TOOL###/gi;
  let mcpMatch: RegExpExecArray | null;
  while ((mcpMatch = mcpRegex.exec(text)) !== null) {
    try {
      const data = cleanAndParseJson(mcpMatch[1].trim());
      const name = data.tool ?? data.command ?? data.name;
      const parameters = data.parameters ?? data.params ?? data.args ?? {};
      if (name) {
        add({ name: name.trim(), parameters, rawBlock: mcpMatch[0] });
      }
    } catch {
      // ignore
    }
  }

  // ── Format 3: JSON code block ────────────────────────────────────────────
  // ```json\n{"tool": "run_command", ...}\n```
  const jsonBlockRegex =
    /```(?:json)?\s*(\{[\s\S]*?"(?:tool|command|function_call)"\s*:\s*"([^"]+)"[\s\S]*?\})\s*```/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonBlockRegex.exec(text)) !== null) {
    try {
      const data = cleanAndParseJson(jsonMatch[1]);
      const name = data.tool ?? data.command ?? data.function_call;
      const parameters = data.parameters ?? data.params ?? data.args ?? {};
      if (name) {
        add({ name: name.trim(), parameters, rawBlock: jsonMatch[0] });
      }
    } catch {
      // ignore
    }
  }

  // ── Format 3b: JSON simples inline sem bloco de código ──────────────────
  // {"tool":"run_command","command":"ls"} — modelos que "esquecem" o XML
  const inlineJsonRegex = /\{\s*"(?:tool|command|function_call)"\s*:\s*"([^"]+)"[^}]*\}/gi;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineJsonRegex.exec(text)) !== null) {
    // Não repete se já capturado por outro format
    const alreadyCaptured = toolCalls.some((tc) => tc.rawBlock.includes(inlineMatch![0]));
    if (alreadyCaptured) continue;
    try {
      const data = cleanAndParseJson(inlineMatch[0]);
      const name = data.tool ?? data.command ?? data.function_call;
      // Monta parâmetros: tudo exceto a chave "tool"/"command"/"function_call"
      const { tool: _t, command: _c, function_call: _f, ...rest } = data;
      // Para run_command o parâmetro se chama "command" mesmo
      const parameters =
        data.parameters ?? data.params ?? data.args ?? (name === 'run_command' && data.command ? { command: data.command, ...rest } : rest);
      if (name) {
        add({ name: name.trim(), parameters, rawBlock: inlineMatch[0] });
      }
    } catch {
      // ignore
    }
  }

  // ── Format 4: DeepSeek DSML ──────────────────────────────────────────────
  // <｜｜DSML｜｜ invoke name="tool_name">...</｜｜DSML｜｜>
  const M = '<[|｜\\s]*/?[|｜\\s]*DSML[|｜\\s]*>?\\s*';
  const dsmlRegex = new RegExp(
    `${M}invoke\\s+name=["']([^"']+)["']\\s*>([\\s\\S]*?)${M}(?:invoke|calls|tool_calls)\\s*>`,
    'gi'
  );
  let dsmlMatch: RegExpExecArray | null;
  while ((dsmlMatch = dsmlRegex.exec(text)) !== null) {
    const name = dsmlMatch[1];
    const body = dsmlMatch[2];
    const params: Record<string, any> = {};

    const paramRegex = new RegExp(
      `${M}parameter\\s+name=["']([^"']+)["'][^>]*>([\\s\\S]*?)${M}parameter\\s*>`,
      'gi'
    );
    let pMatch: RegExpExecArray | null;
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
          // corpo não é JSON utilizável
        }
      }
    }

    add({ name: name.trim(), parameters: params, rawBlock: dsmlMatch[0] });
  }

  // ── Format 5: Pseudo-chamada de função estilo Python/JS ──────────────────
  // run_command({"command": "ls"})  ou  view_file(path="/foo")
  const KNOWN_TOOLS = [
    'run_command', 'view_file', 'write_to_file', 'replace_file_content',
    'search_files', 'list_directory', 'search_web', 'http_get',
    'run_background_command', 'check_background_task', 'screen_capture',
    'simulate_input', 'project_memory', 'ask_user', 'stop',
    'create_3d_model', 'render_3d_model', 'preview_3d_model',
    'edit_3d_model', 'export_3d_model',
  ];
  const toolNamesPattern = KNOWN_TOOLS.map((n) => n.replace(/_/g, '[_\\s]')).join('|');
  const funcCallRegex = new RegExp(
    `\\b(${toolNamesPattern})\\s*\\(\\s*(\\{[\\s\\S]*?\\})\\s*\\)`,
    'gi'
  );
  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = funcCallRegex.exec(text)) !== null) {
    const alreadyCaptured = toolCalls.some((tc) => tc.rawBlock.includes(funcMatch![0]));
    if (alreadyCaptured) continue;
    try {
      const name = funcMatch[1].replace(/\s+/g, '_');
      const params = cleanAndParseJson(funcMatch[2]);
      add({ name, parameters: params, rawBlock: funcMatch[0] });
    } catch {
      // ignore
    }
  }

  return toolCalls;
}
