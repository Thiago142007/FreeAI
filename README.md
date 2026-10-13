# FreeAI

Cliente desktop experimental para Linux que conecta provedores de IA por suas interfaces web e oferece ferramentas de agente para trabalhar com arquivos e comandos locais.

> FreeAI é um projeto independente e não oficial. Não é afiliado, endossado ou mantido pelo Google, OpenAI, DeepSeek ou outros provedores mencionados.

## Recursos

- Interface desktop baseada em Electron, React e TypeScript.
- Conexão com DeepSeek, Gemini e ChatGPT por sessões web persistentes.
- Respostas em streaming e modos de agente, planejamento e resposta rápida.
- Ferramentas para listar, ler e editar arquivos e executar comandos locais.
- Histórico local de conversas e projetos.

Consulte o [histórico de versões](CHANGELOG.md) para ver as mudanças de cada release.

O acesso aos provedores depende de suas contas, disponibilidade, limites e termos de uso. O projeto não oferece modelos nem acesso gratuito garantido.

## Requisitos

- Linux (Ubuntu, Debian, Arch ou Fedora).
- Node.js LTS e npm.
- Conexão com a internet para acessar os provedores.

## Desenvolvimento

```bash
git clone https://github.com/thiago142007/FreeAI.git
cd FreeAI
npm ci
npm run dev
```

Para compilar:

```bash
npm run build
npm start
```

Para gerar um pacote Debian:

```bash
npm run build:deb
```

O pacote é criado em `release/`, que não faz parte do repositório-fonte.

## Como funciona

O processo principal do Electron abre janelas Chromium ocultas (`BrowserWindow`) para carregar as páginas dos provedores. Drivers específicos observam e interagem com essas páginas. O histórico e as sessões do navegador são mantidos localmente.

O projeto **não executa atualmente o binário nem a biblioteca `browser39`**. Esse repositório foi consultado como referência para a arquitetura de navegador headless; a implementação atual usa Chromium fornecido pelo Electron.

## Segurança e privacidade

- O agente pode executar comandos no computador e ler ou alterar arquivos. Revise as ações e os comandos antes de confiar no resultado; não use com conteúdo ou prompts não confiáveis sem supervisão.
- As sessões de login usam partições persistentes do Electron neste dispositivo. Não compartilhe o perfil local do aplicativo e encerre as sessões nos próprios provedores quando necessário.
- A configuração atual do Electron desativa o sandbox do Chromium (`--no-sandbox`, `sandbox: false`) por compatibilidade. Isso reduz o isolamento de segurança; use o app apenas em ambientes confiáveis.
- Conversas, arquivos acessados e comandos podem conter dados pessoais. Evite enviar dados sensíveis a provedores externos.
- Não coloque tokens, cookies, arquivos `.env`, bancos de dados ou logs no repositório. Revise os arquivos staged antes de cada publicação; `.gitignore` reduz o risco, mas não substitui essa revisão.
- A disponibilidade e o comportamento das integrações podem mudar quando os provedores atualizam seus sites.

## Agradecimentos e referências

- **ZeroScript-Free**: a ideia de automatizar interações com chats web e estruturar chamadas de ferramentas foi inspirada por esse projeto: [github.com/sebattfg/ZeroScript-Free](https://github.com/sebattfg/ZeroScript-Free). Consulte a licença do projeto original antes de reutilizar qualquer código.
- **browser39**: consultado como referência técnica para navegadores headless e automação: [github.com/alejandroqh/browser39](https://github.com/alejandroqh/browser39). Como descrito acima, não é uma dependência em runtime da versão atual do FreeAI.

Os nomes e marcas dos provedores pertencem aos respectivos titulares. As referências não implicam endosso ou afiliação.

## Licença

Este projeto é distribuído sob a licença Apache-2.0; consulte [`LICENSE`](LICENSE). As licenças dos projetos referenciados continuam sendo aplicáveis aos respectivos projetos e a qualquer código deles que venha a ser incorporado.