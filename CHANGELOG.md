# Histórico de versões

As mudanças relevantes do FreeAI são registradas neste arquivo.

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