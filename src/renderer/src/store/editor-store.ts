import { create } from 'zustand';
import { useChatStore } from './chat-store';

interface OpenedFileState {
  path: string | null;
  name: string | null;
  root: string | null;
}

interface EditorState {
  explorerRootOverride: string | null;
  opened: OpenedFileState;
  content: string;
  savedContent: string;
  conversationId: string | null;
  previousConversationId: string | null;
  chatOpen: boolean;
  onlyThisFile: boolean;
  externalChange: boolean;
  error: string | null;
  saving: boolean;

  setExplorerRootOverride: (dir: string | null) => void;
  openFile: (path: string, root: string, projectId?: string | null) => Promise<boolean>;
  closeFile: () => void;
  setContent: (text: string) => void;
  save: () => Promise<boolean>;
  toggleChat: () => void;
  setOnlyThisFile: (value: boolean) => void;
  reloadFromDisk: () => Promise<void>;
  dismissExternalChange: () => void;
  clearError: () => void;
}

function basename(p: string): string {
  return p.split('/').pop() || p;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  explorerRootOverride: null,
  opened: { path: null, name: null, root: null },
  content: '',
  savedContent: '',
  conversationId: null,
  previousConversationId: null,
  chatOpen: false,
  onlyThisFile: false,
  externalChange: false,
  error: null,
  saving: false,

  setExplorerRootOverride: (dir) => set({ explorerRootOverride: dir }),

  openFile: async (path, root, projectId = null) => {
    const freeai = window.freeai;
    if (!freeai) {
      set({ error: 'Editor de arquivos disponível apenas no app desktop.' });
      return false;
    }
    const res = await freeai.fsReadFile(path, root);
    if (res.error || res.content === undefined) {
      set({ error: res.error ?? 'Falha ao ler o arquivo.' });
      return false;
    }

    const chat = useChatStore.getState();
    // Abrir arquivo troca a conversa ativa; herdar a conversa guardada do arquivo já
    // aberto faz o último X voltar ao chat original em vez de voltar ao arquivo anterior
    const previousConversationId = get().previousConversationId ?? chat.activeConversationId;
    const existing = chat.conversations.find(
      (c) => c.filePath === path && c.cwd === root
    );
    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
      chat.setActiveConversation(existing.id);
    } else {
      conversationId = chat.createConversation(undefined, 'agent', root, projectId, path);
    }

    set({
      opened: { path, name: basename(path), root },
      content: res.content,
      savedContent: res.content,
      conversationId,
      previousConversationId,
      externalChange: false,
      error: null
    });
    return true;
  },

  closeFile: () => {
    const { previousConversationId } = get();
    set({
      opened: { path: null, name: null, root: null },
      content: '',
      savedContent: '',
      conversationId: null,
      previousConversationId: null,
      externalChange: false,
      error: null
    });
    // opened.path já é null aqui, então isso não reentrar em closeFile
    if (previousConversationId) {
      useChatStore.getState().setActiveConversation(previousConversationId);
    }
  },

  setContent: (text) => set({ content: text }),

  save: async () => {
    const { opened, content } = get();
    if (!opened.path || !opened.root || !window.freeai) return false;
    set({ saving: true });
    const res = await window.freeai.fsWriteFile(opened.path, content, opened.root);
    set({ saving: false });
    if (res.error) {
      set({ error: res.error });
      return false;
    }
    set({ savedContent: content });
    return true;
  },

  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  setOnlyThisFile: (value) => set({ onlyThisFile: value }),

  reloadFromDisk: async () => {
    const { opened, content, savedContent } = get();
    if (!opened.path || !opened.root || !window.freeai) return;
    const res = await window.freeai.fsReadFile(opened.path, opened.root);
    if (res.error || res.content === undefined) return;
    const userHadUnsavedEdits = content !== savedContent;
    if (userHadUnsavedEdits) {
      set({ externalChange: true });
    } else {
      set({ content: res.content, savedContent: res.content, externalChange: false });
    }
  },

  dismissExternalChange: () => set({ externalChange: false }),

  clearError: () => set({ error: null })
}));
