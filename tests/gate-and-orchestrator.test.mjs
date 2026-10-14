import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require_ = createRequire(import.meta.url);
const dist = (rel) => require_(path.join(import.meta.dirname, '..', 'dist', 'main', rel));

const { getAgentSystemPrompt } = dist('SystemPrompts/agent-system-prompt.js');
const { AgentOrchestrator } = dist('agent/agent-orchestrator.js');

const OPEN = '<' + 'tool_call';
const CLOSE = '<' + '/tool_call>';
const call = (name, body) => OPEN + ' name="' + name + '">' + body + CLOSE;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freeai-gate-'));

function callbacks(extra = {}) {
  return {
    onToken() {}, onThinking() {}, onToolCall() {}, onToolResult() {},
    onComplete() {}, onError() {}, ...extra
  };
}

function manager(turns) {
  let i = 0;
  return {
    prompts: [],
    async sendPrompt(provider, prompt) {
      this.prompts.push(prompt);
      const t = turns[Math.min(i, turns.length - 1)];
      i++;
      return typeof t === 'function' ? t() : t;
    },
    stop() {}
  };
}

function runOrchestrator(mgr, opts = {}, extra = {}) {
  const orch = new AgentOrchestrator(mgr);
  return new Promise((resolve) => {
    orch.run(opts.conversationId || 'c1', 'oi', opts.provider || 'deepseek',
      opts.mode || 'agent', opts.cwd || tmp,
      callbacks({ onComplete: resolve, onError: resolve }),
      { projectPath: opts.projectPath });
  });
}

test('free chat: prompt não anuncia ferramentas de escrita', () => {
  const prompt = getAgentSystemPrompt(tmp, false);
  assert.match(prompt, /PROJECT MODE: DISABLED/);
  assert.equal(/write_to_file:/.test(prompt), false);
  assert.equal(/project_memory:/.test(prompt), false);
});

test('gate de escrita em free chat deve ser aplicado pelo executor, não só pelo prompt', async () => {
  const victim = path.join(tmp, 'free-chat-write.txt');
  const mgr = manager([
    call('write_to_file', '{"path":' + JSON.stringify(victim) + ',"content":"gravado"}'),
    call('stop', '{}')
  ]);
  await runOrchestrator(mgr);
  assert.equal(fs.existsSync(victim), false,
    'o executor aceitou write_to_file em conversa sem projeto e gravou ' + victim +
    ' — o gate é apenas texto no prompt');
});

test('gate: project_memory não pode gravar em conversa sem projeto', async () => {
  const memFile = path.join(tmp, 'FREEAI_MEMORY.md');
  const mgr = manager([
    call('project_memory', '{"action":"create","content":"x"}'),
    call('stop', '{}')
  ]);
  await runOrchestrator(mgr);
  assert.equal(fs.existsSync(memFile), false,
    'project_memory criou ' + memFile + ' em chat sem projeto');
});

test('chamada de ferramenta junto com stop não pode ser silenciosamente descartada', async () => {
  const victim = path.join(tmp, 'junto-com-stop.txt');
  const mgr = manager([
    call('write_to_file', '{"path":' + JSON.stringify(victim) + ',"content":"ultima gravacao"}') + '\n' + call('stop', '{}')
  ]);
  await runOrchestrator(mgr, { projectPath: tmp });
  assert.equal(fs.existsSync(victim), true,
    'stop%20descarta as outras chamadas da mesma resposta: a escrita pedida ' +
    'pelo modelo foi ignorada sem nenhum aviso ao usuário');
});

test('stop() não interrompe o sendPrompt em andamento (a corrida segue até o provedor responder)', async () => {
  let release;
  const mgr = { async sendPrompt() { return new Promise((r) => { release = r; }); }, stop() {} };
  const orch = new AgentOrchestrator(mgr);
  let completed = false;
  orch.run('c1', 'p1', 'deepseek', 'fast', tmp, callbacks({ onComplete: () => { completed = true; } }));
  await new Promise((r) => setImmediate(r));
  orch.stop('deepseek');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(completed, false, 'a corrida terminou sem resposta do provedor (inesperado)');
  release('fim');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(completed, true, 'onComplete nunca chegou (inesperado)');
});

test('segunda run não pode reativar uma corrida já cancelada', async () => {
  let turn = 0;
  let release;
  const mgr = {
    async sendPrompt() {
      turn++;
      if (turn === 2) return new Promise((r) => { release = r; });
      return call('stop', '{}');
    },
    stop() {}
  };
  const orch = new AgentOrchestrator(mgr);
  const events = [];
  const cb = (cid) => callbacks({
    onToolCall() { events.push('tool:' + cid); },
    onComplete() { events.push('complete:' + cid); }
  });
  orch.run('c1', 'p1', 'deepseek', 'agent', tmp, cb('c1'));
  await new Promise((r) => setTimeout(r, 20)); // corrida 1 presa no 2o turno
  orch.stop('deepseek');
  orch.run('c2', 'p2', 'deepseek', 'agent', tmp, cb('c2'));
  release(call('run_command', '{"command":"id"}'));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(events.some((e) => e.startsWith('tool:c1')), false,
    'run() resetou a flag isCancelled compartilhada: a conversa cancelada voltou a executar ' +
    'ferramentas -> ' + JSON.stringify(events) + ' (duas corridas na mesma janela do provedor)');
});
