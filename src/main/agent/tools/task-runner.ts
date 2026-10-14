import { spawn } from 'child_process';
import * as crypto from 'crypto';
import { getPlatformAdapter } from '../../platform';

interface BackgroundTask {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  exitCode: number | null;
  output: string;
  startedAt: number;
}

const tasks = new Map<string, BackgroundTask>();
const MAX_OUTPUT = 100000;

// run_background_command / check_background_task: padrão dos jobs de longa
// duração do ZeroScript (generate_* + wait_job_finished), trazido para o app
export function runBackgroundCommand(command: string, cwd?: string): string {
  const id = `task-${crypto.randomBytes(4).toString('hex')}`;
  const task: BackgroundTask = {
    id,
    command,
    status: 'running',
    exitCode: null,
    output: '',
    startedAt: Date.now(),
  };
  tasks.set(id, task);

  const sh = getPlatformAdapter().spawnShell(command);
  const child = spawn(sh.cmd, sh.args, { cwd, env: process.env });

  const append = (chunk: Buffer, tag: string) => {
    task.output += (task.output ? '' : '') + `[${tag}] ${chunk.toString()}`;
    if (task.output.length > MAX_OUTPUT) {
      task.output = task.output.slice(-MAX_OUTPUT);
    }
  };

  child.stdout.on('data', (c: Buffer) => append(c, 'stdout'));
  child.stderr.on('data', (c: Buffer) => append(c, 'stderr'));
  child.on('close', (code) => {
    task.exitCode = code;
    task.status = code === 0 ? 'completed' : 'failed';
  });
  child.on('error', (err) => {
    task.output += `[spawn error] ${err.message}`;
    task.status = 'failed';
    task.exitCode = -1;
  });

  return id;
}

export async function checkBackgroundTask(id: string, waitSeconds = 0): Promise<string> {
  const task = tasks.get(id);
  if (!task) return `ERROR: tarefa "${id}" não encontrada (o histórico é da sessão atual do app)`;

  const deadline = Date.now() + waitSeconds * 1000;
  while (task.status === 'running' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  return JSON.stringify(
    {
      id: task.id,
      status: task.status,
      exitCode: task.exitCode,
      elapsedMs: Date.now() - task.startedAt,
      output: task.output.slice(-8000),
    },
    null,
    2
  );
}
