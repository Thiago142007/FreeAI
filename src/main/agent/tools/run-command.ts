import { spawn } from 'child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export async function runCommand(
  command: string,
  cwd: string = process.cwd(),
  timeoutMs: number = 60000
): Promise<CommandResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    const child = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, PAGER: 'cat' },
    });

    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000);
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (isTimedOut) {
        stderr += `\n[Command timed out after ${timeoutMs}ms]`;
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? (isTimedOut ? -1 : 0),
        durationMs,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr: `Error spawning command: ${err.message}`,
        exitCode: -1,
        durationMs,
      });
    });
  });
}
