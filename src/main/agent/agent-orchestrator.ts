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
import { getPlatformAdapter } from '../platform';
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

// Ferramentas que não devem ser re-tentadas automaticamente em caso de falha
// (geralmente têm side-effects irreversíveis ou o erro é determinístico).
const NO_RETRY_TOOLS = new Set([
  'write_to_file',
  'replace_file_content',
  'run_command',
  'run_background_command',
  'screen_capture',
  'simulate_input',
  'create_3d_model',
  'export_3d_model',
]);

export interface AgentEventCallbacks {
  onToken: (token: string, fullText: string) => void;
  onThinking: (thinkingText: string) => void;
  onToolCall: (toolCall: {
    id: string;
    name: string;
    displayName: string;
    parameters: any;
    status: 'running';
  }) => void;
  onToolResult: (toolResult: {
    id: string;
    name: string;
    output: string;
    status: 'completed' | 'failed';
    durationMs: number;
  }) => void;
  onAskUser?: (requestId: string, parameters: any) => Promise<string>;
  onComplete: (finalText: string) => void;
  onError: (error: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch-mode pós-conclusão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contexto de uma conversa que ficou com tool calls detectados mas não executados
 * porque o orchestrator já havia encerrado (por stop ou limite de iterações).
 * O WatchManager mantém isso ativo e, caso a IA envie mais mensagens no futuro
 * com tool calls pendentes, os executa automaticamente.
 */
export interface PendingWatchEntry {
  conversationId: string;
  provider: string;
  cwd: string;
  hasProject: boolean;
  modelId?: string;
  capabilityId?: string;
  /** Texto da última resposta que tinha tool calls não executados */
  pendingResponse: string;
  callbacks: AgentEventCallbacks;
  /** Tool calls detectados e ainda não executados */
  pendingTools: ParsedToolCall[];
  createdAt: number;
}

class WatchManager {
  private watches = new Map<string, PendingWatchEntry>();
  private static TTL_MS = 30 * 60 * 1000; // 30 minutos

  set(conversationId: string, entry: PendingWatchEntry) {
    this.watches.set(conversationId, entry);
    // Limpeza automática após TTL
    setTimeout(() => this.watches.delete(conversationId), WatchManager.TTL_MS);
  }

  get(conversationId: string): PendingWatchEntry | undefined {
    return this.watches.get(conversationId);
  }

  delete(conversationId: string) {
    this.watches.delete(conversationId);
  }

  has(conversationId: string): boolean {
    return this.watches.has(conversationId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export class AgentOrchestrator {
  private browserManager: BrowserManager;
  private isCancelled: boolean = false;
  private watchManager = new WatchManager();

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  // ───────────────────────────── run() ─────────────────────────────────────

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

    // Se existe uma entrada de watch pendente para essa conversa e o usuário
    // mandou "continue" (ou qualquer mensagem), executa os tool calls pendentes
    // antes de mandar o prompt para a IA.
    const watch = this.watchManager.get(conversationId);
    if (watch && watch.pendingTools.length > 0) {
      this.watchManager.delete(conversationId);
      await this.executeToolsAndContinue(
        watch.pendingTools,
        watch.pendingResponse,
        conversationId,
        provider,
        mode,
        cwd,
        callbacks,
        { ...opts, projectPath: watch.hasProject ? opts.projectPath : undefined }
      );
      return;
    }

    try {
      const hasProject = Boolean(opts.projectPath);
      const systemPrompt = getAgentSystemPrompt(cwd, hasProject);
      let currentInput = composeInitialRequest(systemPrompt, userPrompt);

      await this.agentLoop(
        currentInput,
        conversationId,
        provider,
        mode,
        cwd,
        callbacks,
        opts,
        hasProject
      );
    } catch (err: any) {
      callbacks.onError(err.message || 'Unknown agent execution error');
    }
  }

  // ───────────────────── agentLoop() ───────────────────────────────────────

  private async agentLoop(
    initialInput: string,
    conversationId: string,
    provider: string,
    mode: 'agent' | 'planning' | 'fast',
    cwd: string,
    callbacks: AgentEventCallbacks,
    opts: { modelId?: string; capabilityId?: string; projectPath?: string },
    hasProject: boolean
  ) {
    let currentInput = initialInput;
    let iteration = 0;
    // Aumentado de 12 → 20 para tarefas mais complexas.
    const maxIterations = 20;
    let finalAccumulatedText = '';
    let reformattedOnce = false;
    let cappedWithWorkPending = false;
    // Contador de nudges consecutivos sem progresso real (sem tool calls, sem stop)
    let nudgesWithoutProgress = 0;
    const MAX_NUDGES_WITHOUT_PROGRESS = 3;

    while (iteration < maxIterations && !this.isCancelled) {
      iteration++;

      let responseText: string;
      try {
        responseText = await this.browserManager.sendPrompt(
          provider,
          currentInput,
          {
            onToken: (delta, full) => callbacks.onToken(delta, full),
            onThinking: (think) => callbacks.onThinking(think),
          },
          opts
        );
      } catch (err: any) {
        // Erro de rede/provider na iteração — repassa como erro de agente
        throw err;
      }

      finalAccumulatedText = responseText;

      // Detecta tool calls na resposta
      const toolCalls = parseToolCalls(responseText);
      const stopIndex = toolCalls.findIndex((tc) => tc.name === 'stop');

      // "stop" como primeira chamada → encerra imediatamente
      if (stopIndex === 0) break;

      const executableTools = stopIndex === -1 ? toolCalls : toolCalls.slice(0, stopIndex);

      // ── Sem tool calls ──────────────────────────────────────────────────
      if (executableTools.length === 0) {
        // Fallback de formato: ferramenta detectada mas não parseada
        if (toolCalls.length === 0 && !reformattedOnce && looksLikeToolCall(responseText)) {
          reformattedOnce = true;
          currentInput = TOOL_FORMAT_FALLBACK;
          continue;
        }

        // Modo rápido: resposta única e encerra
        if (mode === 'fast') break;

        // Limite de nudges sem progresso: encerra graciosamente
        nudgesWithoutProgress++;
        if (nudgesWithoutProgress >= MAX_NUDGES_WITHOUT_PROGRESS || iteration >= maxIterations) {
          cappedWithWorkPending = nudgesWithoutProgress >= MAX_NUDGES_WITHOUT_PROGRESS;
          break;
        }

        currentInput = CONTINUE_NUDGE;
        continue;
      }

      // Há tool calls — resetar contador de nudges
      nudgesWithoutProgress = 0;

      // ── Executa as ferramentas ──────────────────────────────────────────
      const toolResultsPayload = await this.runToolBatch(
        executableTools,
        cwd,
        callbacks,
        hasProject
      );

      if (this.isCancelled) break;

      // "stop" depois de algumas ferramentas → encerra após executá-las
      if (stopIndex !== -1) break;

      currentInput = buildToolResultFeedback(toolResultsPayload);

      if (iteration >= maxIterations) {
        cappedWithWorkPending = true;
        break;
      }
    }

    if (cappedWithWorkPending) {
      finalAccumulatedText +=
        '\n\n⚠️ Parei no limite de passos desta tarefa. ' +
        'Responda "continue" para eu retomar exatamente de onde parei.';
    }

    callbacks.onComplete(finalAccumulatedText);
  }

  // ───────────────── executeToolsAndContinue() ─────────────────────────────
  /**
   * Usado pelo watch-mode: executa tool calls pendentes de uma sessão anterior
   * e retoma o loop do agente com os resultados.
   */
  private async executeToolsAndContinue(
    pendingTools: ParsedToolCall[],
    _previousResponse: string,
    conversationId: string,
    provider: string,
    mode: 'agent' | 'planning' | 'fast',
    cwd: string,
    callbacks: AgentEventCallbacks,
    opts: { modelId?: string; capabilityId?: string; projectPath?: string }
  ) {
    const hasProject = Boolean(opts.projectPath);
    try {
      const toolResultsPayload = await this.runToolBatch(pendingTools, cwd, callbacks, hasProject);
      if (this.isCancelled) {
        callbacks.onComplete('');
        return;
      }
      const nextInput = buildToolResultFeedback(toolResultsPayload);
      await this.agentLoop(nextInput, conversationId, provider, mode, cwd, callbacks, opts, hasProject);
    } catch (err: any) {
      callbacks.onError(err.message || 'Unknown agent execution error');
    }
  }

  // ──────────────────── runToolBatch() ─────────────────────────────────────
  /**
   * Executa um lote de ferramentas em série, notificando callbacks a cada passo.
   * Retorna o array de strings de resultado para feed de volta à IA.
   * Erros de ferramenta são capturados e transformados em resultado de falha
   * para que a IA possa se recuperar — EXCETO erros de ferramentas sem retry
   * que não têm sentido repassar ao modelo.
   */
  private async runToolBatch(
    tools: ParsedToolCall[],
    cwd: string,
    callbacks: AgentEventCallbacks,
    hasProject: boolean
  ): Promise<string[]> {
    const results: string[] = [];

    for (const tool of tools) {
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

      // Tentativas: 1 para ferramentas sem retry, 2 para as demais
      const maxAttempts = NO_RETRY_TOOLS.has(tool.name) ? 1 : 2;
      let lastError = '';

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          toolOutput = await this.executeTool(tool, cwd, toolId, callbacks, hasProject);
          toolStatus = 'completed';
          lastError = '';
          break;
        } catch (err: any) {
          lastError = err.message;
          if (attempt < maxAttempts) {
            // Pequena espera antes do retry
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      }

      if (lastError) {
        toolStatus = 'failed';
        toolOutput = `Error executing tool: ${lastError}`;
      }

      const durationMs = Date.now() - startTime;

      callbacks.onToolResult({
        id: toolId,
        name: tool.name,
        output: toolOutput,
        status: toolStatus,
        durationMs,
      });

      results.push(formatToolResult(tool.name, toolOutput));
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────

  public stop(provider: string) {
    this.isCancelled = true;
    this.browserManager.stop(provider);
  }

  /**
   * Registra tool calls detectados mas não executados para o watch-mode.
   * Chamado externamente (pelo ipc-handler) quando o orchestrator já encerrou
   * mas a IA emitiu tool calls na última mensagem sem executar.
   */
  public registerPendingWatch(entry: PendingWatchEntry) {
    this.watchManager.set(entry.conversationId, entry);
  }

  public hasPendingWatch(conversationId: string): boolean {
    return this.watchManager.has(conversationId);
  }

  // ─────────────────── executeTool() ───────────────────────────────────────

  private async executeTool(
    tool: ParsedToolCall,
    defaultCwd: string,
    requestId: string,
    callbacks: AgentEventCallbacks,
    hasProject = false
  ): Promise<string> {
    const params = tool.parameters || {};

    if (!hasProject && PROJECT_ONLY_TOOLS.has(tool.name)) {
      throw new Error(
        'Esta ferramenta exige um projeto aberto. Crie um projeto e inicie a conversa nele.'
      );
    }

    const requireProject = () => {
      if (!hasProject) {
        throw new Error(
          'ferramentas de modelo 3D gravam arquivos; peça ao usuário para abrir um projeto (Novo Projeto) e reinicie a conversa nele'
        );
      }
    };

    // Caminhos relativos do modelo são relativos ao cwd da conversa
    const abs = (p?: string) =>
      p && !path.isAbsolute(p) ? path.resolve(defaultCwd, p) : p || '';

    switch (tool.name) {
      case 'ask_user': {
        if (!callbacks.onAskUser)
          throw new Error('ask_user exige uma interface conectada ao usuário');
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
        return edit3dModel(
          defaultCwd,
          params.path,
          params.targetContent,
          params.replacementContent
        );
      }

      case 'export_3d_model': {
        requireProject();
        return await export3dModel(defaultCwd, params.path, params.format);
      }

      default:
        throw new Error(`Unsupported tool: ${tool.name}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private getDisplayName(name: string): string {
    const map: Record<string, string> = {
      ask_user: 'Perguntas para você',
      run_command: `Terminal ${getPlatformAdapter().shellName}`,
      view_file: 'Leitura de Arquivo',
      write_to_file: 'Criação de Arquivo',
      replace_file_content: 'Edição Cirúrgica',
      search_files: 'Busca no Projeto',
      list_directory: 'Listar Diretório',
      search_web: 'Pesquisa Web',
      http_get: 'Requisição HTTP',
      run_background_command: 'Tarefa em Background',
      check_background_task: 'Consultar Tarefa',
      screen_capture: 'Captura de Tela',
      simulate_input: 'Simulação de Teclado/Mouse',
      project_memory: 'Memória do Projeto',
      create_3d_model: 'Criar Modelo 3D',
      render_3d_model: 'Renderizar Modelo 3D',
      preview_3d_model: 'Pré-visualizar 3D',
      edit_3d_model: 'Editar Modelo 3D',
      export_3d_model: 'Exportar Modelo 3D',
    };
    return map[name] ?? name;
  }
}
