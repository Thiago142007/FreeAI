import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { PanelRightOpen, PanelRightClose, Sparkles, Terminal, FileCode, Bot } from 'lucide-react';
import { useChatStore } from '../../store/chat-store';
import { useSettingsStore } from '../../store/settings-store';
import { MessageItem } from './MessageItem';
import { PromptBox } from './PromptBox';
import { v4 as uuidv4 } from 'uuid';

export const ChatCanvas: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const conversations = useChatStore((state) => state.conversations);
  const projects = useChatStore((state) => state.projects);
  const getActiveConversation = useChatStore((state) => state.getActiveConversation);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const loadOlder = useChatStore((state) => state.loadOlder);
  const loadNewer = useChatStore((state) => state.loadNewer);

  const auxiliaryPaneOpen = useSettingsStore((state) => state.auxiliaryPaneOpen);
  const toggleAuxiliaryPane = useSettingsStore((state) => state.toggleAuxiliaryPane);
  const provider = useSettingsStore((state) => state.provider);
  const mode = useSettingsStore((state) => state.mode);
  const cwd = useSettingsStore((state) => state.cwd);
  const activeModels = useSettingsStore((state) => state.activeModels);
  const activeCapabilities = useSettingsStore((state) => state.activeCapabilities);

  const [generatingConvId, setGeneratingConvId] = useState<string | null>(null);
  const [busyNotice, setBusyNotice] = useState<string | null>(null);
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const genConvRef = useRef<string | null>(null);
  const isGenerating = generatingConvId === activeConversationId;

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? getActiveConversation();
  const messages = activeConversation?.messages ?? [];

  const scrollAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const stickToBottomRef = useRef(false);
  const lastAutoLoadRef = useRef(0);
  const lastBottomMsgIdRef = useRef<string | null>(null);
  const prevConvIdRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const jumpToBottom = () => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  };

  // Reanima a posição após carregar mensagens antigas; só cola no fim
  // quando a última mensagem realmente mudou (nova mensagem/streaming)
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && scrollAdjustRef.current) {
      const { prevHeight, prevTop } = scrollAdjustRef.current;
      scrollAdjustRef.current = null;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
    } else if (stickToBottomRef.current) {
      stickToBottomRef.current = false;
      jumpToBottom();
    } else {
      const convChanged = prevConvIdRef.current !== activeConversationId;
      if (convChanged) {
        prevConvIdRef.current = activeConversationId;
        lastBottomMsgIdRef.current = null;
      }
      const lastId = messages[messages.length - 1]?.id ?? null;
      if (lastId && lastId !== lastBottomMsgIdRef.current) {
        // posição inicial/troca de conversa: pulo instantâneo (sem varrer o topo,
        // senão o onScroll dispara loadOlder indevido)
        if (lastBottomMsgIdRef.current === null) jumpToBottom();
        else scrollToBottom();
      }
      lastBottomMsgIdRef.current = lastId;
    }
  }, [messages, activeConversationId]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    const conv = activeConversation;
    if (!el || !conv || !window.freeai) return;

    const windowEnd = conv.windowStart + conv.messages.length;
    const nearTop = el.scrollTop < 30;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    const cooledDown = Date.now() - lastAutoLoadRef.current > 1000;

    if (nearTop && conv.windowStart > 0 && cooledDown) {
      lastAutoLoadRef.current = Date.now();
      scrollAdjustRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
      loadOlder(conv.id).then((n) => {
        if (!n) scrollAdjustRef.current = null;
      });
    } else if (nearBottom && windowEnd < conv.totalMessages && cooledDown) {
      lastAutoLoadRef.current = Date.now();
      stickToBottomRef.current = true;
      loadNewer(conv.id).then((n) => {
        if (!n) stickToBottomRef.current = false;
      });
    }
  };

  // Registra listeners de IPC para eventos do agente
  useEffect(() => {
    if (!window.freeai) return;

    const unsubToken = window.freeai.onToken(({ conversationId, fullText }) => {
      if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
        updateMessage(conversationId, currentAssistantMsgIdRef.current, {
          content: fullText,
          isStreaming: true,
        });
      }
    });

    const unsubThinking = window.freeai.onThinking(({ conversationId, thinkingText }) => {
      if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
        updateMessage(conversationId, currentAssistantMsgIdRef.current, {
          thinking: {
            content: thinkingText,
            durationMs: 1200,
            isExpanded: true,
          },
        });
      }
    });

    const unsubToolCall = window.freeai.onToolCall(({ conversationId, toolCall }) => {
      if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
        const conv = getActiveConversation();
        const currentMsg = conv?.messages.find((m) => m.id === currentAssistantMsgIdRef.current);
        const existingTools = currentMsg?.toolCalls || [];

        updateMessage(conversationId, currentAssistantMsgIdRef.current, {
          toolCalls: [
            ...existingTools,
            {
              id: toolCall.id,
              name: toolCall.name,
              displayName: toolCall.displayName,
              status: 'running',
              input: JSON.stringify(toolCall.parameters, null, 2),
            },
          ],
        });
      }
    });

    const unsubToolResult = window.freeai.onToolResult(({ conversationId, toolResult }) => {
      if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
        const conv = getActiveConversation();
        const currentMsg = conv?.messages.find((m) => m.id === currentAssistantMsgIdRef.current);
        const existingTools = currentMsg?.toolCalls || [];

        const updatedTools = existingTools.map((t) => {
          if (t.id === toolResult.id) {
            return {
              ...t,
              status: toolResult.status,
              output: toolResult.output,
              durationMs: toolResult.durationMs,
            };
          }
          return t;
        });

        updateMessage(conversationId, currentAssistantMsgIdRef.current, {
          toolCalls: updatedTools,
        });
      }
    });

    const unsubComplete = window.freeai.onComplete(({ conversationId, finalText }) => {
      if (conversationId === genConvRef.current) {
        if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
          updateMessage(conversationId, currentAssistantMsgIdRef.current, {
            content: finalText,
            isStreaming: false,
          });
        }
        genConvRef.current = null;
        currentAssistantMsgIdRef.current = null;
        setGeneratingConvId(null);
      }
    });

    const unsubError = window.freeai.onError(({ conversationId, error }) => {
      if (conversationId === genConvRef.current) {
        if (currentAssistantMsgIdRef.current && conversationId === activeConversationId) {
          updateMessage(conversationId, currentAssistantMsgIdRef.current, {
            content: `⚠️ Error executing agent: ${error}`,
            isStreaming: false,
          });
        }
        genConvRef.current = null;
        currentAssistantMsgIdRef.current = null;
        setGeneratingConvId(null);
      }
    });

    return () => {
      unsubToken();
      unsubThinking();
      unsubToolCall();
      unsubToolResult();
      unsubComplete();
      unsubError();
    };
  }, [activeConversationId, updateMessage, getActiveConversation]);

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !activeConversationId || isGenerating) return;

    const busyInfo = useSettingsStore.getState().providerBusy[provider];
    if (busyInfo && busyInfo.conversationId !== activeConversationId) {
      setBusyNotice(
        `⏳ ${provider.toUpperCase()} está respondendo em outra conversa — um provedor só atende uma conversa por vez.`
      );
      return;
    }
    setBusyNotice(null);

    // 1. Adiciona a mensagem do usuário
    addMessage(activeConversationId, {
      role: 'user',
      content,
    });

    // 2. Cria a mensagem do assistente aguardando streaming
    const assistantId = uuidv4();
    currentAssistantMsgIdRef.current = assistantId;
    genConvRef.current = activeConversationId;
    setGeneratingConvId(activeConversationId);

    addMessage(activeConversationId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    });

    // 3. Despacha para o motor de agente local / headless browser
    if (window.freeai) {
      const project = activeConversation?.projectId
        ? projects.find((p) => p.id === activeConversation.projectId)
        : undefined;
      window.freeai.sendMessage({
        conversationId: activeConversationId,
        prompt: content,
        provider,
        mode,
        cwd: project ? project.folderPath : activeConversation?.cwd || cwd,
        projectPath: project?.folderPath,
        modelId: activeModels[provider] || undefined,
        capabilityId: activeCapabilities[provider] || undefined,
      });
    } else {
      updateMessage(activeConversationId, assistantId, {
        content:
          '⚠️ A ponte do Electron (window.freeai) não está disponível. O agente só executa dentro do app desktop — abra o FreeAI via `./start-freeai.sh`.',
        isStreaming: false,
      });
      genConvRef.current = null;
      setGeneratingConvId(null);
      currentAssistantMsgIdRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (window.freeai) {
      window.freeai.stopGeneration(provider);
    }
    genConvRef.current = null;
    setGeneratingConvId(null);
    if (currentAssistantMsgIdRef.current && activeConversationId) {
      updateMessage(activeConversationId, currentAssistantMsgIdRef.current, {
        isStreaming: false,
      });
      currentAssistantMsgIdRef.current = null;
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-ag-bg relative overflow-hidden select-text">
      {/* Top canvas bar */}
      <div className="h-11 min-h-[44px] px-4 border-b border-ag-border/60 bg-ag-bg/80 backdrop-blur flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ag-text truncate">
            <span>{activeConversation?.title || 'Novo Chat'}</span>
          </div>
          <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-ag-bg-card border border-ag-border text-ag-text-muted">
            {activeConversation?.provider?.toUpperCase() || provider.toUpperCase()}
          </span>
          <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-ag-bg-card border border-ag-border text-ag-accent">
            {activeConversation?.mode?.toUpperCase() || mode.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleAuxiliaryPane}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all duration-200 ${
              auxiliaryPaneOpen
                ? 'bg-ag-bg-active text-ag-accent border-ag-border-focus/40'
                : 'text-ag-text-muted border-transparent hover:bg-ag-bg-hover hover:text-ag-text'
            }`}
            title="Toggle Auxiliary Pane"
          >
            {auxiliaryPaneOpen ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                <span className="text-2xs">Hide Panel</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5" />
                <span className="text-2xs">Panel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Message feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 space-y-4"
      >
        {messages.length === 0 && (activeConversation?.totalMessages ?? 0) === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-ag-accent/20 to-ag-indigo/20 border border-ag-accent/30 flex items-center justify-center mb-4 shadow-glow-blue">
              <Bot className="w-6 h-6 text-ag-accent" />
            </div>
            <h2 className="text-xl font-bold text-ag-text tracking-tight mb-2">
              FreeAI
            </h2>
            <p className="text-xs text-ag-text-secondary leading-relaxed mb-6 max-w-sm">
              Agente autônomo local gratuito conectado com alguma IA.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              <button
                type="button"
                onClick={() => handleSendMessage('Inspecione a estrutura deste projeto e liste os arquivos')}
                className="p-3 rounded-lg bg-ag-bg-card border border-ag-border/80 hover:border-ag-accent/50 hover:bg-ag-bg-hover transition-all text-xs group"
              >
                <div className="flex items-center gap-2 font-medium text-ag-text group-hover:text-ag-accent mb-1">
                  <Terminal className="w-3.5 h-3.5 text-ag-accent" />
                  <span>Inspecionar Projeto</span>
                </div>
                <p className="text-2xs text-ag-text-muted">
                  Listar diretórios e arquivos de configuração.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('/plan Criar um pipeline de build e testes')}
                className="p-3 rounded-lg bg-ag-bg-card border border-ag-border/80 hover:border-ag-accent/50 hover:bg-ag-bg-hover transition-all text-xs group"
              >
                <div className="flex items-center gap-2 font-medium text-ag-text group-hover:text-ag-accent mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-ag-indigo" />
                  <span>/plan Pipeline de Build</span>
                </div>
                <p className="text-2xs text-ag-text-muted">
                  Gerar passos detalhados para empacotar o app.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('/goal Configurar testes unitários com Vitest')}
                className="p-3 rounded-lg bg-ag-bg-card border border-ag-border/80 hover:border-ag-accent/50 hover:bg-ag-bg-hover transition-all text-xs group"
              >
                <div className="flex items-center gap-2 font-medium text-ag-text group-hover:text-ag-accent mb-1">
                  <FileCode className="w-3.5 h-3.5 text-ag-green" />
                  <span>/goal Configurar Testes</span>
                </div>
                <p className="text-2xs text-ag-text-muted">
                  Executar meta de longo prazo de forma autônoma.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('/browser Pesquisar novidades do Linux Kernel 6.12')}
                className="p-3 rounded-lg bg-ag-bg-card border border-ag-border/80 hover:border-ag-accent/50 hover:bg-ag-bg-hover transition-all text-xs group"
              >
                <div className="flex items-center gap-2 font-medium text-ag-text group-hover:text-ag-accent mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-ag-amber" />
                  <span>/browser Navegação Web</span>
                </div>
                <p className="text-2xs text-ag-text-muted">
                  Pesquisar na internet sem chaves de API pagas.
                </p>
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => <MessageItem key={message.id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Antigravity Prompt Box at bottom */}
      <div className="p-4 md:px-8 lg:px-12 shrink-0 bg-gradient-to-t from-ag-bg via-ag-bg to-transparent">
        {busyNotice && (
          <div className="mb-2 max-w-3xl mx-auto px-3 py-2 rounded-lg bg-ag-amber/10 border border-ag-amber/30 text-[11px] text-ag-amber">
            {busyNotice}
          </div>
        )}
        <PromptBox
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          onStopGenerating={handleStopGenerating}
        />
      </div>
    </main>
  );
};
