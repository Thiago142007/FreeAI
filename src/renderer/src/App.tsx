import React, { useEffect } from 'react';
import { TitleBar, ActivityBar, Sidebar, AuxiliaryPane } from './components/layout';
import { ChatCanvas } from './components/chat/ChatCanvas';
import { FileEditorView } from './components/layout/editor/FileEditorView';
import { useKeybindings } from './hooks/useKeybindings';
import { useChatStore } from './store/chat-store';
import { useSettingsStore } from './store/settings-store';
import { useEditorStore } from './store/editor-store';
import { useAskStore } from './store/ask-store';
import { AIProvider } from './types';

export const App: React.FC = () => {
  useKeybindings();
  const initChatStore = useChatStore((state) => state.init);
  const attachAgentEvents = useChatStore((state) => state.attachAgentEvents);
  const setProviderStatus = useSettingsStore((state) => state.setProviderStatus);
  const markFeatureLimited = useSettingsStore((state) => state.markFeatureLimited);
  const setProviderBusy = useSettingsStore((state) => state.setProviderBusy);
  const registerAsk = useAskStore((state) => state.registerAsk);
  const forgetAsk = useAskStore((state) => state.forgetAsk);

  // Marca/desmarca provedores "em uso" (um provedor só responde uma conversa por vez)
  useEffect(() => {
    if (!window.freeai) return;
    return window.freeai.onProviderBusy(({ provider, conversationId, modelId, busy }) => {
      setProviderBusy(provider, busy ? { conversationId, modelId } : null);
    });
  }, [setProviderBusy]);

  // Perguntas da tool ask_user: registra o pedido pendente e limpa se a corrida terminar sem resposta
  useEffect(() => {
    if (!window.freeai) return;

    const unsubAsk = window.freeai.onAskUser(({ conversationId, requestId, provider, questions }) => {
      registerAsk(requestId, { conversationId, provider, questions });
    });

    const unsubResult = window.freeai.onToolResult(({ toolResult }) => {
      if (toolResult?.name === 'ask_user') forgetAsk(toolResult.id);
    });

    return () => {
      unsubAsk();
      unsubResult();
    };
  }, [registerAsk, forgetAsk]);

  const openedFilePath = useEditorStore((state) => state.opened.path);

  // Carrega projetos e conversas persistidos em disco na abertura
  useEffect(() => {
    initChatStore();
  }, [initChatStore]);

  // Eventos do agente assinados na raiz do app: abrir um arquivo ou trocar de conversa
  // desmonta o ChatCanvas, e a corrida em andamento precisa continuar viva no store.
  useEffect(() => attachAgentEvents(), [attachAgentEvents]);

  // Reflete o estado REAL das sessões salvas no disco, e acompanha mudanças ao vivo
  useEffect(() => {
    if (!window.freeai) return;

    window.freeai.getProviderStatus().then((statuses) => {
      for (const [provider, connected] of Object.entries(statuses || {})) {
        setProviderStatus(provider as AIProvider, connected ? 'connected' : 'disconnected');
      }
    });

    const unsub = window.freeai.onProviderStatus(({ provider, connected }) => {
      setProviderStatus(provider as AIProvider, connected ? 'connected' : 'disconnected');
    });

    const unsubLimited = window.freeai.onCapabilityLimited(({ provider, capability, limited }) => {
      markFeatureLimited(provider as AIProvider, capability, limited);
    });

    return () => {
      unsub();
      unsubLimited();
    };
  }, [setProviderStatus, markFeatureLimited]);

  return (
    <div className="h-screen w-screen flex flex-col bg-ag-bg text-ag-text overflow-hidden select-none font-sans">
      {/* TitleBar (38px) */}
      <TitleBar />

      {/* Main Workspace Row: ActivityBar (48px) | Sidebar (280px) | ChatCanvas (flex-1) | AuxiliaryPane (380px) */}
      <div className="flex-1 flex flex-row min-h-0 w-full overflow-hidden">
        <ActivityBar />
        <Sidebar />
        {openedFilePath ? <FileEditorView /> : <ChatCanvas />}
        <AuxiliaryPane />
      </div>
    </div>
  );
};
