import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message, AIProvider, AgentMode, Project } from '../types';
import { useEditorStore } from './editor-store';

interface ConversationMetaRow {
  id: string;
  title: string;
  provider: string;
  mode: string;
  cwd: string;
  projectId: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
  totalMessages: number;
  preview: string;
}

interface ChatState {
  projects: Project[];
  conversations: Conversation[];
  activeConversationId: string | null;
  initialized: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  getActiveConversation: () => Conversation | undefined;
  init: () => Promise<void>;
  createProject: (name: string, folderPath: string) => Promise<Project>;
  createConversation: (
    provider?: AIProvider,
    mode?: AgentMode,
    cwd?: string,
    projectId?: string | null,
    filePath?: string | null
  ) => string;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'> & { id?: string; timestamp?: Date }) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updates: Partial<Message>
  ) => void;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  renameConversation: (id: string, title: string) => void;
  loadOlder: (conversationId: string) => Promise<number>;
  loadNewer: (conversationId: string) => Promise<number>;
}

const DEFAULT_CWD = window.freeai?.defaultCwd ?? '.';
const WINDOW_SIZE = window.freeai?.windowSize ?? 50;

const api = () => window.freeai;

function makeConversation(partial: Partial<Conversation> & { id: string; projectId?: string | null }): Conversation {
  return {
    title: 'New Conversation',
    messages: [],
    provider: 'deepseek',
    mode: 'agent',
    cwd: DEFAULT_CWD,
    totalMessages: 0,
    windowStart: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial
  };
}

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleMessagePersist(conversationId: string, message: Message): void {
  const freeai = api();
  if (!freeai) return;
  const key = `${conversationId}:${message.id}`;
  const existing = persistTimers.get(key);
  if (existing) clearTimeout(existing);
  persistTimers.set(
    key,
    setTimeout(() => {
      persistTimers.delete(key);
      freeai.upsertMessage(conversationId, message).catch(() => undefined);
    }, message.isStreaming ? 1500 : 0)
  );
}

function patchConversation(
  state: ChatState,
  id: string,
  patch: (conv: Conversation) => Conversation
): Conversation[] {
  return state.conversations.map((conv) => (conv.id === id ? patch(conv) : conv));
}

export const useChatStore = create<ChatState>((set, get) => ({
  projects: [],
  conversations: [],
  activeConversationId: null,
  initialized: false,
  loadingOlder: false,
  loadingNewer: false,

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },

  init: async () => {
    if (get().initialized) return;
    const freeai = api();
    if (!freeai) {
      const seed = makeConversation({ id: uuidv4() });
      set({ conversations: [seed], activeConversationId: seed.id, initialized: true });
      return;
    }

    const [rawProjects, rawConvs] = await Promise.all([
      freeai.listProjects(),
      freeai.listConversations()
    ]);
    const projects = rawProjects as Project[];
    const metas = (rawConvs as ConversationMetaRow[]).map((row) =>
      makeConversation({
        id: row.id,
        title: row.title,
        provider: row.provider as AIProvider,
        mode: row.mode as AgentMode,
        cwd: row.cwd,
        projectId: row.projectId,
        filePath: row.filePath,
        totalMessages: row.totalMessages,
        windowStart: row.totalMessages,
        preview: row.preview,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })
    );

    let conversations = metas;
    let activeConversationId = metas[0]?.id ?? null;

    set({ projects, conversations, activeConversationId });

    if (conversations.length === 0) {
      const seed = makeConversation({ id: uuidv4() });
      set({ conversations: [seed], activeConversationId: seed.id });
      freeai.saveConversation(seed).catch(() => undefined);
    } else if (activeConversationId) {
      const w = await freeai
        .getConversationWindow(
          activeConversationId,
          Math.max(0, conversations[0].totalMessages - WINDOW_SIZE),
          WINDOW_SIZE
        )
        .catch(() => null);
      if (w) {
        set((state) => ({
          conversations: patchConversation(state, activeConversationId!, (conv) => ({
            ...conv,
            messages: w.messages,
            windowStart: Math.max(0, w.total - w.messages.length),
            totalMessages: w.total
          }))
        }));
      }
    }

    set({ initialized: true });
  },

  createProject: async (name, folderPath) => {
    const freeai = api();
    const created = freeai
      ? ((await freeai.createProject({ name, folderPath })) as Project)
      : { id: uuidv4(), name, folderPath, createdAt: new Date().toISOString() };
    set((state) => ({ projects: [...state.projects, created] }));
    return created;
  },

  createConversation: (
    provider = 'deepseek',
    mode = 'agent',
    cwd = DEFAULT_CWD,
    projectId = null,
    filePath = null
  ) => {
    if (!filePath && get().conversations && useEditorStore.getState().opened.path) {
      useEditorStore.getState().closeFile();
    }
    const newId = uuidv4();
    const project = projectId ? get().projects.find((p) => p.id === projectId) : undefined;
    const newConv = makeConversation({
      id: newId,
      title: filePath ? `📝 ${filePath.split('/').pop() || filePath}` : 'New Conversation',
      provider,
      mode,
      cwd: project ? project.folderPath : cwd,
      projectId: projectId ?? null,
      filePath
    });

    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: newId
    }));

    api()?.saveConversation(newConv).catch(() => undefined);

    return newId;
  },

  addMessage: (conversationId, message) => {
    const fullMessage: Message = {
      ...message,
      id: message.id || uuidv4(),
      timestamp: message.timestamp || new Date()
    };

    set((state) => ({
      conversations: patchConversation(state, conversationId, (conv) => {
        const windowEnd = conv.windowStart + conv.messages.length;
        const totalMessages = conv.totalMessages + 1;
        const hasGap = windowEnd < conv.totalMessages;
        return {
          ...conv,
          messages: [...conv.messages, fullMessage],
          totalMessages,
          // ao enviar durante scroll no histórico, reancora a janela no final
          windowStart: hasGap ? totalMessages - (conv.messages.length + 1) : conv.windowStart,
          updatedAt: new Date()
        };
      })
    }));

    scheduleMessagePersist(conversationId, fullMessage);
  },

  updateMessage: (conversationId, messageId, updates) => {
    let updated: Message | undefined;
    set((state) => ({
      conversations: patchConversation(state, conversationId, (conv) => {
        const messages = conv.messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          updated = { ...msg, ...updates };
          return updated;
        });
        return {
          ...conv,
          messages,
          updatedAt: new Date()
        };
      })
    }));
    if (updated) scheduleMessagePersist(conversationId, updated);
  },

  deleteConversation: (id) => {
    set((state) => {
      const updatedList = state.conversations.filter((conv) => conv.id !== id);
      const nextActiveId =
        state.activeConversationId === id
          ? updatedList[0]?.id || null
          : state.activeConversationId;
      return {
        conversations: updatedList,
        activeConversationId: nextActiveId
      };
    });
    api()?.deleteConversation(id).catch(() => undefined);
  },

  setActiveConversation: (id) => {
    const editor = useEditorStore.getState();
    if (editor.opened.path && editor.conversationId !== id) {
      editor.closeFile();
    }
    set({ activeConversationId: id });
    const conv = get().conversations.find((c) => c.id === id);
    const freeai = api();
    if (conv && freeai && conv.messages.length === 0 && conv.totalMessages > 0) {
      const start = Math.max(0, conv.totalMessages - WINDOW_SIZE);
      freeai
        .getConversationWindow(id, start, WINDOW_SIZE)
        .then((w) => {
          const current = get().conversations.find((c) => c.id === id);
          if (!current || current.messages.length > 0 || get().activeConversationId !== id) return;
          set((state) => ({
            conversations: patchConversation(state, id, (c) => ({
              ...c,
              messages: w.messages,
              windowStart: w.total - w.messages.length,
              totalMessages: w.total
            }))
          }));
        })
        .catch(() => undefined);
    }
  },

  renameConversation: (id, title) => {
    let renamed: Conversation | undefined;
    set((state) => ({
      conversations: patchConversation(state, id, (conv) => {
        renamed = { ...conv, title, updatedAt: new Date() };
        return renamed;
      })
    }));
    if (renamed) api()?.saveConversation(renamed).catch(() => undefined);
  },

  loadOlder: async (conversationId) => {
    const freeai = api();
    if (!freeai || get().loadingOlder) return 0;
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv || conv.windowStart <= 0) return 0;

    const count = Math.min(WINDOW_SIZE, conv.windowStart);
    const start = conv.windowStart - count;
    set({ loadingOlder: true });
    try {
      const w = await freeai.getConversationWindow(conversationId, start, count);
      const older = w.messages;
      set((state) => ({
        conversations: patchConversation(state, conversationId, (c) => {
          const merged = [...older, ...c.messages];
          // janela deslizante: remove do fim o que entrou em cima
          const overflow = Math.max(0, merged.length - WINDOW_SIZE);
          return {
            ...c,
            messages: merged.slice(0, merged.length - overflow),
            windowStart: start,
            totalMessages: w.total
          };
        })
      }));
      return older.length;
    } finally {
      set({ loadingOlder: false });
    }
  },

  loadNewer: async (conversationId) => {
    const freeai = api();
    if (!freeai || get().loadingNewer) return 0;
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return 0;
    const windowEnd = conv.windowStart + conv.messages.length;
    if (windowEnd >= conv.totalMessages) return 0;

    const count = Math.min(WINDOW_SIZE, conv.totalMessages - windowEnd);
    set({ loadingNewer: true });
    try {
      const w = await freeai.getConversationWindow(conversationId, windowEnd, count);
      const newer = w.messages;
      set((state) => ({
        conversations: patchConversation(state, conversationId, (c) => {
          const merged = [...c.messages, ...newer];
          const overflow = Math.max(0, merged.length - WINDOW_SIZE);
          return {
            ...c,
            messages: merged.slice(overflow),
            windowStart: c.windowStart + overflow,
            totalMessages: w.total
          };
        })
      }));
      return newer.length;
    } finally {
      set({ loadingNewer: false });
    }
  }
}));
