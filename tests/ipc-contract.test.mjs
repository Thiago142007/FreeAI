import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(import.meta.dirname, '..');
const src = (rel) => path.join(repoRoot, 'src', rel);
const read = (rel) => fs.readFileSync(src(rel), 'utf8');

const preload = read('preload/index.ts');
const handlers = read('main/ipc-handlers.ts');
const mainIndex = read('main/index.ts');
const rendererTypes = read('renderer/src/electron.d.ts');

const channelsOf = (text, kind) => {
  const re = new RegExp("ipcRenderer\\s*\\.\\s*" + kind + "\\s*\\(\\s*'([^']+)'", 'g');
  return [...text.matchAll(re)].map((m) => m[1]);
};

const invokeChannels = channelsOf(preload, 'invoke');
const sendChannels = channelsOf(preload, 'send');
const handleChannels = [...handlers.matchAll(/ipcMain\s*\.\s*handle\s*\(\s*'([^']+)'/g)].map((m) => m[1]);
const onChannels = [...handlers.matchAll(/ipcMain\s*\.\s*on\s*\(\s*'([^']+)'/g)].map((m) => m[1]);
const emitted = [...handlers.matchAll(/webContents\s*\.\s*send\s*\(\s*'([^']+)'/g)].map((m) => m[1]);
const listenedInPreload = [...preload.matchAll(/ipcRenderer\s*\.\s*on\s*\(\s*'([^']+)'/g)].map((m) => m[1]);

test('todo canal invoke do preload tem handler no main', () => {
  const missing = invokeChannels.filter((c) => !handleChannels.includes(c));
  assert.deepEqual(missing, [], 'canais sem ipcMain.handle: ' + missing.join(', '));
});

test('todo canal send do preload tem listener no main', () => {
  const missing = sendChannels.filter((c) => !onChannels.includes(c));
  assert.deepEqual(missing, [], 'canais sem ipcMain.on: ' + missing.join(', '));
});

test('todo evento emitido pelo main tem escuta no preload', () => {
  const orphan = [...new Set(emitted)].filter((c) => !listenedInPreload.includes(c));
  assert.deepEqual(orphan, [], 'o main emite e o renderer nunca escuta: ' + orphan.join(', '));
});

test('a tipagem do renderer declara exatamente o preload exposto', () => {
  const exposed = [...preload.matchAll(/exposeInMainWorld\s*\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(exposed.sort(), ['electronAPI', 'freeai'], 'nomes expostos: ' + exposed.join(', '));
  const anchor = preload.lastIndexOf('exposeInMainWorld(');
  const freeaiPreload = preload.slice(anchor);
  const preloadKeys = new Set([...freeaiPreload.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((m) => m[1]));
  const dts = rendererTypes.slice(rendererTypes.indexOf('freeai?: {'));
  const typeKeys = new Set([...dts.matchAll(/^ {6}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]));
  const missingInTypes = [...preloadKeys].filter((k) => !typeKeys.has(k));
  const phantomInTypes = [...typeKeys].filter((k) => !preloadKeys.has(k));
  assert.deepEqual(missingInTypes, [], 'métodos do preload sem tipo no renderer: ' + missingInTypes.join(', '));
  assert.deepEqual(phantomInTypes, [], 'tipos declarados que o preload não expõe: ' + phantomInTypes.join(', '));
});

test('o renderer usa somente métodos que existem no preload', () => {
  const rendererFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) rendererFiles.push(p);
    }
  };
  walk(path.join(repoRoot, 'src', 'renderer', 'src'));
  const api = preload.slice(preload.indexOf("exposeInMainWorld('freeai'"));
  const methods = new Set([...api.matchAll(/^[ ]+([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((m) => m[1]));
  const bad = [];
  for (const file of rendererFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/window\.freeai\.([A-Za-z0-9_]+)/g)) {
      if (!methods.has(m[1])) bad.push(path.relative(repoRoot, file) + ':' + m[1]);
    }
    for (const m of text.matchAll(/window\.electronAPI\.([A-Za-z0-9_]+)/g)) {
      const electronApi = preload.slice(0, preload.indexOf("exposeInMainWorld('freeai'"));
      const names = new Set([...electronApi.matchAll(/^[ ]+([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((x) => x[1]));
      if (!names.has(m[1])) bad.push(path.relative(repoRoot, file) + ':' + m[1]);
    }
  }
  assert.deepEqual(bad, [], 'chamadas a API inexistente: ' + bad.join(', '));
});

test('nenhum handler de ipc é registrado duas vezes (relanço derrubaria o main)', () => {
  const all = [...handleChannels, ...onChannels];
  const dup = all.filter((c, i) => all.indexOf(c) !== i);
  assert.deepEqual(dup, [], 'canais duplicados: ' + dup.join(', '));
  const registerCalls = (mainIndex + handlers).match(/registerIpcHandlers\(/g) || [];
  assert.ok(registerCalls.length >= 1, 'registerIpcHandlers nunca é chamado');
});
