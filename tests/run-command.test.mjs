import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require_ = createRequire(import.meta.url);
const { runCommand } = require_(path.join(import.meta.dirname, '..', 'dist', 'main', 'agent', 'tools', 'run-command.js'));

const isWin = process.platform === 'win32';
const tmp = isWin ? process.env.TEMP || 'C:\\Windows\\Temp' : '/tmp';

test('run_command: eco/erro/exit pelo shell nativo', async () => {
  const cmd = isWin
    ? 'Write-Output oi; Write-Error erro; exit 3'
    : 'echo oi; echo erro >&2; exit 3';
  const r = await runCommand(cmd, tmp);
  assert.match(r.stdout, /oi/);
  assert.match(r.stderr, /erro/);
  assert.equal(r.exitCode, 3);
});

test('run_command: timeout mata dentro de 2.5s', async () => {
  const cmd = isWin ? 'Start-Sleep 6' : "bash -c 'exec -a freeai-timeout-test sleep 6' & wait";
  const t0 = Date.now();
  const r = await runCommand(cmd, tmp, 1000);
  const ms = Date.now() - t0;
  if (!isWin) await runCommand("pkill -f '^freeai-timeout-test( |$)' || true", tmp);
  assert.ok(ms < 2500, `timeout de 1s resolveu em ${ms}ms — kill não fecha pipes dos filhos`);
  assert.match(r.stderr, /timed out/);
});

test('run_command: não deixa processo órfão (POSIX)', { skip: isWin }, async () => {
  const cmd = "bash -c 'exec -a freeai-timeout-test sleep 6' & wait";
  await runCommand(cmd, tmp, 1000);
  await new Promise((r) => setTimeout(r, 500));
  const out = await runCommand("pgrep -fc '^freeai-timeout-test( |$)' || true", tmp);
  const vivos = out.stdout.trim();
  await runCommand("pkill -f '^freeai-timeout-test( |$)' || true", tmp);
  assert.equal(vivos, '0', `${vivos} instâncias vivas na máquina do usuário`);
});

test('run_command: shell do SO real, não bash fixo', async () => {
  const probe = isWin ? 'Write-Output $PSVersionTable.PSVersion.Major' : 'echo $ZSH_VERSION$BASH_VERSION';
  const r = await runCommand(probe, tmp);
  assert.match(r.stdout.trim(), /\d/, `shell esperava versão, veio vazio: ${r.stderr}`);
});
