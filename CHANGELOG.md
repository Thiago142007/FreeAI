# Histórico de versões

As mudanças relevantes do FreeAI são registradas neste arquivo.

## [Unreleased]

### Adicionado
- Suporte para executar o FreeAI no Windows 10/11 e no macOS, além do Linux, com comandos locais usando PowerShell e zsh, respectivamente.
- Captura de tela adaptada a cada sistema; simulação de entrada mantém suporte completo no Linux, oferece ações limitadas de teclado no macOS e informa indisponibilidade no Windows.
- Scripts de empacotamento para Windows e macOS, incluindo instalador e versão portable no Windows e DMG/ZIP para Apple Silicon e Intel no macOS.
- CI no GitHub Actions para testar os três sistemas operacionais e gerar seus pacotes; a criação de releases é acionada por tags `v*`.

### Alterado
- Barra de título e ciclo de vida da janela ajustados para seguir o comportamento nativo de cada plataforma.
- Prompts e mensagens das ferramentas agora identificam o sistema operacional e as limitações locais correspondentes.
- Documentação atualizada com instruções de execução, empacotamento e diferenças entre as ferramentas por sistema.

## [0.4.0] - 2026-10-13

### Adicionado
- Execuções do agente continuam transmitindo durante a troca de conversa, navegação para outras telas ou abertura do editor.
- Conversas de provedores diferentes podem executar em paralelo, cada uma mantendo sua própria mensagem, estado de streaming e ação de parar.
- Ao fechar um arquivo no editor, o app retorna à conversa que estava ativa antes da edição; arquivos abertos em sequência preservam esse retorno.

### Alterado
- Eventos e estado de execução foram centralizados na store do chat para evitar listeners duplicados e corridas órfãs quando as views desmontam.
- Mensagens restauradas do disco deixam de aparecer como se ainda estivessem em streaming.
- Adicionada cobertura de testes do lifecycle do renderer, incluindo troca de tela, encerramento, erros e restauração de conversas.

## [0.3.1] - 2026-10-13

### Corrigido
- Chats sem projeto não podem usar ferramentas de escrita, memória, captura de tela, simulação de entrada, tarefas em background ou modelagem 3D.
- IDs de conversa inválidos são rejeitados para impedir leitura ou gravação fora do diretório de conversas.
- Timeouts de comandos encerram o grupo de processos para evitar filhos órfãos e pipes presos.
- IDs de provedores desconhecidos são rejeitados antes de abrir uma sessão web.
- Chamadas de ferramenta anteriores a `stop` na mesma resposta são executadas; o parser também recupera blocos truncados e JSON com aspas internas comuns em comandos.

### Adicionado
- Prompts do agente e do editor foram separados em módulos reutilizáveis.
- Suítes automatizadas para orquestração, IPC, provedores, armazenamento, comandos e parser, além de scripts locais de auditoria da UI.

## [0.3.0] - 2026-10-13

### Adicionado
- Ferramentas de modelagem 3D com OpenSCAD via WebAssembly local: criar e editar arquivos `.scad`, renderizar e inspecionar geometria, gerar prévias PNG e exportar malhas em STL, AMF, OFF e 3MF.
- Continuação automática do agente até a chamada explícita de `stop`, com limite de passos e cobertura de aceitação para parada, modo rápido e cancelamento.
- Resolução de caminhos relativos de arquivos em relação ao projeto ativo.

### Alterado
- Parser e drivers de provedores reforçados para lidar com formatos de chamadas de ferramentas e estados de geração.
- Dependências `openscad-wasm-prebuilt` e `fflate` para renderização local e empacotamento de exportações 3D.

## [0.2.0] - 2026-10-13

### Adicionado
- Fluxo interativo `ask_user`: o agente pode fazer perguntas com opções, aceitar respostas em texto livre e permitir revisar as escolhas antes de enviá-las.
- Integração experimental com o provedor Use AI.

### Alterado
- Seletor de modelos reorganizado em um menu para facilitar a escolha entre as variantes disponíveis.
- Detecção de login exige estados autenticados consecutivos para evitar encerrar a janela durante redirecionamentos OAuth.
- Ajustes visuais no tema escuro e no editor de arquivos.