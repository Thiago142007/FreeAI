import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import { AgentOrchestrator } from './agent/agent-orchestrator';
import { BrowserManager } from './browser-engine/browser-manager';
import { runCommand } from './agent/tools/run-command';
import { WEB_PROVIDER_CONFIGS } from './browser-engine/providers/provider-configs';
import {
  listProjects,
  createProject,
  deleteProject,
  listConversationMeta,
  saveConversation,
  upsertMessage,
  deleteConversation,
  getMessageWindow
} from './storage/store';
import { listDir, readFileForEditor, writeFileFromEditor } from './storage/fs';

function isUsageLimitError(provider: string, error: string): boolean {
  if (error.includes('LIMITE_ATINGIDO')) return true;
  const cfg = WEB_PROVIDER_CONFIGS[provider];
  const re = cfg?.usageLimitRe;
  return re ? new RegExp(re, 'i').test(error) : false;
}

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  orchestrator: AgentOrchestrator,
  browserManager: BrowserManager
) {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Projetos
  ipcMain.handle('projects:list', () => listProjects());

  ipcMain.handle('projects:create', (_event, project: { name: string; folderPath: string }) =>
    createProject(project.name, project.folderPath)
  );

  ipcMain.handle('projects:delete', (_event, id: string) => {
    deleteProject(id);
    return true;
  });

  ipcMain.handle('projects:pickFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const folderPath = result.filePaths[0];
    return { folderPath, name: path.basename(folderPath) };
  });

  // Conversas persistidas
  ipcMain.handle('conversations:list', () => listConversationMeta());

  ipcMain.handle('conversations:save', (_event, conversation: unknown) => {
    saveConversation(conversation);
    return true;
  });

  ipcMain.handle('conversations:upsertMessage', (_event, payload: { conversationId: string; message: unknown }) => {
    upsertMessage(payload.conversationId, payload.message);
    return true;
  });

  ipcMain.handle('conversations:delete', (_event, id: string) => {
    deleteConversation(id);
    return true;
  });

  ipcMain.handle(
    'conversations:getWindow',
    (_event, payload: { conversationId: string; start: number; count: number }) =>
      getMessageWindow(payload.conversationId, payload.start, payload.count)
  );

  // Sistema de arquivos (explorer + editor)
  ipcMain.handle('fs:tree', (_event, dirPath: string) => {
    try {
      return { entries: listDir(dirPath) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:readFile', (_event, payload: { path: string; root: string }) => {
    try {
      return readFileForEditor(payload.path, payload.root);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle(
    'fs:writeFile',
    (_event, payload: { path: string; content: string; root: string }) => {
      try {
        return { ...writeFileFromEditor(payload.path, payload.content, payload.root), error: null };
      } catch (err: any) {
        return { error: err.message };
      }
    }
  );

  ipcMain.handle('fs:pickFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Agent message execution
  ipcMain.handle(
    'agent:send_message',
    async (
      _event,
      payload: {
        conversationId: string;
        prompt: string;
        provider: string;
        mode: 'agent' | 'planning' | 'fast';
        cwd: string;
        projectPath?: string;
        modelId?: string;
        capabilityId?: string;
      }
    ) => {
      const emitBusy = (busy: boolean) =>
        mainWindow.webContents.send('agent:on_provider_busy', {
          provider: payload.provider,
          conversationId: payload.conversationId,
          modelId: payload.modelId,
          busy
        });

      emitBusy(true);
      orchestrator.run(
        payload.conversationId,
        payload.prompt,
        payload.provider,
        payload.mode,
        payload.cwd,
        {
          onToken: (token, fullText) => {
            mainWindow.webContents.send('agent:on_token', {
              conversationId: payload.conversationId,
              token,
              fullText,
            });
          },
          onThinking: (thinkingText) => {
            mainWindow.webContents.send('agent:on_thinking', {
              conversationId: payload.conversationId,
              thinkingText,
            });
          },
          onToolCall: (toolCall) => {
            mainWindow.webContents.send('agent:on_tool_call', {
              conversationId: payload.conversationId,
              toolCall,
            });
          },
          onToolResult: (toolResult) => {
            mainWindow.webContents.send('agent:on_tool_result', {
              conversationId: payload.conversationId,
              toolResult,
            });
          },
          onComplete: (finalText) => {
            emitBusy(false);
            // Uma resposta real do provedor confirma a sessão salva
            browserManager.markSession(payload.provider, true);
            mainWindow.webContents.send('agent:on_provider_status', {
              provider: payload.provider,
              connected: true,
            });
            mainWindow.webContents.send('agent:on_complete', {
              conversationId: payload.conversationId,
              finalText,
            });
          },
          onError: (error) => {
            emitBusy(false);
            browserManager.markSession(payload.provider, false);
            mainWindow.webContents.send('agent:on_provider_status', {
              provider: payload.provider,
              connected: false,
            });
            if (isUsageLimitError(payload.provider, error)) {
              mainWindow.webContents.send('agent:on_capability_limited', {
                provider: payload.provider,
                capability: payload.capabilityId || (payload.modelId ? `model:${payload.modelId}` : 'chat'),
                limited: true,
              });
            }
            mainWindow.webContents.send('agent:on_error', {
              conversationId: payload.conversationId,
              error,
            });
          },
        },
        { modelId: payload.modelId, capabilityId: payload.capabilityId, projectPath: payload.projectPath }
      );
      return { success: true };
    }
  );

  // Stop generation
  ipcMain.on('agent:stop_generation', (_event, provider: 'deepseek' | 'gemini' | 'chatgpt') => {
    orchestrator.stop(provider);
  });

  // Open provider login window
  ipcMain.handle('auth:open_login', async (_event, provider: 'deepseek' | 'gemini' | 'chatgpt') => {
    return new Promise((resolve) => {
      browserManager.openLogin(provider, (success) => {
        resolve({ success });
      });
    });
  });

  // Estado real das sessões salvas (lido do disco, não hardcoded)
  ipcMain.handle('provider:get_status', () => browserManager.getAllSessionStatus());

  // Execute terminal command directly (for the Terminal tab)
  ipcMain.handle('system:execute_command', async (_event, command: string, cwd?: string) => {
    return await runCommand(command, cwd);
  });
}
