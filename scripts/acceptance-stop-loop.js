// Teste de aceitação do loop "stop" do AgentOrchestrator.
// Usa um dublê de BrowserManager (sem site/login) que devolve respostas roteirizadas
// e registra cada mensagem enviada à IA, para verificar quando o app cutuca ("continue")
// e quando ele encerra (chamada de stop / fast / limite de passos).
const path = require('path');
const { AgentOrchestrator } = require(path.resolve(__dirname, '../dist/main/agent/agent-orchestrator.js'));

let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}${detail ? ' :: ' + detail : ''}`);
}

// Fabrica um BrowserManager falso. `script` é a lista de respostas que a "IA" dá, em ordem.
// Registra cada input recebido em `sent`.
function makeStub(script) {
  const sent = [];
  let i = 0;
  return {
    sent,
    async sendPrompt(_provider, input) {
      sent.push(input);
      const resp = i < script.length ? script[i] : script[script.length - 1];
      i++;
      return resp;
    },
    stop() {}
  };
}

function noopCallbacks() {
  return {
    onToken() {},
    onThinking() {},
    onToolCall() {},
    onToolResult() {},
    onComplete() {},
    onError(e) { throw new Error('onError: ' + e); }
  };
}

const STOP = '<tool_call name="stop">\n{}\n</tool_call>';
const NUDGE_MARK = 'Continue working on the'; // primeira linha do CONTINUE_NUDGE

async function main() {
  // Caso 1: agent — IA responde em texto puro, depois chama stop. Deve nudge 1x e parar.
  {
    const stub = makeStub(['Vou pensar no problema.', 'Pronto, resposta final aqui. ' + STOP]);
    const orch = new AgentOrchestrator(stub);
    let final = '';
    const cbs = Object.assign(noopCallbacks(), { onComplete: (t) => { final = t; } });
    await orch.run('c1', 'faça algo', 'fake', 'agent', '/tmp', cbs, {});
    check('C1: duas idas à IA (pergunta + nudge + stop)', stub.sent.length === 2, 'turns=' + stub.sent.length);
    check('C1: 2a mensagem foi o nudge de continue', stub.sent[1] && stub.sent[1].includes(NUDGE_MARK), '');
    check('C1: parou ao chamar stop (não fez 3a chamada)', stub.sent.length < 3, 'turns=' + stub.sent.length);
    check('C1: resposta final = texto do turno do stop', final.includes('resposta final'), 'final=' + final.slice(0, 40));
  }

  // Caso 2: agent — IA nunca chama stop. Deve bater no limite de 12 e sinalizar pendência.
  {
    const stub = makeStub(['resposta pura sem stop']); // repetida
    const orch = new AgentOrchestrator(stub);
    let final = '';
    const cbs = Object.assign(noopCallbacks(), { onComplete: (t) => { final = t; } });
    await orch.run('c2', 'trabalho longo', 'fake', 'agent', '/tmp', cbs, {});
    check('C2: atingiu exatamente o limite de 12 turnos', stub.sent.length === 12, 'turns=' + stub.sent.length);
    check('C2: mensagem de limite/retomada presente', final.includes('limite de 12 passos'), '');
  }

  // Caso 3: fast — uma tacada só, sem nudge, mesmo sem stop.
  {
    const stub = makeStub(['resposta rápida']);
    const orch = new AgentOrchestrator(stub);
    let final = '';
    const cbs = Object.assign(noopCallbacks(), { onComplete: (t) => { final = t; } });
    await orch.run('c3', 'oi', 'fake', 'fast', '/tmp', cbs, {});
    check('C3: fast faz exatamente 1 chamada', stub.sent.length === 1, 'turns=' + stub.sent.length);
    check('C3: fast não envia nudge', !stub.sent.some((s) => s.includes(NUDGE_MARK)), '');
  }

  // Caso 4: cancelamento — stop() durante um nudge deve encerrar antes do limite.
  {
    const stub = makeStub(['resposta pura']);
    const orch = new AgentOrchestrator(stub);
    let final = '';
    let errored = false;
    const cbs = Object.assign(noopCallbacks(), {
      onComplete: (t) => { final = t; },
      onError: () => { errored = true; }
    });
    // Cancela no 3º input enviado.
    const origSend = stub.sendPrompt.bind(stub);
    stub.sendPrompt = async (p, input) => {
      const r = await origSend(p, input);
      if (stub.sent.length >= 3) orch.stop('p1');
      return r;
    };
    await orch.run('c4', 'longo', 'fake', 'agent', '/tmp', cbs, {});
    check('C4: cancelamento encerrou antes de 12 turnos', stub.sent.length < 12 && !errored, 'turns=' + stub.sent.length);
  }

  // Caso 5: prompt de sistema deve apresentar a ferramenta stop e a regra de keep-working.
  {
    const stub = makeStub([STOP]);
    const orch = new AgentOrchestrator(stub);
    await orch.run('c5', 'x', 'fake', 'agent', '/tmp', Object.assign(noopCallbacks(), {
      onToolCall() {}
    }), {});
    const sys = stub.sent[0];
    check('C5: system prompt lista a ferramenta "20. stop"', sys.includes('20. stop'), '');
    check('C5: system prompt tem seção KEEP WORKING UNTIL YOU CALL stop', sys.includes('KEEP WORKING UNTIL YOU CALL stop'), '');
  }

  console.log('\n' + (failures === 0 ? 'TODOS OS TESTES DE ACEITAÇÃO PASSARAM' : failures + ' FALHA(S)'));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERRO NO HARNESS:', e); process.exit(2); });
