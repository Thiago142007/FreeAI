import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require_ = createRequire(import.meta.url);
const { runCommand } = require_(path.join(import.meta.dirname, '..', 'dist', 'main', 'agent', 'tools', 'run-command.js'));

test('run_command: comando simples devolve stdout/stderr/exit', async () => {
  const r = await runCommand('echo oi; echo erro >&2; exit 3', '/tmp');
  assert.equal(r.stdout.trim(), 'oi');
  assert.equal(r.stderr.trim(), 'erro');
  assert.equal(r.exitCode, 3);
});

test('run_command: timeout de verdade mata a árvore de processos', async () => {
  const t0 = Date.now();
  const command = "bash -c 'exec -a freeai-timeout-test sleep 6' & wait";
  const r = await runCommand(command, '/tmp', 1000);
  const ms = Date.now() - t0;
  await runCommand("pkill -f '^freeai-timeout-test( |$)' || true", '/tmp');
  assert.ok(ms < 2500,
    'timeout pedido de 1s e runCommand só resolveu em ' + ms + 'ms — o kill() não fecha os pipes ' +
    'deixados abertos pelos filhos, então a corrida do agente fica travada no comando');
  assert.match(r.stderr, /timed out/);
});

test('run_command: não deixa processo órfão depois do timeout', async () => {
  const command = "bash -c 'exec -a freeai-timeout-test sleep 6' & wait";
  await runCommand(command, '/tmp', 1000);
  await new Promise((r) => setTimeout(r, 500));
  const out = await runCommand("pgrep -fc '^freeai-timeout-test( |$)' || true", '/tmp');
  const vivos = out.stdout.trim();
  await runCommand("pkill -f '^freeai-timeout-test( |$)' || true", '/tmp');
  assert.equal(vivos, '0',
    'sobrou processo do comando cancelado: ' + vivos + ' instâncias de sleep vivas na máquina do usuário');
});
