// Mensagem enviada quando o modelo emite chamada de ferramenta em formato desconhecido.
const TOOL_CALL_CLOSE = '<' + '/tool_call>';

export const TOOL_FORMAT_FALLBACK =
  'Your previous tool call could not be parsed by the local executor, so nothing ran. ' +
  'Do NOT reuse that format. Re-emit the SAME tool call using exactly this format, with valid JSON inside:\n\n' +
  '<tool_call name="tool_name">\n{"param": "value"}\n' + TOOL_CALL_CLOSE + '\n\n' +
  'Put any reasoning before the block, and emit only one block.';
