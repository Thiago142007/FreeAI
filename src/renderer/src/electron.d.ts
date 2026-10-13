export { };

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      platform: string;
    };
    freeai?: {
      defaultCwd: string;
      sendMessage: (payload: {
        conversationId: string;
        prompt: string;
        provider: string;
        mode: 'agent' | 'planning' | 'fast';
        cwd: string;
        projectPath?: string;
        modelId?: string;
        capabilityId?: string;
      }) => Promise<{ success: boolean }>;
      pickProjectFolder: () => Promise<{ folderPath: string; name: string } | null>;
      listProjects: () => Promise<unknown[]>;
      createProject: (project: { name: string; folderPath: string }) => Promise<unknown>;
      deleteProject: (id: string) => Promise<boolean>;
      listConversations: () => Promise<unknown[]>;
      saveConversation: (conversation: unknown) => Promise<boolean>;
      upsertMessage: (conversationId: string, message: unknown) => Promise<boolean>;
      deleteConversation: (id: string) => Promise<boolean>;
      getConversationWindow: (
        conversationId: string,
        start: number,
        count?: number
      ) => Promise<{ messages: any[]; total: number }>;
      windowSize: number;
      fsTree: (dirPath: string) => Promise<{ entries?: { name: string; path: string; type: 'folder' | 'file'; size?: number }[]; error?: string | null }>;
      fsReadFile: (path: string, root: string) => Promise<{ content?: string; size?: number; error?: string | null }>;
      fsWriteFile: (path: string, content: string, root: string) => Promise<{ bytes?: number; error?: string | null }>;
      fsPickFolder: () => Promise<string | null>;
      stopGeneration: (provider: string) => void;
      openLogin: (provider: string) => Promise<{ success: boolean }>;
      executeCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>;
      getProviderStatus: () => Promise<Record<string, boolean>>;
      onProviderStatus: (callback: (data: { provider: string; connected: boolean }) => void) => () => void;
      onProviderBusy: (callback: (data: { provider: string; conversationId: string; modelId?: string; busy: boolean }) => void) => () => void;
      onCapabilityLimited: (callback: (data: { provider: string; capability: string; limited: boolean }) => void) => () => void;
      onToken: (callback: (data: { conversationId: string; token: string; fullText: string }) => void) => () => void;
      onThinking: (callback: (data: { conversationId: string; thinkingText: string }) => void) => () => void;
      onToolCall: (callback: (data: { conversationId: string; toolCall: any }) => void) => () => void;
      onToolResult: (callback: (data: { conversationId: string; toolResult: any }) => void) => () => void;
      onAskUser: (
        callback: (data: {
          conversationId: string;
          requestId: string;
          provider: string;
          questions: import('./types').AskUserQuestion[];
        }) => void
      ) => () => void;
      answerAskUser: (
        requestId: string,
        answers: import('./types').AskUserAnswer[]
      ) => Promise<{ accepted: boolean }>;
      onComplete: (callback: (data: { conversationId: string; finalText: string }) => void) => () => void;
      onError: (callback: (data: { conversationId: string; error: string }) => void) => () => void;
    };
  }
}
