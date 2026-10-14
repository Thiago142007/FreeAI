# FreeAI — Porte para Windows 10/11 e macOS (design)

> Data: 2026-10-14 · Status: aprovado pelo usuário nas 3 seções · Abordagem: adaptador central de plataforma

## Objetivo

O FreeAI (hoje Linux-only) deve: (a) rodar a partir do código-fonte em Windows 10/11 e macOS;
(b) produzir instaladores oficiais via CI no GitHub Actions — `.exe` (NSIS) e portable no
Windows, `.dmg` (arm64 + x64) e `.zip` no macOS, mantendo o `.deb` no Linux; (c) manter
paridade nativa das ferramentas locais do agente em cada SO. Sem assinatura de código
(o contorno de SmartScreen/Gatekeeper vai documentado no README).

## Non-goals

- Assinar/notarizar binários (Apple Developer, cert Windows).
- Apps da Mac App Store / Microsoft Store.
- `simulate_input` completo no Windows (não há CLI nativa equivalente ao xdotool; o agente
  recebe erro explícito e usa `run_command`).
- CI de UI audit (`test:ui`) fora do Linux.

## Design

### 1. Adaptador de plataforma — `src/main/platform/`

Módulo novo, único ponto do código que conhece `process.platform`. Fábrica
`getPlatformAdapter(platform?: string)` aceita override para testes; exporta:

| Membro | linux | darwin | win32 |
|---|---|---|---|
| `id` | `'linux'` | `'darwin'` | `'win32'` |
| `label` (system prompt/UI) | `Linux` | `macOS` | `Windows` |
| `shell.command/argsPrefix` | `bash -c <cmd>` | `zsh -c <cmd>` | `powershell.exe -NoProfile -NonInteractive -Command <cmd>` |
| `killTree(child, signal)` | grupo `-pid` (SIGTERM→SIGKILL) | idem | `child.kill()` no PID |
| `captureScreen(file)` | `scrot` → fallback `import` | `screencapture -x <file>` | PowerShell + `System.Drawing.CopyFromScreen` em script temporário |
| `simulateInput(actions)` | xdotool (atual) | osascript/System Events: `keyPress`/`type` sim; `moveTo`/`click`/`scroll` → erro explícito | erro explícito «indisponível no Windows» |
| `windowOptions` | `frame:false` | `titleBarStyle:'hiddenInset'` + `trafficLightPosition` | `frame:false` |
| `sandboxFlags` | `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu` | — | — |
| `quitOnAllClosed` | true | false (padrão macOS; `activate` recria a janela) | true |

Consumidores a refactorar (removendo SO-hardcode):

- `run-command.ts` (spawn `bash` e kill win32-inline hoje no arquivo) → usa `shell` e `killTree`.
- `task-runner.ts:30` (spawn `bash`) → idem.
- `desktop-tools.ts` (scrot/import/xdotool) → delega a `captureScreen`/`simulateInput`;
  a validação de argumentos de `simulate_input` (limite 50 ações, regex de teclas) permanece
  na camada da ferramenta, fora do adaptador.
- `SystemPrompts/agent-system-prompt.ts` e `tool-result-feedback.ts`: texto «bash/Linux»
  passa a interpolar `adapter.label`/nome do shell; ferramentas indisponíveis continuam
  listadas no prompt com nota de indisponibilidade (o agente não deve fingir que rodou).
- `ipc-handlers.ts` `system:execute_command` (Terminal embutido) → herda o shell do adaptador
  via `runCommand`.

### 2. Comportamento do app e scripts

- `src/main/index.ts`: switches `app.commandLine.appendSwitch` condicionados a
  `platform === 'linux'`; opções de janela vindas de `adapter.windowOptions`;
  `window-all-closed` respeita `quitOnAllClosed`.
- `TitleBar.tsx`: usa `window.electronAPI.platform` (já exposto no preload) — no macOS,
  esconde os botões Minimize/Maximize/Close e abre padding de ~78px à esquerda para o
  semáforo nativo.
- `package.json` scripts: `dev:main` e congêneres trocam prefixo bash `NODE_ENV=...` por
  `cross-env` (nova devDependency); `test` troca glob `'tests/**/*.test.mjs'` (não expandido
  no PowerShell) por `node --test tests/`; flags `--no-sandbox --disable-gpu` saem dos
  scripts de start (decididas no código por SO). Empacotamento: `pack:linux`, `pack:win`,
  `pack:mac`. Descrição do package: «for Linux, Windows and macOS».
- `start-freeai.sh` permanece para Linux; Windows/macOS usam `npm install → npm run build → npm start`.
- Inalterados (já multi-SO): porta 1111 do Vite, `session-store` em `~/.config/freeai`
  (`os.homedir()` funciona nos três), `defaultCwd` do preload com `USERPROFILE` fallback.

### 3. Empacotamento + CI

- Ícone mestre novo `build/icon.png` 1024×1024 (reamostrado do `icon.png` 128×128 atual com
  Lanczos; commitado; substituível depois). Alimenta linux/win/mac.
- `electron-builder.json`: acrescentar blocos `win` (targets `nsis` + `portable`, x64; NSIS
  `oneClick:false`, `allowToChangeInstallationDirectory:true`) e `mac` (targets `dmg`
  arch `[arm64, x64]` + `zip`; `category: public.app-category.developer-tools`;
  `identity:null`, `hardenedRuntime:false`, `gatekeeperAssess:false`);
  `asarUnpack: ["**/*.wasm"]` para o OpenSCAD WASM carregado no processo main.
- `.github/workflows/build.yml`:
  - `on`: push de tag `v*` + `workflow_dispatch`.
  - job `test`: matriz `ubuntu-latest`, `windows-latest`, `macos-latest` rodando `npm ci`,
    `npm run build:main`, `npm test` — prova de execução nos três SOs.
  - job `package` (needs test): os mesmos três runners; cada um `npm run build` +
    `npm run pack:<so>`; env `CSC_IDENTITY_AUTO_DISCOVERY=false`.
  - artefatos por SO; em tag, rascunho de GitHub Release com os instaladores.
- `test:ui` roda apenas no runner Linux (ferramentas CDP locais).
- Push de código/workflow ao remote só após confirmação explícita do usuário.

## Tratamento de erro

- Shell ausente no PATH (`zsh`/`powershell`): `child.on('error')` já produz
  `Error spawning command:` — manter; mensagem final inclui o nome do shell do adaptador.
- macOS sem permissão de Gravação de Tela / Acessibilidade: `captureScreen`/`simulateInput`
  retornam erro orientando Ajustes do Sistema → Privacidade (detectado por código de saída
  ≠ 0 com saída vazia; não há API de consulta).
- Windows: captura por script temporário PowerShell — script escrito em `os.tmpdir()`,
  apagado no `finally`; falha do .NET vira erro legível do comando.
- Ferramenta indisponível: mensagem começa com `UNAVAILABLE in <SO>: ` para o parser/log da UI
  distinguir de falha comum.

## Testes

- `tests/platform.test.mjs` (novo): matriz das três plataformas × (shell argv, escolha de
  capturador, disponibilidade de simulate_input, quitOnAllClosed, sandboxFlags) como lógica
  pura com override de `platform`.
- `tests/run-command.test.mjs` (ajustar): executar `echo`/`Get-Date`-equivalente pelo shell
  do adaptador da plataforma corrente; timeout/kill continuam testados.
- Suíte existente (`ipc-contract`, `tool-parser`, `gate-and-orchestrator`,
  `providers-and-drivers`, `storage-and-tools`, `renderer-chat-lifecycle`) deve passar
  inalterada nos três SOs no CI.

## Riscos conhecidos

- Ícone reamostrado de 128px fica menos nítido que ícone vetorial nativo.
- Seletores DOM dos provedores podem divergir entre Chromium do Electron em macOS/Windows —
  nada no design muda isso; o CI não testa provedores reais.
- macOS arm64 e x64 num único runner funciona (electron-builder baixa prebuilds), mas é o
  ponto com maior chance de ajuste fino no primeiro run do CI.
