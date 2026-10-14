import { spawn } from 'child_process';
import { getPlatformAdapter } from '../../platform';

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
  const adapter = getPlatformAdapter();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    const shell = adapter.spawnShell(command);
    const child = spawn(shell.cmd, shell.args, {
      cwd,
      env: { ...process.env, PAGER: 'cat' },
      detached: process.platform !== 'win32',
    });

    let forceKillTimer: NodeJS.Timeout | undefined;
    const signalProcessGroup = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      adapter.killTree(child, signal);
    };

    const timer = setTimeout(() => {
      isTimedOut = true;
      signalProcessGroup('SIGTERM');
      forceKillTimer = setTimeout(() => signalProcessGroup('SIGKILL'), 2000);
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
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
      if (forceKillTimer) clearTimeout(forceKillTimer);
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
