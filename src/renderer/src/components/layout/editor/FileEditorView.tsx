import React, { useEffect, useRef, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { X, Save, MessageSquare, FileCode, AlertTriangle, RefreshCw } from 'lucide-react';
import { useEditorStore } from '../../../store/editor-store';
import { useChatStore } from '../../../store/chat-store';
import { useSettingsStore } from '../../../store/settings-store';
import { MessageItem } from '../../chat/MessageItem';
import { PromptBox } from '../../chat/PromptBox';
import { v4 as uuidv4 } from 'uuid';

function langExtension(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: ext === 'jsx' });
    case 'html':
    case 'htm':
    case 'xml':
      return html();
    case 'json':
      return json();
    case 'css':
      return css();
    case 'md':
      return markdown();
    case 'py':
      return python();
    default:
      return [];
  }
}

export const FileEditorView: React.FC = () => {
  const opened = useEditorStore((s) => s.opened);
  const content = useEditorStore((s) => s.content);
  const savedContent = useEditorStore((s) => s.savedContent);
  const conversationId = useEditorStore((s) => s.conversationId);
  const chatOpen = useEditorStore((s) => s.chatOpen);
  const onlyThisFile = useEditorStore((s) => s.onlyThisFile);
  const externalChange = useEditorStore((s) => s.externalChange);
  const saving = useEditorStore((s) => s.saving);
  const toggleChat = useEditorStore((s) => s.toggleChat);
  const setOnlyThisFile = useEditorStore((s) => s.setOnlyThisFile);
  const setContent = useEditorStore((s) => s.setContent);
  const save = useEditorStore((s) => s.save);
  const closeFile = useEditorStore((s) => s.closeFile);
  const reloadFromDisk = useEditorStore((s) => s.reloadFromDisk);

  const conversations = useChatStore((s) => s.conversations);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const getActiveConversation = useChatStore((s) => s.getActiveConversation);

  const provider = useSettingsStore((s) => s.provider);
  const mode = useSettingsStore((s) => s.mode);
  const activeModels = useSettingsStore((s) => s.activeModels);
  const activeCapabilities = useSettingsStore((s) => s.activeCapabilities);
  const providerBusy = useSettingsStore((s) => s.providerBusy);

  const editorHostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyNotice, setBusyNotice] = useState<string | null>(null);

  const conv = conversations.find((c) => c.id === conversationId);
  const messages = conv?.messages ?? [];
  const dirty = content !== savedContent;

  // ---- CodeMirror mount ----
  useEffect(() => {
    if (!editorHostRef.current || !opened.path) return;
    const store = useEditorStore.getState();
    const view = new EditorView({
      state: EditorState.create({
        doc: store.content,
        extensions: [
          basicSetup,
          oneDark,
          langExtension(opened.path),
          EditorView.lineWrapping,
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                useEditorStore.getState().save();
                return true;
              }
            }
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              useEditorStore.getState().setContent(update.view.state.doc.toString());
            }
          })
        ]
      }),
      parent: editorHostRef.current
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // recria por arquivo; conteúdo inicial vem do store no mount
  }, [opened.path]);

  // Sincroniza mudanças externas (recarregar após escrita da IA) no editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content }
      });
    }
  }, [content]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  // ---- listeners do chat do arquivo ----
  useEffect(() => {
    if (!window.freeai || !conversationId) return;

    const matches = (id: string) => id === conversationId && currentAssistantMsgIdRef.current;

    const unsubToken = window.freeai.onToken(({ conversationId: cid, fullText }) => {
      if (matches(cid)) {
        updateMessage(cid, currentAssistantMsgIdRef.current!, { content: fullText, isStreaming: true });
      }
    });
    const unsubThinking = window.freeai.onThinking(({ conversationId: cid, thinkingText }) => {
      if (matches(cid)) {
        updateMessage(cid, currentAssistantMsgIdRef.current!, {
          thinking: { content: thinkingText, durationMs: 1200, isExpanded: true }
        });
      }
    });
    const unsubToolCall = window.freeai.onToolCall(() => undefined);
    const unsubToolResult = window.freeai.onToolResult(({ conversationId: cid, toolResult }) => {
      if (cid !== conversationId) return;
      const name = toolResult?.name;
      if (name === 'write_to_file' || name === 'replace_file_content') {
        const output: string = toolResult?.output || '';
        const openedPath = useEditorStore.getState().opened.path || '';
        if (openedPath && (output.includes(openedPath) || output.includes(openedPath.split('/').pop() || ''))) {
          void useEditorStore.getState().reloadFromDisk();
        }
      }
    });
    const unsubComplete = window.freeai.onComplete(({ conversationId: cid, finalText }) => {
      if (matches(cid)) {
        updateMessage(cid, currentAssistantMsgIdRef.current!, { content: finalText, isStreaming: false });
        setIsGenerating(false);
        currentAssistantMsgIdRef.current = null;
      }
    });
    const unsubError = window.freeai.onError(({ conversationId: cid, error }) => {
      if (matches(cid)) {
        updateMessage(cid, currentAssistantMsgIdRef.current!, {
          content: `⚠️ ${error}`,
          isStreaming: false
        });
        setIsGenerating(false);
        currentAssistantMsgIdRef.current = null;
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
  }, [conversationId, updateMessage]);

  const busyInfo = providerBusy[provider];
  const busyElsewhere = busyInfo && busyInfo.conversationId !== conversationId;

  const handleSend = (text: string) => {
    if (!text.trim() || !conversationId || isGenerating) return;
    if (busyElsewhere) {
      setBusyNotice(`⏳ ${provider.toUpperCase()} está respondendo em outra conversa — um provedor só atende uma conversa por vez.`);
      return;
    }
    setBusyNotice(null);

    addMessage(conversationId, { role: 'user', content: text });
    const assistantId = uuidv4();
    currentAssistantMsgIdRef.current = assistantId;
    setIsGenerating(true);
    addMessage(conversationId, { id: assistantId, role: 'assistant', content: '', isStreaming: true });

    const state = useEditorStore.getState();
    const truncated = state.content.slice(0, 20000);
    let prompt =
      `[FILE EDIT] The user is editing this file locally in the FreeAI editor.\n` +
      `File path: ${state.opened.path}\nProject root: ${state.opened.root}\n\n` +
      `[CURRENT FILE CONTENT]:\n\`\`\`\n${truncated}\n\`\`\`\n\n` +
      `[USER REQUEST]:\n${text}`;
    if (state.onlyThisFile) {
      prompt +=
        `\n\n[STRICT SCOPE] You are ONLY allowed to modify the single file ${state.opened.path} ` +
        `(use write_to_file / replace_file_content on exactly this path). Do NOT create, modify, ` +
        `delete or move ANY other file or directory in the project. If the correct fix would require ` +
        `touching another file, do not do it — explain what would be needed instead.`;
    }

    if (window.freeai && state.opened.root) {
      window.freeai.sendMessage({
        conversationId,
        prompt,
        provider,
        mode,
        cwd: state.opened.root,
        projectPath: state.opened.root,
        modelId: activeModels[provider] || undefined,
        capabilityId: activeCapabilities[provider] || undefined
      });
    } else {
      updateMessage(conversationId, assistantId, {
        content: '⚠️ Ponte do Electron indisponível.',
        isStreaming: false
      });
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (window.freeai) window.freeai.stopGeneration(provider);
    setIsGenerating(false);
    if (currentAssistantMsgIdRef.current && conversationId) {
      updateMessage(conversationId, currentAssistantMsgIdRef.current, { isStreaming: false });
      currentAssistantMsgIdRef.current = null;
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-ag-bg relative overflow-hidden min-w-0">
      {/* Toolbar */}
      <div className="h-11 min-h-[44px] px-4 border-b border-ag-border/60 bg-ag-bg/80 backdrop-blur flex items-center justify-between shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="w-4 h-4 text-ag-accent shrink-0" />
          <span className="text-xs font-semibold text-ag-text truncate">{opened.name}</span>
          <span
            className="text-2xs font-mono text-ag-text-muted truncate max-w-[280px]"
            title={opened.path}
          >
            {opened.path}
          </span>
          {dirty && <span className="text-ag-amber text-xs" title="Alterações não salvas">●</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void save()}
            disabled={!dirty && !saving}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-ag-border text-ag-text hover:bg-ag-bg-hover disabled:opacity-40 transition-all"
            title="Salvar (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
          </button>
          <button
            onClick={toggleChat}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all duration-200 ${
              chatOpen
                ? 'bg-ag-bg-active text-ag-accent border-ag-border-focus/40'
                : 'text-ag-text-muted border-transparent hover:bg-ag-bg-hover hover:text-ag-text'
            }`}
            title="Chat IA sobre este arquivo"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-2xs">Chat IA</span>
          </button>
          <button
            onClick={closeFile}
            className="w-7 h-7 flex items-center justify-center rounded text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover transition-colors"
            title="Fechar arquivo (voltar ao chat)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Banner de alteração externa pela IA */}
      {externalChange && (
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-ag-amber/10 border-b border-ag-amber/30 text-xs text-ag-amber shrink-0">
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            A IA alterou este arquivo no disco e você tem edições não salvas.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void reloadFromDisk()}
              className="px-2 py-0.5 rounded bg-ag-amber/20 hover:bg-ag-amber/30 border border-ag-amber/40 text-ag-text font-medium"
            >
              Recarregar do disco
            </button>
            <button
              onClick={() => useEditorStore.getState().dismissExternalChange()}
              className="px-2 py-0.5 rounded hover:bg-ag-bg-hover text-ag-text-secondary"
            >
              Manter o meu
            </button>
          </div>
        </div>
      )}

      {/* Corpo: editor + painel de chat togglable */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 overflow-auto cm-host">
          <div ref={editorHostRef} className="min-h-full" />
          {!opened.path && (
            <div className="p-6 text-xs text-ag-text-muted flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Nenhum arquivo aberto.
            </div>
          )}
        </div>

        {chatOpen && conversationId && (
          <div className="w-[420px] min-w-[340px] border-l border-ag-border flex flex-col bg-ag-bg-secondary">
            <div className="px-3 py-2 border-b border-ag-border/70 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ag-text-muted truncate">
                Chat — {opened.name}
              </span>
              <button
                type="button"
                onClick={() => setOnlyThisFile(!onlyThisFile)}
                title="Ao clicar nesta opção a IA só modificará este arquivo aberto no momento"
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all shrink-0 ${
                  onlyThisFile
                    ? 'bg-ag-accent/15 text-ag-accent border-ag-accent/40'
                    : 'text-ag-text-muted border-ag-border hover:border-ag-border-focus/50 hover:text-ag-text'
                }`}
              >
                Somente este arquivo
              </button>
            </div>

            {busyNotice && (
              <div className="px-3 py-2 text-[11px] text-ag-amber bg-ag-amber/10 border-b border-ag-amber/30">
                {busyNotice}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-ag-text-muted gap-2 px-4">
                  <MessageSquare className="w-6 h-6 opacity-50" />
                  <p className="text-[11px]">
                    Peça ajuda sobre este arquivo ou projeto. A IA está no modo projeto
                    (pode criar e editar arquivos), com contexto deste arquivo.
                  </p>
                </div>
              ) : (
                messages.map((m) => <MessageItem key={m.id} message={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 shrink-0 border-t border-ag-border/60">
              <PromptBox
                onSendMessage={handleSend}
                isGenerating={isGenerating}
                onStopGenerating={handleStop}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
