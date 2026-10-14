// Mensagem enviada quando o modelo emite chamada de ferramenta em formato desconhecido.
const TOOL_CALL_OPEN  = '<' + 'tool_call';
const TOOL_CALL_CLOSE = '<' + '/tool_call>';

export const TOOL_FORMAT_FALLBACK =
  'Your previous tool call was detected but could NOT be parsed by the local executor — nothing ran.\n\n' +
  'This happens when the format is wrong. You MUST re-emit the EXACT same tool call using this format:\n\n' +
  TOOL_CALL_OPEN + ' name="TOOL_NAME">\n' +
  '{"param1": "value1", "param2": "value2"}\n' +
  TOOL_CALL_CLOSE + '\n\n' +
  'Rules:\n' +
  '- Replace TOOL_NAME with the actual tool name (e.g. run_command, view_file, write_to_file).\n' +
  '- The body must be valid JSON — double quotes on all keys and string values, no trailing commas.\n' +
  '- You may write reasoning BEFORE the block, but the block must appear on its own lines.\n' +
  '- Emit only ONE tool call block per message.\n\n' +
  'Example for run_command:\n' +
  TOOL_CALL_OPEN + ' name="run_command">\n' +
  '{"command": "ls -la", "cwd": "/home/user/project"}\n' +
  TOOL_CALL_CLOSE + '\n\n' +
  'Re-emit the tool call now using this format. Do not skip it.';
