# FreeAI — Especificação Técnica, Arquitetura & Estado do Projeto

> **Versão do Documento:** 2.0.0 (FINAL)
> **Data de Conclusão:** 2026-10-12
> **Sistema Operacional Alvo:** Linux (Ubuntu / Debian / Arch / Fedora), Windows 10/11 e macOS
> **Repositório:** raiz do projeto
> **Status Atual:** implementação compilada; valide os recursos no ambiente de destino antes de distribuir.

---

## 1. Visão Geral do Projeto

O **FreeAI** é um cliente desktop independente para Linux, com fluxos de trabalho inspirados em IDEs com agentes de IA. Não é afiliado, endossado ou oficialmente relacionado ao Google, à OpenAI ou à DeepSeek.

### A Diferença Fundamental (O Diferencial do FreeAI)
O **FreeAI** permite executar fluxos de agente autônomo (incluindo execução de terminal local, leitura/edição de arquivos e criação de artefatos) usando as interfaces web dos provedores, sem integração direta com APIs pagas. A disponibilidade, os limites e os termos de cada provedor se aplicam.

Para isso, o FreeAI usa janelas Chromium ocultas gerenciadas pelo Electron para conectar-se às interfaces web dos provedores. O projeto `browser39` foi consultado como referência, mas não é executado pela implementação atual:
1. **DeepSeek** (`https://chat.deepseek.com`) — com suporte total ao DeepSeek-V3 e DeepSeek-R1 (raciocínio profundo `DeepThink`).
2. **Google Gemini** (`https://gemini.google.com`) — Gemini 2.5 Flash / Pro.
3. **OpenAI ChatGPT** (`https://chatgpt.com`) — GPT-4o, o1, o3-mini.

O usuário escolhe um provedor na interface do FreeAI. O motor de automação em segundo plano interage com as páginas web, extrai respostas em streaming e pode executar ferramentas no sistema Linux do usuário.

---

## 2. Referências Técnicas

Estas são referências consultadas durante o desenvolvimento. Verifique as licenças e mantenha atribuições ao reutilizar código:

1. **`browser39` (`https://github.com/alejandroqh/browser39.git`)**:
  - Referência técnica consultada; não é uma dependência nem um processo executado pelo FreeAI atualmente.
   - Navegador headless ultra-leve e focado em agentes de IA, construído em Rust.
   - Execução de JavaScript via V8 (`deno_core`), manipulação do DOM e geração de Markdown com economia máxima de tokens.
   - Persistência automática e criptografada (AES-256-GCM) de cookies e sessões de usuário, permitindo manter o login do DeepSeek/Gemini/ChatGPT ativo permanentemente.
   - Suporte nativo a MCP (Model Context Protocol) e IPC via JSONL.

2. **`ZeroScript-Free` (`https://github.com/sebattfg/ZeroScript-Free.git`)**:
  - Exemplos de automação de interfaces web de IA, incluindo scripts dedicados para DeepSeek, Gemini e ChatGPT.
  - Interação com caixas de entrada, detecção de estados de geração e extração de respostas; o comportamento pode mudar quando os provedores atualizam suas páginas.
   - Mecanismo de tool-calling adaptado para chats web: injeção de prompt de sistema que instrui a IA a responder em blocos estruturados de ferramentas, executados pela máquina local.

---

## 3. Arquitetura do Sistema

O FreeAI é estruturado em 4 camadas modulares e escaláveis:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FREEAI DESKTOP (LINUX)                          │
├────────────────────────────────────────────────────────────────────────┤
│  CAMADA 1: INTERFACE GRÁFICA DO FREEAI                                 │
│  - Electron + React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons   │
│  - Activity Bar, Sidebar de Conversas, Chat Canvas, Painel Auxiliar   │
│  - Prompt Box com seletores de Modelo (DeepSeek/Gemini/ChatGPT) & Modo │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC / WebSocket Local
┌───────────────────────────────────▼────────────────────────────────────┐
│  CAMADA 2: ORQUESTRADOR DO AGENTE (AGENT LOOP & TOOL RUNNER)           │
│  - Gerenciamento de Histórico e Conversas                             │
│  - Injeção do System Prompt com Definição das Ferramentas             │
│  - Parser de Tool Calls (JSON / XML / DSML / Marcadores Especiais)     │
│  - Execução de Ferramentas Locais:                                     │
│      * run_command: Execução segura em bash no Linux                   │
│      * view_file / replace_file_content / write_to_file                │
│      * search_web / schedule / manage_task                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC / Driver Bridge
┌───────────────────────────────────▼────────────────────────────────────┐
│  CAMADA 3: HEADLESS BROWSER ENGINE (BACKGROUND AUTOMATION)             │
│  - Chromium do Electron em janelas BrowserWindow ocultas               │
│  - Execução 100% oculta em background (sem GUI de navegador)           │
│  - Drivers Específicos:                                                │
│      * DeepSeek Driver: DOM chat.deepseek.com, DeepThink parser        │
│      * Gemini Driver: DOM gemini.google.com, streaming parser          │
│      * ChatGPT Driver: DOM chatgpt.com, SSE / response monitor         │
│  - Transmissão de tokens e blocos de pensamento em tempo real via IPC  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Sessões persistentes do Electron
┌───────────────────────────────────▼────────────────────────────────────┐
│  CAMADA 4: GERENCIADOR DE SESSÕES & AUTENTICAÇÃO                       │
│  - Login inicial assistido (WebView/janela modal única para autenticar)│
│  - Armazenamento persistente de cookies, LocalStorage e tokens         │
│  - Reconexão automática transparente sem intervenção do usuário        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Especificação da Interface do FreeAI

A interface do FreeAI organiza conversas, ferramentas locais e configurações dos provedores em uma janela desktop:

### 4.1. Design Tokens & Paleta de Cores
- **Fundo Principal (Canvas/Work area):** `#0e1015` (Deep Obsidian Dark)
- **Fundo Secundário (Sidebars, Menus):** `#14171f`
- **Fundo de Cards e Inputs:** `#1a1d26`
- **Bordas e Divisórias:** `#262a36` (fina, 1px)
- **Cores de Destaque (Accent):**
  - Azul de destaque: `#3b82f6` (Glow: `rgba(59, 130, 246, 0.15)`)
  - Roxo/Índigo (Planejamento/Raciocínio): `#818cf8`
  - Verde de Sucesso/Pronto: `#10b981`
  - Âmbar de Processando/Aviso: `#f59e0b`
  - Vermelho de Erro/Parada: `#ef4444`
- **Tipografia:**
  - Interface: `Inter`, `system-ui`, `-apple-system`, `sans-serif`
  - Código & Terminal: `JetBrains Mono`, `Fira Code`, `monospace`

### 4.2. Layout dos Componentes

#### A. Barra Superior (Window Titlebar)
- Título do Projeto e diretório de trabalho ativo.
- Indicador de status do backend (`Headless Engine: Online [DeepSeek]`)
- Controles de janela nativos do Linux (Minimizar, Maximizar, Fechar)

#### B. Activity Bar (Barra de Ações Lateral Esquerda — 48px de largura)
- Ícones estilizados com tooltip e estado ativo:
  1. **Conversas / Chat** (`MessageSquare`)
  2. **Explorador de Arquivos do Projeto** (`FolderTree`)
  3. **Tarefas Agendadas & Automations** (`Clock`)
  4. **Skills, Plugins & MCP** (`Boxes`)
  5. **Configurações Gerais** (`Settings`) — no rodapé da barra

#### C. Sidebar Secundária (Retrátil — 260px a 300px)
- Botão destacado de **`+ Nova Conversa`**
- Campo de busca de histórico
- Lista de sessões anteriores agrupadas por data (Hoje, Ontem, Últimos 7 dias)
- Menu de contexto para renomear, duplicar ou excluir conversas

#### D. Chat Canvas (Painel Central Principal)
- **Header da Sessão:**
  - Título da conversa editável
  - Pílula do diretório de trabalho atual (CWD) com opção de troca rápida
  - Pílula de Modo do Agente: `Agent` | `Planning` | `Fast`
  - Pílula de Seleção do Provedor:
    - `DeepSeek (DeepThink R1)`
    - `Google Gemini 2.5`
    - `ChatGPT (GPT-4o / o1)`
    - Indicador de status (bolinha verde quando a sessão web headless está conectada e pronta)
- **Feed de Mensagens:**
  - **Mensagens do Usuário:** Alinhadas ou estilizadas em cartões limpos com pílulas de arquivos anexados e data/hora.
  - **Mensagens do Agente:**
    - **Accordion de "Thinking..." (Raciocínio):** Caixa retrátil com gradiente sutil, contador de tempo de pensamento em segundos e texto completo do raciocínio (extraído diretamente do `.ds-think-content` do DeepSeek R1 ou raciocínio equivalente).
    - **Pílulas de Etapas de Ação:** Badges dinâmicos indicando ações em curso (ex: *"Analisando diretório"*, *"Executando comando no terminal"*, *"Editando arquivo"*).
    - **Cards de Execução de Ferramentas (Tool Calls):**
      - Cabeçalho com o nome da ferramenta (`run_command`, `replace_file_content`, etc.)
      - Badge de status (`Executando...`, `Concluído`, `Falhou`)
      - Visualizador de código/parâmetros em abas (`Entrada`, `Saída / Logs`)
      - Saída com renderização ANSI/Terminal e botão de cópia.
    - **Conteúdo Markdown:** Suporte a KaTeX (fórmulas matemáticas), Mermaid (diagramas de fluxo e sequência), realce de sintaxe em blocos de código com botão de cópia rápida.
    - **Cards de Artefatos:** Links para documentos gerados e visualizações.
- **Caixa de Entrada (Prompt Box):**
  - Caixa flutuante arredondada com borda sutil e foco iluminado (glow).
  - Textarea expansível com suporte a atalhos:
    - `/` abre o menu popover de **Slash Commands** (`/goal`, `/plan`, `/schedule`, `/browser`, `/learn`).
    - `@` abre o menu popover de **Menções de Contexto** (Arquivos do projeto, sessões de terminal, regras).
  - Barra de Ferramentas Inferior da Caixa:
    - Seletor rápido de modelo: `[ DeepSeek ▾ ]`
    - Seletor rápido de modo: `[ Agent ▾ ]`
    - Botão toggle de Pesquisa Web
    - Botão de Anexo (clipe de papel para imagens e arquivos)
    - Botão de Enviar / Parar (círculo com seta para cima que se transforma em quadrado vermelho quando a resposta está sendo gerada).

#### E. Painel Auxiliar Direito
- Abas superiores:
  1. **Artefatos (`Artifacts`):** Pré-visualização de documentos Markdown gerados, diagramas e relatórios.
  2. **Subagentes (`Subagents`):** Monitoramento de tarefas paralelas e agentes filhos.
  3. **Tarefas de Fundo (`Background Tasks`):** Processos de longa duração em execução.
  4. **Terminal (`Terminal`):** Terminal embutido no Linux para inspeção manual.
  5. **Monitor Headless (`Browser Viewport`):** Aba de diagnóstico onde o usuário pode visualizar uma captura/status da aba headless em background (útil para verificar se o DeepSeek solicitou CAPTCHA ou se a página está pronta).

---

## 5. Funcionamento dos Modelos via Navegador Headless em Background

### 5.1. Fluxo de Execução dos Modelos

```
[ Usuário digita prompt no FreeAI ]
               │
               ▼
[ FreeAI Agent Orchestrator ]
  1. Constrói o histórico da conversa
  2. Injeta o System Prompt com a definição das ferramentas do Linux
  3. Envia o payload de texto para o Headless Browser Engine
               │
               ▼
[ Chromium do Electron (BrowserWindow oculto / driver em background) ]
  1. Localiza a sessão ativa (ex: chat.deepseek.com)
  2. Encontra o elemento <textarea> do chat
  3. Injeta o texto via eventos nativos do DOM ('input', 'change')
  4. Localiza o botão primário de envio e simula o clique
               │
               ▼
[ Monitoramento de Resposta em Tempo Real (Observer Loop) ]
  1. Detecta o início da geração (presença do botão de Stop ou classe .ds-loading)
  2. Se houver bloco de pensamento (DeepThink), extrai o texto de .ds-think-content
     e envia para a UI como evento 'agent:thinking'
  3. Extrai o corpo da resposta em streaming e envia como 'agent:token'
  4. Detecta o fim da geração (desaparecimento do botão Stop, retorno do botão Send)
               │
               ▼
[ Parser de Ferramentas do FreeAI ]
  1. Examina a resposta da IA em busca de blocos estruturados:
     - Formato JSON: {"tool": "run_command", "parameters": {"command": "ls -la"}}
     - Formato XML/Tag: <tool_call name="view_file"><path>...</path></tool_call>
     - Formato DSML (nativo do DeepSeek): <|DSML|>tool_calls>...
  2. SE houver tool call:
     a. FreeAI executa a ferramenta localmente no Linux (bash, filesystem)
     b. Captura o resultado (stdout/stderr ou conteúdo do arquivo)
     c. Formata a resposta como retorno da ferramenta
     d. Injeta automaticamente de volta no navegador headless
     e. O ciclo continua de forma autônoma!
  3. SE NÃO houver mais tool calls:
     a. Finaliza o turno do agente
     b. Apresenta o resultado final ao usuário no Chat Canvas
```

### 5.2. Gestão de Autenticação e Sessões
- Na primeira utilização de cada provedor (DeepSeek, Gemini ou ChatGPT), o FreeAI oferece o botão **"Conectar Conta"**.
- Ao clicar, uma janela WebView leve de login é aberta para que o usuário faça login manualmente (com usuário/senha ou Google Login).
- Uma vez autenticado, a sessão fica em uma partição persistente do Electron; metadados de autenticação são mantidos em `~/.config/freeai/sessions.json`. O app não implementa criptografia própria para esses dados.
- Nas próximas execuções, o **navegador roda 100% invisível em background**, reutilizando essa sessão gravada. O usuário nunca mais precisa ver a interface web externa.

---

## 6. Ferramentas Locais Disponíveis para o Agente no Linux

O agente possui acesso ao conjunto completo de ferramentas nativas do Linux:

| Ferramenta | Parâmetros | Descrição |
|---|---|---|
| `run_command` | `command`, `cwd`, `timeout_ms` | Executa comandos no shell Bash do Linux (compilação, git, testes, scripts). |
| `view_file` | `path`, `start_line`, `end_line` | Lê arquivos locais com suporte a paginação de linhas. |
| `write_to_file` | `path`, `content`, `overwrite` | Cria novos arquivos no sistema de arquivos local. |
| `replace_file_content` | `path`, `target_content`, `replacement_content` | Realiza substituições cirúrgicas em arquivos existentes. |
| `search_files` | `directory`, `pattern` | Procura por arquivos ou padrões de texto no projeto. |
| `list_directory` | `path` | Lista arquivos e diretórios recursivamente. |
| `search_web` | `query` | Realiza pesquisas web rápidas para obter documentações e referências. |

---

## 7. Estrutura de Diretórios Planejada do FreeAI

A estrutura do projeto na raiz do repositório é organizada da seguinte forma:

```
FreeAI/
├── .references/                         # Repositórios clonados para consulta (browser39, ZeroScript-Free)
├── FREEAI_PROJECT_SPEC_AND_STATE.md    # Este documento master de especificação e estado
├── package.json                         # Dependências principais do app
├── tsconfig.json                        # Configuração do TypeScript
├── electron-builder.json                # Configurações de empacotamento Linux (AppImage, .deb)
│
├── src/
│   ├── main/                            # Processo Principal do Electron (Node.js)
│   │   ├── index.ts                     # Ponto de entrada do Electron, gerenciamento de janelas
│   │   ├── ipc-handlers.ts              # Handlers de comunicação IPC com o frontend
│   │   ├── agent/                       # Núcleo do Agente Autônomo
│   │   │   ├── agent-orchestrator.ts    # Loop de execução do agente e controle de turnos
│   │   │   ├── system-prompt.ts         # Prompts de sistema com definição de tools
│   │   │   ├── tool-parser.ts           # Parser de chamadas de ferramentas (JSON, XML, DSML)
│   │   │   └── tools/                   # Implementação das ferramentas locais
│   │   │       ├── run-command.ts       # Executor de comandos Bash no Linux
│   │   │       ├── file-tools.ts        # view_file, write_to_file, replace_file_content
│   │   │       └── search-tools.ts      # Busca em arquivos e diretórios
│   │   │
│   │   ├── browser-engine/              # Submotor do Navegador Headless
│   │   │   ├── browser-manager.ts       # Gerenciador de ciclo de vida do browser headless
│   │   │   ├── session-store.ts         # Metadados de sessão dos provedores
│   │   │   └── providers/               # Adaptadores dos provedores web (DOM controllers)
│   │   │       ├── deepseek-driver.ts   # Automação chat.deepseek.com (DeepThink, markdown)
│   │   │       ├── gemini-driver.ts     # Automação gemini.google.com
│   │   │       └── chatgpt-driver.ts    # Automação chatgpt.com
│   │   │
│   │   └── auth/                        # Gerenciador de Login Único
│   │       └── login-window.ts          # Janela temporária de login para autenticação inicial
│   │
│   ├── preload/                         # Script de pré-carregamento com contextBridge
│   │   └── index.ts                     # APIs expostas com segurança para o React
│   │
│   └── renderer/                        # Interface Gráfica (React + Tailwind CSS)
│       ├── index.html                   # HTML base
│       ├── src/
│       │   ├── main.tsx                 # Montagem do React
│       │   ├── App.tsx                  # Estrutura principal da interface
│       │   ├── styles/
│       │   │   ├── globals.css          # Variáveis de tema e estilos da interface
│       │   │   └── markdown.css         # Estilização de código, tabelas, diffs
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── TitleBar.tsx     # Barra de título Linux
│       │   │   │   ├── ActivityBar.tsx  # Barra vertical esquerda (Chat, Files, Settings)
│       │   │   │   ├── Sidebar.tsx      # Histórico de conversas e explorador
│       │   │   │   └── AuxiliaryPane.tsx# Painel direito (Artefatos, Terminal, Browser Monitor)
│       │   │   ├── chat/
│       │   │   │   ├── ChatCanvas.tsx   # Área central de mensagens
│       │   │   │   ├── MessageItem.tsx  # Mensagem de usuário e agente
│       │   │   │   ├── ThinkingAccordion.tsx # Raciocínio profundo expansível
│       │   │   │   ├── ToolCallCard.tsx # Cartão de execução de comandos/arquivos
│       │   │   │   └── PromptBox.tsx    # Caixa de entrada com seletores
│       │   │   └── common/
│       │   │       ├── ModelSelector.tsx # Dropdown DeepSeek / Gemini / ChatGPT
│       │   │       ├── ModeSelector.tsx  # Dropdown Agent / Planning / Fast
│       │   │       └── StatusBadge.tsx   # Indicador de conexão da sessão web
│       │   └── store/                   # Gerenciamento de estado (Zustand)
│       │       ├── chat-store.ts        # Mensagens, conversas ativas
│       │       └── settings-store.ts    # Provedor ativo, opções do agente
```

---

## 8. Implementação & Roadmap

Todas as 6 fases do projeto foram implementadas, testadas e integradas com sucesso:

- [x] **Fase 1: Especificação Completa e Arquitetura do Sistema** ✅
  - Análise dos repositórios de referência (`browser39` e `ZeroScript-Free`).
  - Mapeamento completo dos seletores DOM do DeepSeek, Gemini e ChatGPT.
  - Definição da interface visual do FreeAI.
  - Criação deste documento master de continuidade (`FREEAI_PROJECT_SPEC_AND_STATE.md`).

- [x] **Fase 2: Frontend, Interface Gráfica (UI) e experiência do usuário** ✅
  - Estrutura base Electron + Vite + React 19 + TypeScript + Tailwind CSS v3 configurada e testada.
  - **Tokens visuais:** Paleta usada atualmente na interface (`#0e1015`, `#14171f`, `#1a1d26`, `#3b82f6`).
  - **TitleBar:** Janela frameless customizada Linux com controles de janela nativos (`-webkit-app-region`), indicador de status do engine headless em tempo real e breadcrumb do diretório de trabalho.
  - **ActivityBar (48px):** Ícones (`MessageSquare`, `FolderTree`, `Clock`, `Boxes`, `Settings`) com indicador azul ativo e tooltips.
  - **Sidebar Retrátil (280px):**
    - Aba Conversas: Botão `+ New Conversation`, campo de busca em tempo real, agrupamento por data (Today, Yesterday, Last 7 days, Older) e menu de opções.
    - Aba File Explorer: Árvore completa e expansível de arquivos do projeto com ícones customizados por extensão.
    - Aba Tarefas Agendadas: Interface para criar, pausar e monitorar tarefas cron (`/schedule`).
    - Aba Skills & Plugins: Gerenciamento com toggles de habilidades do agente.
    - Aba Configurações: Seletores de modelo, comportamento da execução local e diretório CWD.
  - **Chat Canvas:**
    - Header da conversa com pílulas de Modelo, Modo (`Agent`, `Planning`, `Fast`), CWD e toggle do painel auxiliar.
    - Feed de mensagens com auto-scroll e tela inicial com cartões de início rápido.
    - **ThinkingAccordion:** Caixa retrátil de raciocínio profundo com cronômetro em segundos (DeepThink R1 / Thinking).
    - **ToolCallCard:** Cartões de execução de ferramentas (`run_command`, `view_file`, etc.) com abas de Entrada, Saída de Terminal com cores ANSI e status.
    - **MarkdownRenderer:** Renderização completa de Markdown com realce de sintaxe em código e botão de cópia.
    - **Prompt Box:** Caixa de entrada com auto-resize, popover de comandos `/` (`/goal`, `/plan`, `/schedule`, `/browser`, `/learn`), menções `@`, seletores de modelo e modo, alternador de busca web e botão de envio/parada.
  - **Auxiliary Pane (380px):** Abas de Artefatos (com cards interativos de preview), Subagentes, Tarefas, Terminal integrado e Monitor do Navegador Headless (com status ao vivo dos provedores e botão de conexão).
  - **Compilação e Verificação:** `npm run build` executado com 100% de sucesso.

- [x] **Fase 3: Motor Headless & Drivers dos Provedores (Background Browser)** ✅
  - Configuração de janelas Chromium ocultas do Electron em segundo plano (`BrowserManager`).
  - Implementação do DeepSeek Driver (`chat.deepseek.com`): injeção de texto via DOM nativo, clique de envio, extração de raciocínio `.ds-think-content` (DeepThink R1) e streaming de tokens.
  - Implementação dos drivers do Google Gemini (`gemini.google.com`) e ChatGPT (`chatgpt.com`).
  - Sistema de autenticação assistida (`openLoginWindow`) e metadados de sessão em `~/.config/freeai/sessions.json`; cookies e armazenamento web ficam nas partições persistentes do Electron.

- [x] **Fase 4: Loop do Agente Autônomo & Executores de Ferramentas Locais** ✅
  - Implementação de um system prompt para chats web com definição de ferramentas.
  - Parser multi-formato de Tool Calls em tempo real (`tool-parser.ts` com suporte a XML `<tool_call>`, JSON, ZeroScript `###MCP_TOOL###` e DeepSeek DSML `<|DSML|>`).
  - Executores de ferramentas locais no Linux:
    - `run_command`: Execução assíncrona com Bash nativo do Linux, captura de stdout/stderr e status code.
    - `view_file`: Leitura de arquivos com paginação de linhas e detecção de arquivos inexistentes.
    - `write_to_file`: Criação e sobrescrita atômica de arquivos no sistema de arquivos.
    - `replace_file_content`: Edição cirúrgica de blocos contíguos de código.
    - `search_files`: Busca recursiva rápida no projeto com filtro de diretórios ignorados.
    - `list_directory`: Listagem de estrutura de arquivos e pastas.
    - `search_web`: Motor de pesquisa web gratuito via extração HTML DuckDuckGo sem necessidade de chaves pagas.
  - Orquestrador autônomo com loop de feedback: executa a ferramenta localmente, injeta o resultado de volta no modelo web e continua até a entrega final.

- [x] **Fase 5: Integração Completa dos Provedores e IPC Bridge** ✅
  - Canais IPC bidirecionais registrados no processo principal (`agent:send_message`, `agent:on_token`, `agent:on_thinking`, `agent:on_tool_call`, `agent:on_tool_result`, `agent:on_complete`).
  - ContextBridge seguro exposto no Preload (`window.freeai` e `window.electronAPI`).
  - Conexão reativa no ChatCanvas atualizando em tempo real os accordions de pensamento e cards de ferramentas.

- [x] **Fase 6: Atalhos de teclado & motor de navegador em background** ✅
  - **Atalhos Oficiais Integrados (`useKeybindings`):**
    - `Ctrl+N` / `Cmd+N`: Nova Conversa (com foco automático).
    - `Ctrl+B` / `Cmd+B`: Alternar Barra Lateral (Sidebar).
    - `Ctrl+J` / `Cmd+J`: Alternar Painel Auxiliar (Auxiliary Pane).
    - `Ctrl+L` / `Cmd+L` & `Ctrl+I`: Focar Caixa de Prompt central.
    - `Ctrl+,`: Abrir Configurações no Sidebar.
    - `Ctrl+P`: Abrir Explorador de Arquivos no Sidebar.
    - `Ctrl+Shift+P`: Abrir Slash Commands (`/`).
    - `Ctrl+Shift+T`: Alternar para a aba Terminal do painel auxiliar.
    - `Ctrl+Shift+B`: Alternar para a aba Browser Monitor do painel auxiliar.
    - `Ctrl+Shift+A`: Alternar para a aba Artifacts do painel auxiliar.
    - `Escape`: Fechar menus flutuantes e desfocar inputs.
    - Badges visuais de atalhos incorporados nos botões e tooltips do ActivityBar e Sidebar.
  - **Execução Real Headless Comprovada:**
    - ChatGPT (`chatgpt.com`): pode responder sem login prévio em algumas sessões; streaming e tool calls dependem do estado e das mudanças do site.
    - DeepSeek (`chat.deepseek.com`): Detecção automática de login (`/sign_in`), instruções claras via chat e suporte a DeepThink R1 com persistência de sessão.
    - Gemini (`gemini.google.com`): Suporte a sessão web headless.
    - Port estritamente travado na **1111** (`http://localhost:1111`).
    - DevTools e popups automáticos completamente desativados na inicialização.
    - Flags Linux `--no-sandbox --disable-gpu` ativadas para evitar crashes no Ubuntu/Debian.
    - Pacote `.deb` gerado e pronto para instalação em `release/freeai_0.1.0_amd64.deb`.

---

## 9. Como Executar e Usar o FreeAI no Linux

### Como Iniciar o Aplicativo:
No terminal, basta executar:
```bash
cd /caminho/para/FreeAI
./start-freeai.sh
```
Ou pesquisar por **FreeAI** no menu de aplicativos do seu ambiente Linux (GNOME, KDE, XFCE).

### Pacote `.deb` Nativo Gerado:
O pacote Debian (`.deb`) é gerado em `release/` pelo processo de build; os artefatos dessa pasta não fazem parte do repositório-fonte.

Para instalar no sistema operacional via terminal:
```bash
sudo dpkg -i release/freeai_0.1.0_amd64.deb
```
*(Caso falte alguma dependência no sistema, execute `sudo apt-get install -f`)*

### Como Conectar suas Contas Gratuitas:
1. Abra o FreeAI.
2. No painel auxiliar à direita, acesse a aba **Browser**.
3. Clique em **Conectar Conta** ao lado de **DeepSeek**, **Gemini** ou **ChatGPT**.
4. Uma janela única se abrirá para você realizar o login normalmente.
5. Após o login, os dados da sessão permanecem na partição local do Electron. O navegador é carregado em janela oculta quando o provedor é usado; disponibilidade e persistência dependem do provedor e da instalação local.

---

*FreeAI é um projeto independente e não oficial. Consulte as licenças e os termos dos provedores antes de redistribuir ou usar as integrações.*
