// Mensagem que mantém a IA trabalhando. O app dirige um site de chat que só responde
// quando recebe uma mensagem; enquanto a IA não chamar stop, enviamos este nudge.

const TOOL_CALL_OPEN  = '<' + 'tool_call';
const TOOL_CALL_CLOSE = '<' + '/tool_call>';
const STOP_BLOCK = TOOL_CALL_OPEN + ' name="stop">\n{}\n' + TOOL_CALL_CLOSE;

export const CONTINUE_NUDGE =
  'You are still inside an active run. This platform is a chat website: it only produces output when it receives a new message, ' +
  'so the app sends this nudge to keep you making progress.\n\n' +
  'Choose ONE of the following paths:\n\n' +
  'A) There is still work to do → take the NEXT concrete step RIGHT NOW.\n' +
  '   Use a tool call if needed. Do not summarise what you did — just act.\n\n' +
  'B) The task is 100% complete AND your final answer is already written → emit ONLY this to end the run:\n' +
  STOP_BLOCK + '\n\n' +
  'C) The user asked a simple conversational question that requires no tool use and no file changes → ' +
  'answer it directly, then emit the stop block above.\n\n' +
  'IMPORTANT: Do NOT emit stop if any step is still pending or partially done. ' +
  'Do NOT repeat the stop block inside a sentence — emit it as a standalone block.';
