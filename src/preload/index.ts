import { contextBridge, ipcRenderer } from 'electron';

const MESSAGE_WINDOW_SIZE = 50;

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  platform: process.platform,
});

contextBridge.exposeInMainWorld('freeai', {
  defaultCwd: process.env.HOME || process.env.USERPROFILE || '.',

  sendMessage: (payload: {
    conversationId: string;
    prompt: string;
    provider: string;
    mode: 'agent' | 'planning' | 'fast';
    cwd: string;
    projectPath?: string;
    modelId?: string;
    capabilityId?: string;
  }) => ipcRenderer.invoke('agent:send_message', payload),

  pickProjectFolder: () =>
    ipcRenderer.invoke('projects:pickFolder') as Promise<{ folderPath: string; name: string } | null>,

  listProjects: () =>
    ipcRenderer.invoke('projects:list'),

  createProject: (project: { name: string; folderPath: string }) =>
    ipcRenderer.invoke('projects:create', project),

  deleteProject: (id: string) =>
    ipcRenderer.invoke('projects:delete', id),

  listConversations: () =>
    ipcRenderer.invoke('conversations:list'),

  saveConversation: (conversation: unknown) =>
    ipcRenderer.invoke('conversations:save', conversation),

  upsertMessage: (conversationId: string, message: unknown) =>
    ipcRenderer.invoke('conversations:upsertMessage', { conversationId, message }),

  deleteConversation: (id: string) =>
    ipcRenderer.invoke('conversations:delete', id),

  getConversationWindow: (conversationId: string, start: number, count = MESSAGE_WINDOW_SIZE) =>
    ipcRenderer.invoke('conversations:getWindow', { conversationId, start, count }),

  windowSize: MESSAGE_WINDOW_SIZE,

  fsTree: (dirPath: string) =>
    ipcRenderer.invoke('fs:tree', dirPath) as Promise<{ entries?: any[]; error?: string | null }>,

  fsReadFile: (path: string, root: string) =>
    ipcRenderer.invoke('fs:readFile', { path, root }) as Promise<{ content?: string; size?: number; error?: string | null }>,

  fsWriteFile: (path: string, content: string, root: string) =>
    ipcRenderer.invoke('fs:writeFile', { path, content, root }) as Promise<{ bytes?: number; error?: string | null }>,

  fsPickFolder: () =>
    ipcRenderer.invoke('fs:pickFolder') as Promise<string | null>,

  stopGeneration: (provider: string) =>
    ipcRenderer.send('agent:stop_generation', provider),

  openLogin: (provider: string) =>
    ipcRenderer.invoke('auth:open_login', provider),

  executeCommand: (command: string, cwd?: string) =>
    ipcRenderer.invoke('system:execute_command', command, cwd),

  getProviderStatus: () =>
    ipcRenderer.invoke('provider:get_status') as Promise<Record<string, boolean>>,

  onProviderStatus: (callback: (data: { provider: string; connected: boolean }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_provider_status', listener);
    return () => ipcRenderer.removeListener('agent:on_provider_status', listener);
  },

  onProviderBusy: (
    callback: (data: { provider: string; conversationId: string; modelId?: string; busy: boolean }) => void
  ) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_provider_busy', listener);
    return () => ipcRenderer.removeListener('agent:on_provider_busy', listener);
  },

  onToken: (callback: (data: { conversationId: string; token: string; fullText: string }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_token', listener);
    return () => ipcRenderer.removeListener('agent:on_token', listener);
  },

  onThinking: (callback: (data: { conversationId: string; thinkingText: string }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_thinking', listener);
    return () => ipcRenderer.removeListener('agent:on_thinking', listener);
  },

  onToolCall: (callback: (data: { conversationId: string; toolCall: any }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_tool_call', listener);
    return () => ipcRenderer.removeListener('agent:on_tool_call', listener);
  },

  onToolResult: (callback: (data: { conversationId: string; toolResult: any }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_tool_result', listener);
    return () => ipcRenderer.removeListener('agent:on_tool_result', listener);
  },

  onAskUser: (
    callback: (data: {
      conversationId: string;
      requestId: string;
      provider: string;
      questions: { id: string; question: string; options: string[] }[];
    }) => void
  ) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_ask_user', listener);
    return () => ipcRenderer.removeListener('agent:on_ask_user', listener);
  },

  answerAskUser: (
    requestId: string,
    answers: { question: string; answer: string }[]
  ) => ipcRenderer.invoke('agent:answer_ask_user', { requestId, answers }),

  onComplete: (callback: (data: { conversationId: string; finalText: string }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_complete', listener);
    return () => ipcRenderer.removeListener('agent:on_complete', listener);
  },

  onError: (callback: (data: { conversationId: string; error: string }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_error', listener);
    return () => ipcRenderer.removeListener('agent:on_error', listener);
  },

  onCapabilityLimited: (callback: (data: { provider: string; capability: string; limited: boolean }) => void) => {
    const listener = (_e: any, d: any) => callback(d);
    ipcRenderer.on('agent:on_capability_limited', listener);
    return () => ipcRenderer.removeListener('agent:on_capability_limited', listener);
  },
});
