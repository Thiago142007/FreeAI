import { BrowserManager } from '../browser-engine/browser-manager';
import { getAgentSystemPrompt } from './system-prompt';
import { parseToolCalls, ParsedToolCall } from './tool-parser';
import { runCommand } from './tools/run-command';
import { viewFile, writeToFile, replaceFileContent, searchFiles, listDirectory } from './tools/file-tools';
import { searchWeb } from './tools/search-tools';
import { httpGet } from './tools/net-tools';
import { runBackgroundCommand, checkBackgroundTask } from './tools/task-runner';
import { screenCapture, simulateInput } from './tools/desktop-tools';
import { readMemory, writeMemory } from './tools/memory-tools';

export interface AgentEventCallbacks {
  onToken: (token: string, fullText: string) => void;
  onThinking: (thinkingText: string) => void;
  onToolCall: (toolCall: { id: string; name: string; displayName: string; parameters: any; status: 'running' }) => void;
  onToolResult: (toolResult: { id: string; name: string; output: string; status: 'completed' | 'failed'; durationMs: number }) => void;
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
      let currentInput = `${systemPrompt}\n\n[USER REQUEST]:\n${userPrompt}`;
      let iteration = 0;
      const maxIterations = 8;
      let finalAccumulatedText = '';

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

        if (toolCalls.length === 0 || mode === 'fast') {
          // Nenhuma ferramenta chamada ou modo rápido — fim da execução
          break;
        }

        // Executa ferramentas no sistema operacional Linux
        const toolResultsPayload: string[] = [];

        for (const tool of toolCalls) {
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
            toolOutput = await this.executeTool(tool, cwd);
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

          toolResultsPayload.push(`[TOOL RESULT for ${tool.name}]:\n${toolOutput}`);
        }

        if (this.isCancelled) break;

        // Prepara feedback para a próxima iteração do agente
        currentInput = `Here are the execution results of your tool calls on the local Linux system:\n\n` +
          toolResultsPayload.join('\n\n') +
          `\n\nPlease evaluate the results and continue with the next steps or provide your final response to the user.`;
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

  private async executeTool(tool: ParsedToolCall, defaultCwd: string): Promise<string> {
    const params = tool.parameters || {};

    switch (tool.name) {
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
        const p = params.path || '';
        const res = viewFile(p, params.startLine, params.endLine);
        return `File Path: ${p}\nTotal Lines: ${res.totalLines}\nLines ${res.startLine}-${res.endLine}:\n${res.content}`;
      }

      case 'write_to_file': {
        const p = params.path || '';
        const content = params.content || '';
        const res = writeToFile(p, content, params.overwrite ?? true);
        return `Successfully wrote ${res.bytesWritten} bytes to ${res.path}`;
      }

      case 'replace_file_content': {
        const p = params.path || '';
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

      default:
        throw new Error(`Unsupported tool: ${tool.name}`);
    }
  }

  private getDisplayName(name: string): string {
    switch (name) {
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
      default:
        return name;
    }
  }
}
