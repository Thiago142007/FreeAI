# FreeAI

Cliente desktop experimental para Linux, Windows 10/11 e macOS que conecta provedores de IA por suas interfaces web e oferece ferramentas de agente para trabalhar com arquivos e comandos locais.

> FreeAI é um projeto independente e não oficial. Não é afiliado, endossado ou mantido pelo Google, OpenAI, DeepSeek ou outros provedores mencionados.

## Recursos

- Interface desktop baseada em Electron, React e TypeScript.
- Execução em Linux, Windows 10/11 e macOS, com shell e ferramentas locais adaptados a cada sistema.
- Testes e empacotamento automatizados para os três sistemas operacionais.
- Conexão com DeepSeek, Gemini e ChatGPT por sessões web persistentes.
- Respostas em streaming e modos de agente, planejamento e resposta rápida.
- Ferramentas para listar, ler e editar arquivos e executar comandos locais.
- Histórico local de conversas e projetos.

Consulte o [histórico de versões](CHANGELOG.md) para ver as mudanças de cada release.

O acesso aos provedores depende de suas contas, disponibilidade, limites e termos de uso. O projeto não oferece modelos nem acesso gratuito garantido.

## Requisitos

- Linux (Ubuntu, Debian, Arch ou Fedora), Windows 10/11 ou macOS.
- Node.js 20 ou superior (LTS recomendado) e npm.
- Conexão com a internet para acessar os provedores.

## Desenvolvimento

Os comandos abaixo funcionam nos três sistemas operacionais (PowerShell no Windows, Terminal no macOS/Linux):

```bash
git clone https://github.com/thiago142007/FreeAI.git
cd FreeAI
npm ci
npm run dev
```

Para compilar e executar o app:

```bash
npm run build
npm start
```

No Linux, `./start-freeai.sh` continua disponível como atalho.

## Instaladores e releases

O CI do GitHub Actions (workflow `build`) roda a suíte de testes nos três SOs e gera os pacotes:

Ao enviar uma tag `v*`, o workflow cria um rascunho de release no GitHub com os instaladores. A publicação final desse rascunho é manual.

| SO | Pacote | Script local |
|---|---|---|
| Linux (deb) | `freeai_<versão>_amd64.deb` | `npm run pack:linux` |
| Windows 10/11 | instalador NSIS `.exe` + `.exe` portable | `npm run pack:win` (recomendado via CI) |
| macOS | `.dmg` (Apple Silicon e Intel) + `.zip` | `npm run pack:mac` (só pode rodar num macOS) |

Os pacotes **não são assinados**. No primeiro uso:

- **Windows**: se o SmartScreen avisar «O Windows protegeu seu computador», clique em **Mais informações → Executar assim mesmo**.
- **macOS**: na primeira abertura do `.app`, use **clique direito → Abrir** (ou, se necessário, `xattr -dr com.apple.quarantine /Applications/FreeAI.app`). Depois disso a abertura é normal.

## Ferramentas do agente por sistema operacional

O agente usa o shell e os utilitários nativos de cada SO:

| Recurso | Linux | macOS | Windows 10/11 |
|---|---|---|---|
| `run_command` / Terminal | bash | zsh | PowerShell |
| Captura de tela | scrot / ImageMagick | `screencapture` (requer permissão de Gravação de Tela em Ajustes do Sistema → Privacidade e Segurança) | PowerShell + .NET |
| Simulação de teclado/mouse | xdotool (completa) | AppleScript: apenas teclado (`keyPress`/`type`) e espera; ações por coordenada retornam `UNAVAILABLE` | `simulate_input` indisponível — o agente usa `run_command` |

A primeira execução de captura de tela ou simulação de teclado no macOS pode exigir autorização manual em Ajustes do Sistema; o app orienta quando a permissão faltar.

## Como funciona

O processo principal do Electron abre janelas Chromium ocultas (`BrowserWindow`) para carregar as páginas dos provedores. Drivers específicos observam e interagem com essas páginas. O histórico e as sessões do navegador são mantidos localmente.

O projeto **não executa atualmente o binário nem a biblioteca `browser39`**. Esse repositório foi consultado como referência para a arquitetura de navegador headless; a implementação atual usa Chromium fornecido pelo Electron.

## Segurança e privacidade

- O agente pode executar comandos no computador e ler ou alterar arquivos. Revise as ações e os comandos antes de confiar no resultado; não use com conteúdo ou prompts não confiáveis sem supervisão.
- As sessões de login usam partições persistentes do Electron neste dispositivo. Não compartilhe o perfil local do aplicativo e encerre as sessões nos próprios provedores quando necessário.
- No Linux, o app roda com `--no-sandbox` por compatibilidade; em todas as plataformas a janela principal usa `sandbox: false` no Electron. Isso reduz o isolamento de segurança; use o app apenas em ambientes confiáveis. No Windows e no macOS o sandbox de processos do Chromium permanece ativo.
- Conversas, arquivos acessados e comandos podem conter dados pessoais. Evite enviar dados sensíveis a provedores externos.
- Não coloque tokens, cookies, arquivos `.env`, bancos de dados ou logs no repositório. Revise os arquivos staged antes de cada publicação; `.gitignore` reduz o risco, mas não substitui essa revisão.
- A disponibilidade e o comportamento das integrações podem mudar quando os provedores atualizam seus sites.

## Agradecimentos e referências

- **ZeroScript-Free**: a ideia de automatizar interações com chats web e estruturar chamadas de ferramentas foi inspirada por esse projeto: [github.com/sebattfg/ZeroScript-Free](https://github.com/sebattfg/ZeroScript-Free). Consulte a licença do projeto original antes de reutilizar qualquer código.
- **browser39**: consultado como referência técnica para navegadores headless e automação: [github.com/alejandroqh/browser39](https://github.com/alejandroqh/browser39). Como descrito acima, não é uma dependência em runtime da versão atual do FreeAI.

Os nomes e marcas dos provedores pertencem aos respectivos titulares. As referências não implicam endosso ou afiliação.

## Licença

Este projeto é distribuído sob a licença Apache-2.0; consulte [`LICENSE`](LICENSE). As licenças dos projetos referenciados continuam sendo aplicáveis aos respectivos projetos e a qualquer código deles que venha a ser incorporado.