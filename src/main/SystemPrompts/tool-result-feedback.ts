// Texto devolvido ao modelo depois que o executor roda as ferramentas dele.
import { getPlatformAdapter } from '../platform';

const OPEN = '<' + 'tool_call';
const CLOSE = '<' + '/tool_call>';
const STOP_BLOCK = OPEN + ' name="stop">\n{}\n' + CLOSE;

export function formatToolResult(name: string, output: string): string {
  return `[TOOL RESULT for ${name}]:\n${output}`;
}

export function buildToolResultFeedback(results: string[]): string {
  return (
    `Here are the execution results of your tool calls on the local ${getPlatformAdapter().label} system:\n\n` +
    results.join('\n\n') +
    "\n\nEvaluate the results and keep working toward the user's request. " +
    'This platform only replies when it receives a message, so the app will keep prompting you until you end the run.' +
    '\n- If any work remains, take the next step now.' +
    '\n- When the task is FULLY complete and your final answer is ready, emit exactly this to stop:\n' +
    STOP_BLOCK
  );
}
