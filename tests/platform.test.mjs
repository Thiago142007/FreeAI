import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require_ = createRequire(import.meta.url);
const { getPlatformAdapter, InputUnavailableError } = require_(
  path.join(import.meta.dirname, '..', 'dist', 'main', 'platform', 'index.js')
);

test('linux: shell bash -c, sandbox flags e quit on close', () => {
  const a = getPlatformAdapter('linux');
  assert.equal(a.label, 'Linux');
  assert.equal(a.shellName, 'bash');
  assert.deepEqual(a.spawnShell('ls -la'), { cmd: 'bash', args: ['-c', 'ls -la'] });
  assert.deepEqual(a.sandboxFlags, ['no-sandbox', 'disable-setuid-sandbox', 'disable-gpu']);
  assert.equal(a.quitOnAllClosed, true);
  assert.equal(a.windowOptions.frame, false);
});

test('darwin: zsh -c, screencapture, sem sandbox flags, janela hiddenInset', () => {
  const a = getPlatformAdapter('darwin');
  assert.equal(a.shellName, 'zsh');
  assert.deepEqual(a.spawnShell('ls'), { cmd: '/bin/zsh', args: ['-c', 'ls'] });
  assert.deepEqual(a.sandboxFlags, []);
  assert.equal(a.quitOnAllClosed, false);
  assert.equal(a.windowOptions.titleBarStyle, 'hiddenInset');
  assert.deepEqual(a.screenCaptureAttempts('/tmp/c.png'), [
    { cmd: 'screencapture', args: ['-x', '/tmp/c.png'] },
  ]);
  assert.throws(
    () => a.inputCommands({ action: 'click', x: 1, y: 2 }),
    (e) => e instanceof InputUnavailableError && e.message.startsWith('UNAVAILABLE in macOS:')
  );
});

test('win32: powershell argv, captura .NET, todo input indisponível', () => {
  const a = getPlatformAdapter('win32');
  assert.equal(a.shellName, 'PowerShell');
  const s = a.spawnShell('Get-Date');
  assert.equal(s.cmd, 'powershell');
  assert.deepEqual(s.args, ['-NoProfile', '-NonInteractive', '-Command', 'Get-Date']);
  assert.equal(a.screenCaptureAttempts("C:\\tmp\\c'x.png").length, 1);
  assert.match(a.screenCaptureAttempts('C:\\t.png')[0].args[3], /CopyFromScreen/);
  assert.throws(
    () => a.inputCommands({ action: 'keyPress', key: 'a' }),
    (e) => e instanceof InputUnavailableError && e.message.startsWith('UNAVAILABLE in Windows:')
  );
});

test('macOS: keyPress digitável vira keystroke; nomeado vira key code', () => {
  const a = getPlatformAdapter('darwin');
  assert.deepEqual(a.inputCommands({ action: 'keyPress', key: 'a' }), [
    { cmd: 'osascript', args: ['-e', 'tell application "System Events" to keystroke "a"'] },
  ]);
  assert.deepEqual(a.inputCommands({ action: 'keyPress', key: 'Return' }), [
    { cmd: 'osascript', args: ['-e', 'tell application "System Events" to key code 36'] },
  ]);
  assert.deepEqual(a.inputCommands({ action: 'type', text: 'o "gato"' }), [
    { cmd: 'osascript', args: ['-e', 'tell application "System Events" to keystroke "o \\"gato\\""'] },
  ]);
});

test('linux: inputCommands mantem paridade xdotool atual', () => {
  const a = getPlatformAdapter('linux');
  assert.deepEqual(a.inputCommands({ action: 'keyPress', key: 'ctrl' }), [
    { cmd: 'xdotool', args: ['key', 'ctrl'] },
  ]);
  assert.deepEqual(a.inputCommands({ action: 'click', button: 'right' }), [
    { cmd: 'xdotool', args: ['click', '3'] },
  ]);
});
