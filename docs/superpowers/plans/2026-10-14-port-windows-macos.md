# FreeAI Windows 10/11 + macOS — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o FreeAI utilizável a partir do código e via instaladores oficiais em Windows 10/11 e macOS, com paridade nativa das ferramentas locais do agente.

**Architecture:** Um adaptador central (`src/main/platform/`) é o único ponto que conhece `process.platform`; ferramentas (`run_command`, tarefas, captura de tela, input, system prompt, janela, flags) consultam suas capacidades. Empacotamento por alvo no electron-builder + matriz de 3 SOs no GitHub Actions (testes e pacotes).

**Tech Stack:** Electron 35, TypeScript, Vite, React 19, node:test (`.mjs` exigindo `dist/` via `createRequire`), electron-builder 26, GitHub Actions, cross-env (nova devDependency).

**Spec:** `docs/superpowers/specs/2026-10-14-port-windows-macos-design.md`

## Global Constraints

- Sem novas dependências de runtime; única adição: `cross-env` (devDependency).
- Node ≥ 20 nas máquinas-alvo (o runner do CI usa 22).
- Nenhuma assinatura de código: mac com `identity: null`, CI com `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Testes em `tests/*.test.mjs` seguem o padrão existente: `createRequire` + caminho em `dist/main/...` (portanto `npm test` compila antes: `npm run build:main && node --test tests/`).
- Erro de ferramenta indisponível começa literalmente com `UNAVAILABLE in <SO>:`.
- Mensagens de UI/prompts em pt-BR onde já existem em pt-BR; textos de system prompt em inglês como hoje.
- Push para o remote (branch main / tag / workflow) SOMENTE com confirmação explícita do usuário naquele momento.
- Verificação de cada tarefa = `npm test` verde; suíte inteira deve continuar passando em Linux (máquina atual).

---

### Task 1: Adaptador de plataforma (`src/main/platform/`)

**Files:**
- Create: `src/main/platform/index.ts`
- Test: `tests/platform.test.mjs`

**Interfaces:**
- Consumes: nada (módulo folha).
- Produces: `getPlatformAdapter(platform?: string): PlatformAdapter`; `PlatformAdapter` com `id`, `label` (`'Linux'|'macOS'|'Windows'`), `shellName` (`'bash'|'zsh'|'PowerShell'`), `spawnShell(command): {cmd,args}`, `killTree(child, signal)`, `screenCaptureAttempts(file): {cmd,args}[]`, `inputCommands(action): {cmd,args}[]` (lança `InputUnavailableError`), `sandboxFlags: string[]`, `windowOptions: Record<string, unknown>`, `quitOnAllClosed: boolean`; tipos `InputAction` e classe `InputUnavailableError` exportados. Consumido pelas Tasks 2–6.

- [ ] **Step 1: Escrever o teste falho** `tests/platform.test.mjs`

```js
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
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run build:main && node --test tests/platform.test.mjs` → falha de módulo não encontrado.
- [ ] **Step 3: Implementar `src/main/platform/index.ts`** (conteúdo completo):

```ts
import { ChildProcess } from 'child_process';

export interface InputAction {
  action: string;
  key?: string;
  x?: number;
  y?: number;
  button?: string;
  text?: string;
  scroll?: string;
  waitMs?: number;
}

export interface ShellInvocation {
  cmd: string;
  args: string[];
}

export class InputUnavailableError extends Error {}

export interface PlatformAdapter {
  id: string;
  label: string;
  shellName: string;
  spawnShell(command: string): ShellInvocation;
  killTree(child: ChildProcess, signal: NodeJS.Signals): void;
  screenCaptureAttempts(file: string): ShellInvocation[];
  inputCommands(a: InputAction): ShellInvocation[];
  sandboxFlags: string[];
  windowOptions: Record<string, unknown>;
  quitOnAllClosed: boolean;
}

const MAC_KEYCODES: Record<string, number> = {
  Return: 36, Tab: 48, Escape: 53, Delete: 51, Space: 49,
  Up: 126, Down: 125, Left: 123, Right: 124,
};

const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const asQuote = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function unixKillTree(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

const xdotoolButton: Record<string, string> = { left: '1', middle: '2', right: '3' };

const linux: PlatformAdapter = {
  id: 'linux',
  label: 'Linux',
  shellName: 'bash',
  spawnShell: (command) => ({ cmd: 'bash', args: ['-c', command] }),
  killTree: unixKillTree,
  screenCaptureAttempts: (file) => [
    { cmd: 'scrot', args: ['--overwrite', file] },
    { cmd: 'import', args: ['-window', 'root', file] },
  ],
  inputCommands: (a) => {
    switch (a.action) {
      case 'keyPress': return [{ cmd: 'xdotool', args: ['key', a.key!] }];
      case 'keyDown': return [{ cmd: 'xdotool', args: ['keydown', a.key!] }];
      case 'keyUp': return [{ cmd: 'xdotool', args: ['keyup', a.key!] }];
      case 'moveTo': return [{ cmd: 'xdotool', args: ['mousemove', String(a.x), String(a.y)] }];
      case 'click': return [{ cmd: 'xdotool', args: ['click', xdotoolButton[a.button || 'left']] }];
      case 'scroll': return [{ cmd: 'xdotool', args: ['click', a.scroll === 'up' ? '4' : '5'] }];
      case 'type': return [{ cmd: 'xdotool', args: ['type', '--delay', '12', a.text!] }];
      default: throw new InputUnavailableError(`UNAVAILABLE in Linux: ação ${a.action}`);
    }
  },
  sandboxFlags: ['no-sandbox', 'disable-setuid-sandbox', 'disable-gpu'],
  windowOptions: { frame: false },
  quitOnAllClosed: true,
};

const darwin: PlatformAdapter = {
  id: 'darwin',
  label: 'macOS',
  shellName: 'zsh',
  spawnShell: (command) => ({ cmd: '/bin/zsh', args: ['-c', command] }),
  killTree: unixKillTree,
  screenCaptureAttempts: (file) => [{ cmd: 'screencapture', args: ['-x', file] }],
  inputCommands: (a) => {
    const say = (body: string) => [{ cmd: 'osascript', args: ['-e', `tell application "System Events" to ${body}`] }];
    if (a.action === 'keyPress') {
      const code = MAC_KEYCODES[a.key!];
      if (code !== undefined) return say(`key code ${code}`);
      if (a.key!.length === 1) return say(`keystroke "${asQuote(a.key!)}"`);
      throw new InputUnavailableError(`UNAVAILABLE in macOS: tecla "${a.key}" sem mapeamento`);
    }
    if (a.action === 'type') return say(`keystroke "${asQuote(a.text!)}"`);
    throw new InputUnavailableError(
      `UNAVAILABLE in macOS: ação ${a.action} exige clique/movimento por coordenada, que o AppleScript nativo não faz`
    );
  },
  sandboxFlags: [],
  windowOptions: { frame: true, titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 12 } },
  quitOnAllClosed: false,
};

const WIN_SCREEN_SCRIPT = (file: string) =>
  `$ErrorActionPreference='Stop';` +
  `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;` +
  `$b=New-Object System.Drawing.Bitmap(` +
  `[System.Windows.Forms.SystemInformation]::VirtualScreen.Width,` +
  `[System.Windows.Forms.SystemInformation]::VirtualScreen.Height);` +
  `$g=[System.Drawing.Graphics]::FromImage($b);` +
  `$g.CopyFromScreen(0,0,0,0,$b.Size);` +
  `$b.Save(${psQuote(file)});` +
  `$g.Dispose();$b.Dispose()`;

const win32: PlatformAdapter = {
  id: 'win32',
  label: 'Windows',
  shellName: 'PowerShell',
  spawnShell: (command) => ({ cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', command] }),
  killTree: (child, signal) => {
    try { child.kill(signal); } catch { /* já morto */ }
  },
  screenCaptureAttempts: (file) => [
    { cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', WIN_SCREEN_SCRIPT(file)] },
  ],
  inputCommands: (a) => {
    throw new InputUnavailableError(
      `UNAVAILABLE in Windows: simulate_input não tem equivalente nativo do xdotool; use run_command com PowerShell`
    );
  },
  sandboxFlags: [],
  windowOptions: { frame: false },
  quitOnAllClosed: true,
};

export function getPlatformAdapter(platform: string = process.platform): PlatformAdapter {
  if (platform === 'darwin') return darwin;
  if (platform === 'win32') return win32;
  return linux;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm run build:main && node --test tests/platform.test.mjs`.
- [ ] **Step 5: Suíte completa** — `npm test` → verde.
- [ ] **Step 6: Commit** — `git add src/main/platform tests/platform.test.mjs && git commit -m "Add platform adapter as the single platform-aware boundary"`

---

### Task 2: `run_command` e tarefas de fundo pelo adaptador

**Files:**
- Modify: `src/main/agent/tools/run-command.ts` (spawn:22 e signalProcessGroup:29-36)
- Modify: `src/main/agent/tools/task-runner.ts` (spawn:30)
- Test: `tests/run-command.test.mjs` (adaptar comandos por SO)

**Interfaces:**
- Consumes: `getPlatformAdapter()`, `spawnShell`, `killTree` (Task 1).
- Produces: `runCommand()` com assinatura inalterada `CommandResult`; `runBackgroundCommand` inalterada. Tasks 3–6 e `ipc-handlers.ts:255` (Terminal) continuam chamando igual.

- [ ] **Step 1: Reescrever `tests/run-command.test.mjs`** para rodar nos 3 SOs (o `dist` ainda chama bash; em Linux o teste passa do mesmo jeito — se ele falhar no passo 2, é porque o assert novo pegou o hardcode):

```js
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
```

- [ ] **Step 2: Rodar** — `npm run build:main && node --test tests/run-command.test.mjs` → o teste 4 falha no Windows/mac por `$BASH_VERSION` vazio quando `SHELL≠bash`; em Linux só o teste 1–3 passam. (Em Linux esta task já fica verde ao final do step 3; a prova real multi-SO vem no CI da Task 9.)
- [ ] **Step 3: Implementar** — `run-command.ts`: trocar linhas 22–26 por:

```ts
import { getPlatformAdapter } from '../../platform';
// dentro de runCommand, antes do new Promise:
const adapter = getPlatformAdapter();
// substituir spawn('bash', ['-c', command], {...}) por:
const shell = adapter.spawnShell(command);
const child = spawn(shell.cmd, shell.args, {
  cwd,
  env: { ...process.env, PAGER: 'cat' },
  detached: process.platform !== 'win32',
});
```

e o corpo de `signalProcessGroup` (linhas 29–36) por `adapter.killTree(child, signal)` (mantendo o guard `if (!child.pid) return;` dentro do adaptador). Em `task-runner.ts:30`: `const sh = getPlatformAdapter().spawnShell(command); const child = spawn(sh.cmd, sh.args, { cwd, env: process.env });`.
- [ ] **Step 4: `npm test`** → verde.
- [ ] **Step 5: Commit** — `git commit -am "Route run_command and background tasks through the platform shell"`

---

### Task 3: Captura de tela por SO

**Files:**
- Modify: `src/main/agent/tools/desktop-tools.ts` (função `screenCapture`, linhas 6–28)
- Test: `tests/platform.test.mjs` (adicionar)

**Interfaces:**
- Consumes: `adapter.screenCaptureAttempts(file)`.
- Produces: `screenCapture(dirPath?: string): Promise<string>` inalterada para o orquestrador (`agent-orchestrator.ts:285`).

- [ ] **Step 1: Adicionar teste** em `tests/platform.test.mjs`:

```js
test('screenCapture: tenta capturadores na ordem do adaptador e propaga último erro', async () => {
  const mod = require_(path.join(import.meta.dirname, '..', 'dist', 'main', 'agent', 'tools', 'desktop-tools.js'));
  // linux sem scrot/import na máquina de teste: deve falhar com mensagem clara, nunca silently
  const r = await mod.screenCapture('/tmp/freeai-cap-test').catch((e) => e);
  const ok = r && typeof r === 'string' ? r.includes('/tmp/freeai-cap-test') : r instanceof Error && /screen_capture/.test(r.message);
  assert.ok(ok, `retorno inesperado: ${r}`);
});
```

- [ ] **Step 2: Rodar** → deve passar ainda (comportamento preservado) — a regressão é impedida pelo teste; ele falha se a nova loop quebrar a ordem/erro.
- [ ] **Step 3: Implementar** — substituir corpo de `screenCapture` por:

```ts
export async function screenCapture(dirPath?: string): Promise<string> {
  const adapter = getPlatformAdapter();
  const dir = dirPath || path.join(os.tmpdir(), 'freeai-captures');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `capture-${Date.now()}.png`);

  const run = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });

  let lastError: unknown;
  for (const attempt of adapter.screenCaptureAttempts(file)) {
    try {
      await run(attempt.cmd, attempt.args);
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) {
    const hint =
      adapter.id === 'darwin'
        ? ' — autorize Gravação de Tela em Ajustes do Sistema → Privacidade e Segurança'
        : '';
    throw new Error(`screen_capture: capturadores de ${adapter.label} falharam: ${String(lastError)}${hint}`);
  }
  if (!fs.existsSync(file)) {
    throw new Error('screen_capture: o capturador não gerou arquivo');
  }
  return `Captura salva em: ${file}`;
}
```

(remover o comentário «Linux real» da linha 7; importar `getPlatformAdapter`.)
- [ ] **Step 4: `npm test`** → verde. Commit: `git commit -am "Select screen capturers per platform via the adapter"`.

---

### Task 4: `simulate_input` por SO

**Files:**
- Modify: `src/main/agent/tools/desktop-tools.ts` (`simulateInput`, linhas 30–115)
- Test: `tests/platform.test.mjs` (adicionar)

**Interfaces:**
- Consumes: `adapter.inputCommands(a)` + `InputUnavailableError` + tipo `InputAction` (Task 1).
- Produces: `simulateInput(actions): Promise<string>` inalterada para o orquestrador (`agent-orchestrator.ts:289`).

- [ ] **Step 1: Adicionar teste**:

```js
test('simulateInput: validação independe do SO e indisponibilidade é explícita', async () => {
  const mod = require_(path.join(import.meta.dirname, '..', 'dist', 'main', 'agent', 'tools', 'desktop-tools.js'));
  await assert.rejects(() => mod.simulateInput([]), /array não vazio/);
  await assert.rejects(() => mod.simulateInput([{ action: 'telepatia' }]), /ação desconhecida/);
  await assert.rejects(() => mod.simulateInput([{ action: 'keyPress', key: '$@#' }]), /tecla inválida/);
});
```

- [ ] **Step 2: Rodar** → passa (validação preservada).
- [ ] **Step 3: Implementar** — em `simulateInput`, manter todo o bloco de validação (linhas 43–88) e substituir o laço de execução (linhas 90–114) por:

```ts
const adapter = getPlatformAdapter();
const run = (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(new Error(`simulate_input (${cmd} ${args.join(' ')}): ${err.message}`)) : resolve()));
  });

for (const a of actions) {
  if (a.action === 'wait') {
    await new Promise((r) => setTimeout(r, a.waitMs));
    continue;
  }
  const cmds = adapter.inputCommands(a); // lança InputUnavailableError com "UNAVAILABLE in <SO>: ..."
  for (const c of cmds) await run(c.cmd, c.args);
}
return `OK: ${actions.length} ações executadas (${adapter.label}: ${adapter.shellName})`;
```

Deletar `buttonCode` e o switch local (agora no adaptador). Erros `InputUnavailableError` propagam a mensagem sem wrapper.
- [ ] **Step 4: `npm test`** → verde. Commit: `git commit -am "Dispatch simulate_input through adapter with explicit unavailability"`.

---

### Task 5: System prompt e rótulos por SO

**Files:**
- Modify: `src/main/SystemPrompts/agent-system-prompt.ts` (linhas 51, 75, 83, 88, 103, 109/114, 119)
- Modify: `src/main/SystemPrompts/tool-result-feedback.ts` (linha 12)
- Modify: `src/main/agent/agent-orchestrator.ts` (case `run_command` em `getDisplayName`, linha 338–339)
- Test: `tests/platform.test.mjs` (adicionar)

**Interfaces:**
- Consumes: `getPlatformAdapter().label/shellName`.
- Produces: `getAgentSystemPrompt(cwd, hasProject?)` e `buildToolResultFeedback(results)` com assinaturas inalteradas.

- [ ] **Step 1: Adicionar teste**:

```js
test('system prompt descreve o SO real, nunca texto fixo de Linux', () => {
  const { getAgentSystemPrompt } = require_(
    path.join(import.meta.dirname, '..', 'dist', 'main', 'SystemPrompts', 'agent-system-prompt.js')
  );
  const a = getPlatformAdapter();
  const p = getAgentSystemPrompt('/tmp', true);
  assert.ok(p.includes(`Operating System: ${a.label}`), 'cabecalho de SO');
  assert.ok(p.includes(`${a.shellName} command on the local ${a.label} system`), 'run_command');
  assert.ok(!/Linux/.test(p) || a.label === 'Linux', 'Linux hardcoded fora do SO linux');
});

test('tool result feedback usa o SO do adaptador', () => {
  const { buildToolResultFeedback } = require_(
    path.join(import.meta.dirname, '..', 'dist', 'main', 'SystemPrompts', 'tool-result-feedback.js')
  );
  const a = getPlatformAdapter();
  assert.ok(buildToolResultFeedback(['x']).includes(`local ${a.label} system`));
});
```

- [ ] **Step 2: Rodar** → falha (textos hoje hardcoded «Linux», sem interpolação).
- [ ] **Step 3: Implementar** — no prompt: no topo do arquivo `import { getPlatformAdapter } from '../platform';` + `const adapter = getPlatformAdapter();` (chamada tardia dentro das funções é preferível para testes — usar `getPlatformAdapter()` dentro de `getAgentSystemPrompt`/`toolList`). Substituir:
  - linha 51: `Execute a ${adapter.shellName} command on the local ${adapter.label} system.`
  - linha 75: `Start a long-running ${adapter.shellName} command in the background...`
  - linha 83: `Capture the user's ${adapter.label} desktop as a PNG file...`
  - linha 88: descrição de simulate_input → em `win32`: `(UNAVAILABLE on Windows — calls return an error; use run_command instead)`; em `darwin`: `(via AppleScript: keyPress and type only; pointer actions return UNAVAILABLE)`; linux: texto atual com `xdotool`.
  - linhas 103/109/114: `running locally on ${adapter.label}` e `- Operating System: ${adapter.label} ${process.arch}`.
  - linha 119: `local ${adapter.label} tools`.
  - `tool-result-feedback.ts:12`: `on the local ${getPlatformAdapter().label} system`.
  - `agent-orchestrator.ts` getDisplayName run_command: `` `Terminal ${getPlatformAdapter().shellName}` ``.
- [ ] **Step 4: `npm test`** → verde. Commit: `git commit -am "Describe the real operating system in agent prompts and labels"`.

---

### Task 6: Flags, janela e TitleBar por SO

**Files:**
- Modify: `src/main/index.ts` (linhas 7–10, 19–34, 56–58)
- Modify: `src/renderer/src/components/layout/TitleBar.tsx` (30–34, 70–101)
- Test: verificação visual via CDP (projeto já usa este método)

**Interfaces:**
- Consumes: `adapter.sandboxFlags/windowOptions/quitOnAllClosed`.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: `src/main/index.ts`** — substituir linhas 7–10 por:

```ts
import { getPlatformAdapter } from './platform';
const platformAdapter = getPlatformAdapter();
for (const flag of platformAdapter.sandboxFlags) app.commandLine.appendSwitch(flag);
```

No `new BrowserWindow({...})`: manter as chaves atuais mas **remover** `frame:false` e `titleBarStyle:'hidden'` fixos e espalhar `...platformAdapter.windowOptions` depois delas. Em `window-all-closed`: `if (platformAdapter.quitOnAllClosed) app.quit();` (o handler `activate` existente já recria a janela no padrão macOS).
- [ ] **Step 2: `TitleBar.tsx`** —

```tsx
const isMac = window.electronAPI?.platform === 'darwin';
```

No `<header>`: trocar `px-3` por `` `ps-3 ${isMac ? 'pl-[74px]' : 'pl-3'}` `` mantendo o resto. Envolver o bloco «Right side: Window controls» (linhas 70–101) em `{!isMac && ( ... )}`.
- [ ] **Step 3: `npm run build` + `npm test`** → verde.
- [ ] **Step 4: Smoke visual (Linux, sem regressão)** — subir `npm run dev` e conferir via CDP (`electron --remote-debugging-port`, método do repo) que a janela abre com controles custom e sem flags novas em não-Linux; em Linux o comportamento deve ser idêntico ao atual.
- [ ] **Step 5: Commit** — `git commit -am "Apply sandbox flags and window chrome through the platform adapter"`.

---

### Task 7: Scripts npm multi-SO + cross-env

**Files:**
- Modify: `package.json` (scripts 7–19, devDependencies, description)

**Interfaces:**
- Produces: `pack:linux`, `pack:win`, `pack:mac`, `test` compatível com cmd/PowerShell — consumidos pela Task 8/9 e README.

- [ ] **Step 1: `npm i -D cross-env`**
- [ ] **Step 2: Reescrever scripts**:

```json
"dev:main": "tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json && cross-env NODE_ENV=development electron .",
"start": "electron .",
"pack:linux": "electron-builder --linux",
"pack:win": "electron-builder --win",
"pack:mac": "electron-builder --mac",
"build:deb": "npm run build && electron-builder --linux deb",
"test": "npm run build:main && node --test tests/",
```

(remove `pack` antigo; flags `--no-sandbox --disable-gpu` saem dos scripts — decisão agora vive no adaptador.) Descrição: `FreeAI - AI Agent Desktop for Linux, Windows and macOS`.
- [ ] **Step 3: `npm test`** → verde (`node --test tests/` resolve os 8+ arquivos por descoberta padrão).
- [ ] **Step 4: Commit** — `git commit -m "Make npm scripts cross-platform" -- package.json package-lock.json`.

---

### Task 8: Ícone mestre + electron-builder win/mac

**Files:**
- Create: `build/icon.png` (1024×1024)
- Modify: `electron-builder.json`

**Interfaces:**
- Produces: config de empacotamento para os 3 SOs; consumida pela Task 9.

- [ ] **Step 1: Gerar ícone 1024** (Pillow já presente na máquina):

```bash
mkdir -p build && python3 - <<'PY'
from PIL import Image
im = Image.open('src/renderer/public/icon.png').convert('RGB')
im.resize((1024, 1024), Image.LANCZOS).save('build/icon.png')
PY
file build/icon.png   # esperar: PNG image data, 1024 x 1024
```

- [ ] **Step 2: `electron-builder.json`** — substituir o bloco `linux.icon` por `build/icon.png` e acrescentar:

```json
"win": {
  "target": [{ "target": "nsis", "arch": ["x64"] }, { "target": "portable", "arch": ["x64"] }],
  "icon": "build/icon.png"
},
"nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true },
"mac": {
  "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }, "zip"],
  "icon": "build/icon.png",
  "category": "public.app-category.developer-tools",
  "identity": null,
  "hardenedRuntime": false,
  "gatekeeperAssess": false
},
"asarUnpack": ["**/*.wasm"]
```

- [ ] **Step 3: Validar build Linux local** — `npm run build && npm run pack:linux` → `.deb` gerado como antes (wasm unpack não pode quebrar o pacote).
- [ ] **Step 4: Commit** — `git add build/icon.png electron-builder.json && git commit -m "Add win/mac packaging targets with shared icon"`.

---

### Task 9: CI GitHub Actions (testes + pacotes nos 3 SOs)

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: scripts `pack:linux|win|mac` (Task 7) e config (Task 8).
- Produces: artefatos de release.

- [ ] **Step 1: Escrever o workflow** (conteúdo completo):

```yaml
name: build
on:
  push:
    tags: ['v*']
  workflow_dispatch:
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
  package:
    needs: test
    strategy:
      matrix:
        include:
          - { os: ubuntu-latest, pack: linux }
          - { os: windows-latest, pack: win }
          - { os: macos-latest, pack: mac }
    runs-on: ${{ matrix.os }}
    env:
      CSC_IDENTITY_AUTO_DISCOVERY: 'false'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm run pack:${{ matrix.pack }}
      - uses: actions/upload-artifact@v4
        with: { name: freeai-${{ matrix.os }}, path: release/* }
      - if: github.event_name == 'push'
        uses: softprops/action-gh-release@v2
        with:
          files: release/*
          draft: true
```

- [ ] **Step 2: Revisar o YAML** — `git add .github/workflows/build.yml` e conferir a indentação relendo o arquivo; a validação real de sintaxe acontece no run do Actions (Step 4), que é o veredito.
- [ ] **Step 3: PEDIR CONFIRMAÇÃO DO USUÁRIO para o push** (estado compartilhado). Após sim: `git push origin main`.
- [ ] **Step 4: Disparar e acompanhar** — `gh workflow run build.yml && sleep 20 && gh run list --workflow build.yml --limit 1` e monitorar `gh run watch` até os 3 jobs de teste passarem; corrigir divergências por SO (ponto mais provável: dmg x64 no runner arm).
- [ ] **Step 5: Commit do workflow** (junto com o push do step 3): `git commit -m "Add cross-platform test and packaging CI"`.

---

### Task 10: README multi-SO + estado da spec

**Files:**
- Modify: `README.md`
- Modify: `FREEAI_PROJECT_SPEC_AND_STATE.md` (SO alvo)

- [ ] **Step 1: README** — seções: Pré-requisitos (Node ≥20 nas 3 plataformas); Executar do código (`npm install → npm run build → npm start` / `npm run dev`); Instaladores (link à release; Win10/11: SmartScreen «Mais informações → Executar assim mesmo»; macOS: clique direito → Abrir na 1ª vez, ou `xattr -dr com.apple.quarantine /Applications/FreeAI.app`); matriz de recursos por SO (simulate_input: indisponível no Windows, só teclado no macOS; capturas exigem permissão no macOS); Ferramentas de agente: shell de cada SO.
- [ ] **Step 2: `FREEAI_PROJECT_SPEC_AND_STATE.md`** — linha «Sistema Operacional Alvo» → `Linux / Windows 10-11 / macOS`.
- [ ] **Step 3: `npm test`** → verde. **Step 4: Commit** — `git commit -am "Document Windows and macOS usage and feature matrix"`.
