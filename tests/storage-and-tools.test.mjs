import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require_ = createRequire(import.meta.url);
const repoRoot = path.join(import.meta.dirname, '..');
const distPath = (rel) => path.join(repoRoot, 'dist', 'main', rel);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freeai-store-'));
const electronStub = new Module('electron');
electronStub.filename = 'electron';
electronStub.loaded = true;
electronStub.exports = { app: { getPath: () => tmpRoot }, ipcMain: {}, BrowserWindow: function () {} };
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return 'electron';
  return realResolve.call(this, request, ...rest);
};
require_.cache['electron'] = electronStub;

const store = require_(distPath('storage/store.js'));
const fileTools = require_(distPath('agent/tools/file-tools.js'));
const mem = require_(distPath('agent/tools/memory-tools.js'));

const convRoot = path.join(tmpRoot, 'storage', 'conversations');
const work = () => fs.mkdtempSync(path.join(os.tmpdir(), 'freeai-cwd-'));

test('storage: id de conversa controlado pelo renderer não pode escapar da pasta', () => {
  assert.throws(
    () => store.upsertMessage('../../vitoria', { id: 'm1', role: 'user', content: 'x' }),
    /Invalid conversation id/
  );
  const escaped = path.join(tmpRoot, 'vitoria.json');
  assert.equal(fs.existsSync(escaped), false,
    'conversations:upsertMessage com id "../../vitoria" escreveu ' + escaped +
    ' — id vem direto do renderer, permitindo ler/escrever JSON fora do storage');
});

test('storage: saveConversation posterior não pode apagar mensagens já gravadas', () => {
  const conv = { id: 'conv-2', title: 'T', provider: 'deepseek', mode: 'agent', cwd: work() };
  store.saveConversation(conv);
  store.upsertMessage('conv-2', { id: 'm1', role: 'user', content: 'olá' });
  store.saveConversation({ ...conv, title: 'Renomeada' });
  const written = JSON.parse(fs.readFileSync(path.join(convRoot, 'conv-2.json'), 'utf8'));
  assert.equal(written.messages.length, 1,
    'o segundo saveConversation zerou as mensagens persistidas (restaram ' + written.messages.length + ')');
  assert.equal(written.title, 'Renomeada');
});

test('storage: janela deslizante devolve os trechos pedidos', () => {
  for (let i = 1; i <= 12; i++) {
    store.upsertMessage('conv-window', { id: 'm' + i, role: 'user', content: 'msg ' + i });
  }
  const first = store.getMessageWindow('conv-window', 0, 5);
  assert.equal(first.total, 12);
  assert.deepEqual(first.messages.map((m) => m.content), ['msg 1', 'msg 2', 'msg 3', 'msg 4', 'msg 5']);
  const older = store.getMessageWindow('conv-window', 7, 5);
  assert.equal(older.messages.length, 5, 'trecho final trouxe ' + older.messages.length + ' de 5');
});

test('storage: JSON de conversa corrompido não derruba a listagem', () => {
  fs.writeFileSync(path.join(convRoot, 'quebrado.json'), '{ isto não é json');
  assert.doesNotThrow(() => store.listConversationMeta());
});

test('file-tools: writeToFile cria pastas, sobrescreve e respeita overwrite=false', () => {
  const dir = work();
  const target = path.join(dir, 'a', 'b', 'c.txt');
  assert.equal(fileTools.writeToFile(target, 'conteudo', true).bytesWritten, 8);
  assert.equal(fs.readFileSync(target, 'utf8'), 'conteudo');
  assert.throws(() => fileTools.writeToFile(target, 'x', false), /already exists/);
});

test('file-tools: viewFile numera as linhas corretamente', () => {
  const dir = work();
  const f = path.join(dir, 'lines.txt');
  fs.writeFileSync(f, ['l1', 'l2', 'l3', 'l4'].join('\n'));
  const res = fileTools.viewFile(f, 2, 3);
  assert.equal(res.totalLines, 4);
  assert.equal(res.content, '2: l2\n3: l3', 'devolvido: ' + JSON.stringify(res.content));
});

test('file-tools: replaceFileContent conta as substituições que realmente fez', () => {
  const dir = work();
  const f = path.join(dir, 'rep.txt');
  fs.writeFileSync(f, 'aa\naa\naa');
  const res = fileTools.replaceFileContent(f, 'aa', 'bb');
  const real = (fs.readFileSync(f, 'utf8').match(/bb/g) || []).length;
  assert.equal(res.replacementsCount, real,
    'a ferramenta informou ' + res.replacementsCount + ' substituição mas o arquivo tem ' + real +
    ' — as outras ocorrências ficaram inalteradas e o modelo acredita que trocou tudo');
});

test('memory-tools: replace_section com nome prefixo de outra seção', () => {
  const dir = work();
  const file = path.join(dir, 'FREEAI_MEMORY.md');
  fs.writeFileSync(file, '# Project memory\n\n## Overview\nantiga\n\n## Overview Extra\nvelha\n');
  mem.writeMemory({ cwd: dir, action: 'replace_section', section: 'Overview', content: 'NOVA' });
  const after = fs.readFileSync(file, 'utf8');
  const okOverview = /## Overview\nNOVA/.test(after);
  const okExtra = /## Overview Extra\nvelha/.test(after);
  assert.ok(okOverview && okExtra,
    'replace_section("Overview") atingiu a seção errada (indexOf casa prefixo "Overview Extra"): ' +
    JSON.stringify(after));
});

test('memory-tools: create + append_section preserva os fatos anteriores', () => {
  const dir = work();
  mem.writeMemory({ cwd: dir, action: 'create' });
  mem.writeMemory({ cwd: dir, action: 'append_section', section: 'Overview', content: 'fato 1' });
  mem.writeMemory({ cwd: dir, action: 'append_section', section: 'Overview', content: 'fato 2' });
  const text = fs.readFileSync(path.join(dir, 'FREEAI_MEMORY.md'), 'utf8');
  assert.ok(/fato 1/.test(text) && /fato 2/.test(text),
    'memória final: ' + JSON.stringify(text));
});
