// Mensagem que mantém a IA trabalhando. O app dirige um site de chat que só responde
// quando recebe uma mensagem; enquanto a IA não chamar stop, enviamos este nudge.
export const CONTINUE_NUDGE =
  'Continue working on the user’s request. You are still running and this platform only replies when it gets a message, ' +
  'so the app keeps prompting you to make progress.\n' +
  '- If there is ANY remaining work, take the next step now (a tool call or real progress). Do not stop early.\n' +
  '- If and ONLY if the task is fully complete and your final answer to the user is ready, emit exactly this to close the run:\n' +
  '<tool_call name="stop">\n{}\n</tool_call>' +
  'But if the user just asked something that dont need change or he just talked normally with you then you dond need to continue anything';
