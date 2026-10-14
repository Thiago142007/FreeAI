import { BrowserManager } from '../browser-engine/browser-manager';
import * as path from 'path';
import {
  getAgentSystemPrompt,
  CONTINUE_NUDGE,
  TOOL_FORMAT_FALLBACK,
  buildToolResultFeedback,
  formatToolResult,
  composeInitialRequest
} from '../SystemPrompts';
import { parseToolCalls, looksLikeToolCall, ParsedToolCall } from './tool-parser';
import { runCommand } from './tools/run-command';
import { viewFile, writeToFile, replaceFileContent, searchFiles, listDirectory } from './tools/file-tools';
import { searchWeb } from './tools/search-tools';
import { httpGet } from './tools/net-tools';
import { runBackgroundCommand, checkBackgroundTask } from './tools/task-runner';
import { screenCapture, simulateInput } from './tools/desktop-tools';
import { readMemory, writeMemory } from './tools/memory-tools';
import {
  create3dModel,
  render3dModel,
  preview3dModel,
  edit3dModel,
  export3dModel
} from './tools/model3d-tools';

const PROJECT_ONLY_TOOLS = new Set([
  'write_to_file',
  'replace_file_content',
  'project_memory',
  'run_background_command',
  'screen_capture',
  'simulate_input',
  'create_3d_model',
  'render_3d_model',
  'preview_3d_model',
  'edit_3d_model',
  'export_3d_model'
]);

export interface AgentEventCallbacks {
  onToken: (token: string, fullText: string) => void;
  onThinking: (thinkingText: string) => void;
  onToolCall: (toolCall: { id: string; name: string; displayName: string; parameters: any; status: 'running' }) => void;
  onToolResult: (toolResult: { id: string; name: string; output: string; status: 'completed' | 'failed'; durationMs: number }) => void;
  onAskUser?: (requestId: string, parameters: any) => Promise<string>;
  onComplete: (finalText: string) => void;
  onError: (error: string) => void;
}

export class AgentOrchestrator {
  private browserManager: BrowserManager;
  private isCancelled: boolean = false;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  public async run(
    conversationId: string,
    userPrompt: string,
    provider: string,
    mode: 'agent' | 'planning' | 'fast',
    cwd: string,
    callbacks: AgentEventCallbacks,
    opts: { modelId?: string; capabilityId?: string; projectPath?: string } = {}
  ) {
    this.isCancelled = false;

    try {
      const hasProject = Boolean(opts.projectPath);
      const systemPrompt = getAgentSystemPrompt(cwd, hasProject);
      let currentInput = composeInitialRequest(systemPrompt, userPrompt);
      let iteration = 0;
      const maxIterations = 12;
      let finalAccumulatedText = '';
      let reformattedOnce = false;
      let cappedWithWorkPending = false;

      while (iteration < maxIterations && !this.isCancelled) {
        iteration++;

        let responseText = await this.browserManager.sendPrompt(
          provider,
          currentInput,
          {
            onToken: (delta, full) => callbacks.onToken(delta, full),
            onThinking: (think) => callbacks.onThinking(think),
          },
          opts
        );

        finalAccumulatedText = responseText;

        // Verifica se o modelo chamou ferramentas
        const toolCalls = parseToolCalls(responseText);

        const stopIndex = toolCalls.findIndex((tool) => tool.name === 'stop');
        if (stopIndex === 0) {
          break;
        }
        const executableTools = stopIndex === -1 ? toolCalls : toolCalls.slice(0, stopIndex);

        if (executableTools.length === 0 || mode === 'fast') {
          // Fallback: marcação de ferramenta que nenhum parser reconhece (formato novo do
          // provedor). Pede reformatação uma vez em vez de parar e mostrar o protocolo cru.
          if (toolCalls.length === 0 && !reformattedOnce && looksLikeToolCall(responseText)) {
            reformattedOnce = true;
            currentInput = TOOL_FORMAT_FALLBACK;
            continue;
          }
          // Modo rápido: uma tacada só e termina.
          if (mode === 'fast') {
            break;
          }
          // Nos modos agent/planning o app mantém a IA trabalhando: enquanto ela não chamar
          // stop, envia um nudge de "continue" (o site de chat só responde quando recebe mensagem).
          if (iteration >= maxIterations) {
            cappedWithWorkPending = true;
            break;
          }
          currentInput = CONTINUE_NUDGE;
          continue;
        }

        // Executa ferramentas no sistema operacional Linux
        const toolResultsPayload: string[] = [];

        for (const tool of executableTools) {
          if (this.isCancelled) break;

          const toolId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          callbacks.onToolCall({
            id: toolId,
            name: tool.name,
            displayName: this.getDisplayName(tool.name),
            parameters: tool.parameters,
            status: 'running',
          });

          const startTime = Date.now();
          let toolOutput = '';
          let toolStatus: 'completed' | 'failed' = 'completed';

          try {
            toolOutput = await this.executeTool(tool, cwd, toolId, callbacks, hasProject);
          } catch (err: any) {
            toolStatus = 'failed';
            toolOutput = `Error executing tool: ${err.message}`;
          }

          const durationMs = Date.now() - startTime;

          callbacks.onToolResult({
            id: toolId,
            name: tool.name,
            output: toolOutput,
            status: toolStatus,
            durationMs,
          });

          toolResultsPayload.push(formatToolResult(tool.name, toolOutput));
        }

        if (this.isCancelled) break;

        if (stopIndex !== -1) break;

        currentInput = buildToolResultFeedback(toolResultsPayload);

        if (iteration >= maxIterations) cappedWithWorkPending = true;
      }

      if (cappedWithWorkPending) {
        finalAccumulatedText +=
          '\n\n⚠️ Parei no limite de 12 passos desta tarefa com uma ferramenta ainda pendente. ' +
          'Responda "continue" para eu retomar exatamente de onde parei.';
      }

      callbacks.onComplete(finalAccumulatedText);
    } catch (err: any) {
      callbacks.onError(err.message || 'Unknown agent execution error');
    }
  }

  public stop(provider: string) {
    this.isCancelled = true;
    this.browserManager.stop(provider);
  }

  private async executeTool(
    tool: ParsedToolCall,
    defaultCwd: string,
    requestId: string,
    callbacks: AgentEventCallbacks,
    hasProject = false
  ): Promise<string> {
    const params = tool.parameters || {};
    if (!hasProject && PROJECT_ONLY_TOOLS.has(tool.name)) {
      throw new Error('Esta ferramenta exige um projeto aberto. Crie um projeto e inicie a conversa nele.');
    }
    const requireProject = () => {
      if (!hasProject) {
        throw new Error('ferramentas de modelo 3D gravam arquivos; peça ao usuário para abrir um projeto (Novo Projeto) e reinicie a conversa nele');
      }
    };
    // Caminhos relativos do modelo são relativos à conversa, não ao cwd do app.
    const abs = (p?: string) => (p && !path.isAbsolute(p) ? path.resolve(defaultCwd, p) : p || '');

    switch (tool.name) {
      case 'ask_user': {
        if (!callbacks.onAskUser) throw new Error('ask_user exige uma interface conectada ao usuário');
        return await callbacks.onAskUser(requestId, params);
      }

      case 'run_command': {
        const cmd = params.command || '';
        const runCwd = params.cwd || defaultCwd;
        const res = await runCommand(cmd, runCwd);
        let out = res.stdout;
        if (res.stderr) out += `\n[STDERR]:\n${res.stderr}`;
        out += `\n[Exit Code]: ${res.exitCode}`;
        return out;
      }

      case 'view_file': {
        const p = abs(params.path);
        const res = viewFile(p, params.startLine, params.endLine);
        return `File Path: ${p}\nTotal Lines: ${res.totalLines}\nLines ${res.startLine}-${res.endLine}:\n${res.content}`;
      }

      case 'write_to_file': {
        const p = abs(params.path);
        const content = params.content || '';
        const res = writeToFile(p, content, params.overwrite ?? true);
        return `Successfully wrote ${res.bytesWritten} bytes to ${res.path}`;
      }

      case 'replace_file_content': {
        const p = abs(params.path);
        const res = replaceFileContent(p, params.targetContent, params.replacementContent);
        return `Successfully replaced content in ${p} (${res.replacementsCount} replacement made)`;
      }

      case 'search_files': {
        const q = params.query || '';
        const dir = params.dirPath || defaultCwd;
        const res = searchFiles(dir, q);
        if (res.length === 0) return `No matches found for "${q}".`;
        return res.map((r) => `${r.file}:${r.line}: ${r.match}`).join('\n');
      }

      case 'list_directory': {
        const dir = params.dirPath || defaultCwd;
        const list = listDirectory(dir);
        return list.join('\n');
      }

      case 'search_web': {
        const q = params.query || '';
        return await searchWeb(q);
      }

      case 'http_get': {
        return await httpGet({
          url: params.url || '',
          query: params.query,
          returnFull: params.returnFull,
          contextLines: params.contextLines,
        });
      }

      case 'run_background_command': {
        const cmd = params.command || '';
        const runCwd = params.cwd || defaultCwd;
        const id = runBackgroundCommand(cmd, runCwd);
        return `Tarefa em background iniciada com id "${id}". Use check_background_task para consultar.`;
      }

      case 'check_background_task': {
        const id = params.taskId || '';
        return await checkBackgroundTask(id, params.waitSeconds ?? 0);
      }

      case 'screen_capture': {
        return await screenCapture(params.dirPath);
      }

      case 'simulate_input': {
        return await simulateInput(params.actions || []);
      }

      case 'project_memory': {
        if (params.action === 'read') return readMemory(defaultCwd);
        return writeMemory({
          cwd: defaultCwd,
          action: params.action,
          section: params.section,
          content: params.content,
        });
      }

      case 'create_3d_model': {
        requireProject();
        const res = create3dModel(defaultCwd, params.name, params.code, params.overwrite ?? false);
        return `Modelo .scad criado em ${res.path} (${res.bytesWritten} bytes). Rode render_3d_model e preview_3d_model para conferir.`;
      }

      case 'render_3d_model': {
        requireProject();
        return await render3dModel(defaultCwd, params.path);
      }

      case 'preview_3d_model': {
        requireProject();
        return await preview3dModel(defaultCwd, params.path);
      }

      case 'edit_3d_model': {
        requireProject();
        return edit3dModel(defaultCwd, params.path, params.targetContent, params.replacementContent);
      }

      case 'export_3d_model': {
        requireProject();
        return await export3dModel(defaultCwd, params.path, params.format);
      }

      default:
        throw new Error(`Unsupported tool: ${tool.name}`);
    }
  }

  private getDisplayName(name: string): string {
    switch (name) {
      case 'ask_user':
        return 'Perguntas para você';
      case 'run_command':
        return 'Terminal Bash';
      case 'view_file':
        return 'Leitura de Arquivo';
      case 'write_to_file':
        return 'Criação de Arquivo';
      case 'replace_file_content':
        return 'Edição Cirúrgica';
      case 'search_files':
        return 'Busca no Projeto';
      case 'list_directory':
        return 'Listar Diretório';
      case 'search_web':
        return 'Pesquisa Web';
      case 'http_get':
        return 'Requisição HTTP';
      case 'run_background_command':
        return 'Tarefa em Background';
      case 'check_background_task':
        return 'Consultar Tarefa';
      case 'screen_capture':
        return 'Captura de Tela';
      case 'simulate_input':
        return 'Simulação de Teclado/Mouse';
      case 'project_memory':
        return 'Memória do Projeto';
      case 'create_3d_model':
        return 'Criar Modelo 3D';
      case 'render_3d_model':
        return 'Renderizar Modelo 3D';
      case 'preview_3d_model':
        return 'Pré-visualizar 3D';
      case 'edit_3d_model':
        return 'Editar Modelo 3D';
      case 'export_3d_model':
        return 'Exportar Modelo 3D';
      default:
        return name;
    }
  }
}
