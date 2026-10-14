import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require_ = createRequire(import.meta.url);
const repoRoot = path.join(import.meta.dirname, '..');
const distPath = (rel) => path.join(repoRoot, 'dist', 'main', rel);

const electronStub = new Module('electron');
electronStub.filename = 'electron';
electronStub.loaded = true;
const windowsOpened = [];
electronStub.exports = {
  app: { getPath: () => fs.mkdtempSync(path.join(os.tmpdir(), 'freeai-cfg-')) },
  session: { fromPartition: () => ({ cookies: { get: async () => [] } }) },
  BrowserWindow: function () {
    const win = {
      isDestroyed: () => false,
      loadURL: (u) => { windowsOpened.push(u); return Promise.resolve(); },
      close: () => { },
      webContents: {
        getURL: () => 'about:blank',
        isLoading: () => false,
        isDestroyed: () => false,
        setWindowOpenHandler: () => { },
        executeJavaScript: async () => false
      }
    };
    return win;
  },
  ipcMain: { handle() { }, on() { } }
};
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return 'electron';
  return realResolve.call(this, request, ...rest);
};
require_.cache['electron'] = electronStub;

const { WEB_PROVIDER_CONFIGS } = require_(distPath('browser-engine/providers/provider-configs.js'));
const { BrowserManager } = require_(distPath('browser-engine/browser-manager.js'));
const askUser = require_(distPath('agent/tools/ask-user.js'));

const rendererMeta = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'src', 'provider-meta.ts'), 'utf8');
const rendererIds = [...rendererMeta.matchAll(/\n\s*id:\s*'([a-z0-9]+)'/gi)].map((m) => m[1]);

test('todo provedor listado na UI existe no main', () => {
  const legacy = ['deepseek', 'gemini', 'chatgpt'];
  const known = new Set([...Object.keys(WEB_PROVIDER_CONFIGS), ...legacy]);
  const missing = rendererIds.filter((id) => !known.has(id));
  assert.deepEqual(missing, [],
    'a UI oferece ' + JSON.stringify(missing) + ' mas não há driver no main');
});

test('provedor desconhecido não pode abrir a janela de outro provedor', async () => {
  const mgr = new BrowserManager();
  windowsOpened.length = 0;
  const err = await mgr.sendPrompt('unknown-provider', 'oi', { onToken() { }, onThinking() { } })
    .then(() => null, (e) => e.message);
  assert.ok(err, 'sendPrompt("useai") não lançou erro');
  assert.deepEqual(windowsOpened, [],
    'a UI permite escolher useai; o main abriu ' + JSON.stringify(windowsOpened) +
    ' (conta de outro provedor) antes de falhar com: ' + err);
});

test('provar que o modelo escolhido é aplicado (sem picker o app finge trocar de modelo)', async () => {
  const withModelsNoPicker = Object.values(WEB_PROVIDER_CONFIGS)
    .filter((c) => c.models && c.models.length > 1 && !c.modelPicker)
    .map((c) => c.id);
  assert.deepEqual(withModelsNoPicker, [],
    'questo de escolha: ' + JSON.stringify(withModelsNoPicker) +
    ' publicam modelos na UI mas applyModel é no-op — o usuário seleciona um modelo e o ' +
    'provedor responde com outro, sem nenhum aviso');
});

test('expressões de quota dos provedores são regex válidas e detectam os textos reais', () => {
  const samples = {
    qwen: "You have reached today's usage limit.",
    kimi: 'too many requests, please upgrade',
    glm: 'daily usage limit reached',
    useai: 'You have hit your daily limit'
  };
  for (const [id, text] of Object.entries(samples)) {
    const cfg = WEB_PROVIDER_CONFIGS[id];
    assert.ok(cfg, id + ' sem config');
    let re;
    assert.doesNotThrow(() => { re = new RegExp(cfg.usageLimitRe, 'i'); }, id + ': usageLimitRe inválido');
    assert.equal(re.test(text), true, id + ': quota não detectada em "' + text + '" com regex ' + cfg.usageLimitRe);
  }
});

test('expressões de prontidão/geração dos provedores são JS avaliável', () => {
  for (const [id, cfg] of Object.entries(WEB_PROVIDER_CONFIGS)) {
    for (const key of ['readyExpr', 'generatingExpr', 'loginBlockExpr', 'readExpr', 'errorScanExpr']) {
      const expr = cfg[key];
      assert.ok(expr, id + ' sem ' + key);
      assert.doesNotThrow(() => new Function('return (' + expr + ')'), id + ': ' + key + ' não compila');
    }
    if (cfg.sendSel || cfg.sendExpr) {
      const expr = cfg.sendExpr || 'sent';
      assert.doesNotThrow(() => new Function('return (' + expr + ')'), id + ': sendExpr não compila');
    }
  }
});

test('todas as chaves de config têm correspondência no modelo de dados', () => {
  for (const [id, cfg] of Object.entries(WEB_PROVIDER_CONFIGS)) {
    assert.ok(cfg.chatUrl.startsWith('https://'), id + ' chatUrl');
    assert.ok(/^(textarea|contenteditable)$/.test(cfg.editorKind), id + ' editorKind');
    assert.ok(cfg.sendSel || cfg.sendExpr, id + ' sem forma de enviar');
    if (cfg.models) {
      for (const m of cfg.models) {
        assert.ok(m.id && m.label, id + ' modelo incompleto');
      }
    }
  }
});

test('ask_user: timeout devolve texto mas ignora a resposta dada depois', async () => {
  let emitted;
  const promise = askUser.requestAnswers('r1', 'deepseek',
    { questions: [{ question: 'Cor?', options: ['azul', 'verde'] }] },
    (p) => { emitted = p; });
  assert.equal(emitted.questions.length, 1, 'pergunta não chegou ao renderer');
  const submitted = askUser.submitAnswers('r1', [{ question: 'Cor?', answer: 'azul' }]);
  assert.equal(submitted, true);
  assert.equal((await promise).includes('azul'), true, 'resposta do usuário perdida');
});

test('ask_user: cancelamento por provedor não pode deixar promessa pendente para sempre', async () => {
  let rejected = null;
  const promise = askUser.requestAnswers('r2', 'gemini',
    { questions: [{ question: 'X?', options: ['a'] }] }, () => { });
  const guarded = promise.catch((e) => { rejected = e.message; return 'rejected'; });
  askUser.cancelByProvider('gemini');
  const outcome = await Promise.race([guarded, new Promise((r) => setTimeout(() => r('TIMEOUT'), 500))]);
  assert.equal(outcome, 'rejected', 'ask_user pendente não foi liberado pelo cancelamento');
  assert.match(rejected, /cancelou/i);
});

test('ask_user: recusa perguntas vazias sem travar a corrida', async () => {
  const out = await askUser.requestAnswers('r3', 'deepseek', { questions: [] }, () => { });
  assert.match(out, /Nenhuma pergunta válida/);
});

test('drivers sem sessão lançam erro real (nenhuma simulação de resposta)', async () => {
  const { GenericDriver } = require_(distPath('browser-engine/providers/generic-driver.js'));
  const { DeepSeekDriver } = require_(distPath('browser-engine/providers/deepseek-driver.js'));
  const { GeminiDriver } = require_(distPath('browser-engine/providers/gemini-driver.js'));
  const { ChatGPTDriver } = require_(distPath('browser-engine/providers/chatgpt-driver.js'));
  const cb = { onToken() { }, onThinking() { } };
  const drivers = [
    ['generic/kimi', new GenericDriver(WEB_PROVIDER_CONFIGS.kimi)],
    ['deepseek', new DeepSeekDriver()],
    ['gemini', new GeminiDriver()],
    ['chatgpt', new ChatGPTDriver()]
  ];
  for (const [label, driver] of drivers) {
    await assert.rejects(() => driver.injectAndSend('oi', cb, {}),
      { message: /./ }, label + ' deveria falhar sem webContents');
    const err = await driver.injectAndSend('oi', cb, {}).then(() => null, (e) => e.message);
    assert.match(err, /sessão|internet|headless/i, label + ' com erro inesperado: ' + err);
  }
});
