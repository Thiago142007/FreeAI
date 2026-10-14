// Texto devolvido ao modelo depois que o executor roda as ferramentas dele.
import { getPlatformAdapter } from '../platform';

const TOOL_CALL_OPEN  = '<' + 'tool_call';
const TOOL_CALL_CLOSE = '<' + '/tool_call>';
const STOP_BLOCK = TOOL_CALL_OPEN + ' name="stop">\n{}\n' + TOOL_CALL_CLOSE;

export function formatToolResult(name: string, output: string): string {
  return `[TOOL RESULT for ${name}]:\n${output}`;
}

export function buildToolResultFeedback(results: string[]): string {
  const platform = getPlatformAdapter().label;

  const failedTools = results.filter((r) => r.includes('\nError executing tool:'));
  const failureNote =
    failedTools.length > 0
      ? '\n\n⚠️ One or more tools FAILED (see results above). ' +
        'Diagnose the error from the output and decide whether to retry with corrected parameters, ' +
        'use an alternative approach, or report the issue to the user.'
      : '';

  return (
    `Here are the execution results of your tool calls on the local ${platform} system:\n\n` +
    results.join('\n\n---\n\n') +
    failureNote +
    '\n\n' +
    "Evaluate the results carefully and keep working toward the user's request.\n" +
    'Remember: this platform only produces output when it receives a message, so the app will keep prompting you.\n\n' +
    '- If ANY work remains, take the NEXT step now (another tool call or write your answer).\n' +
    '- Do NOT call stop until the task is FULLY complete and your final answer is written.\n' +
    '- When the task IS fully complete, emit ONLY this to end the run:\n' +
    STOP_BLOCK
  );
}
