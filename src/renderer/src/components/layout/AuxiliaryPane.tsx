import React from 'react';
import {
  FileText,
  Terminal as TerminalIcon,
  Globe,
  Bot,
  ListTodo,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useSettingsStore, AuxiliaryTab } from '../../store/settings-store';

interface TabItem {
  id: AuxiliaryTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: TabItem[] = [
  { id: 'artifacts', label: 'Artifacts', icon: FileText },
  { id: 'subagents', label: 'Subagents', icon: Bot },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'browser', label: 'Browser', icon: Globe }
];

export const AuxiliaryPane: React.FC = () => {
  const auxiliaryPaneOpen = useSettingsStore((state) => state.auxiliaryPaneOpen);
  const auxiliaryTab = useSettingsStore((state) => state.auxiliaryTab);
  const setAuxiliaryTab = useSettingsStore((state) => state.setAuxiliaryTab);
  const setAuxiliaryPaneOpen = useSettingsStore((state) => state.setAuxiliaryPaneOpen);
  const providerStatus = useSettingsStore((state) => state.providerStatus);
  const setProviderStatus = useSettingsStore((state) => state.setProviderStatus);

  const browserProviders = [
    { id: 'chatgpt', name: 'ChatGPT / OpenAI', url: 'https://chatgpt.com', status: providerStatus.chatgpt },
    { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', status: providerStatus.deepseek },
    { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com', status: providerStatus.gemini },
    { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com', status: providerStatus.kimi },
    { id: 'glm', name: 'GLM (Z.ai)', url: 'https://chat.z.ai', status: providerStatus.glm },
    { id: 'arena', name: 'Arena AI', url: 'https://arena.ai', status: providerStatus.arena },
    { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai', status: providerStatus.qwen },
    { id: 'meta', name: 'Meta AI', url: 'https://www.meta.ai', status: providerStatus.meta },
    { id: 'dola', name: 'Dola AI', url: 'https://www.dola.com/chat', status: providerStatus.dola },
    { id: 'useai', name: 'Use AI', url: 'https://use.ai', status: providerStatus.useai },
  ];

  return (
    <aside
      className={`h-full bg-ag-bg-secondary border-l border-ag-border flex flex-col transition-all duration-300 ease-in-out select-none overflow-hidden ${
        auxiliaryPaneOpen ? 'w-[380px] min-w-[380px]' : 'w-0 min-w-0 border-l-0'
      }`}
      aria-label="Auxiliary Pane"
    >
      <div className="w-[380px] h-full flex flex-col">
        {/* Top Header & Tab Navigation */}
        <div className="p-2 border-b border-ag-border/70 flex flex-col gap-2 bg-ag-bg-secondary">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-ag-text uppercase tracking-wider">
              Auxiliary Pane
            </span>
            <button
              onClick={() => setAuxiliaryPaneOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover transition-colors duration-150"
              title="Close panel"
              aria-label="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tab Pills */}
          <div className="flex items-center gap-1 bg-ag-bg/80 p-1 rounded-lg border border-ag-border overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => {
              const isActive = auxiliaryTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAuxiliaryTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-ag-bg-active text-ag-accent shadow-sm'
                      : 'text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-ag-bg/30">
          {/* Artifacts Tab */}
          {auxiliaryTab === 'artifacts' && (
            <div className="flex flex-col h-full animate-fade-in text-xs space-y-3">
              <div className="flex items-center justify-between text-ag-text-muted">
                <span>Artefatos do Projeto</span>
                <span className="font-mono text-[10px]">2 gerados</span>
              </div>

              {/* Artifact cards */}
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border hover:border-ag-accent/50 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 font-semibold text-ag-text group-hover:text-ag-accent">
                      <FileText className="w-3.5 h-3.5 text-ag-indigo" />
                      <span>FREEAI_PROJECT_SPEC_AND_STATE.md</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ag-bg text-ag-text-muted">14KB</span>
                  </div>
                  <p className="text-[11px] text-ag-text-muted line-clamp-2">
                    Especificação técnica completa, arquitetura e controle de fases do projeto FreeAI.
                  </p>
                  <div className="mt-2 pt-1.5 border-t border-ag-border/50 flex items-center justify-between text-[10px] text-ag-text-muted font-mono">
                    <span>Markdown</span>
                    <span className="text-ag-green font-semibold">Atualizado</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border hover:border-ag-accent/50 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 font-semibold text-ag-text group-hover:text-ag-accent">
                      <FileText className="w-3.5 h-3.5 text-ag-accent" />
                      <span>freeai_blueprint.md</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ag-bg text-ag-text-muted">7KB</span>
                  </div>
                  <p className="text-[11px] text-ag-text-muted line-clamp-2">
                    Diagrama de arquitetura Mermaid, design tokens Antigravity e fluxo de automação headless.
                  </p>
                  <div className="mt-2 pt-1.5 border-t border-ag-border/50 flex items-center justify-between text-[10px] text-ag-text-muted font-mono">
                    <span>Mermaid + Docs</span>
                    <span className="text-ag-green font-semibold">Validado</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-ag-bg border border-dashed border-ag-border text-center text-ag-text-muted text-[11px]">
                Novos relatórios, planos de execução e arquivos gerados pelo agente aparecerão automaticamente aqui.
              </div>
            </div>
          )}

          {/* Subagents Tab */}
          {auxiliaryTab === 'subagents' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-ag-text-muted">
                <span>Active Subagents</span>
                <span className="font-mono text-[11px]">0 running</span>
              </div>
              <div className="p-4 rounded-lg bg-ag-bg-card border border-ag-border text-center">
                <Bot className="w-8 h-8 text-ag-text-muted mx-auto mb-2 opacity-60" />
                <p className="text-xs font-medium text-ag-text mb-1">No subagent tasks active</p>
                <p className="text-[11px] text-ag-text-muted">
                  Concurrent agent delegations and execution trees will appear here.
                </p>
              </div>
            </div>
          )}

          {/* Tasks Tab */}
          {auxiliaryTab === 'tasks' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-ag-text-muted">
                <span>Background Tasks</span>
                <span className="font-mono text-[11px]">Idle</span>
              </div>
              <div className="p-4 rounded-lg bg-ag-bg-card border border-ag-border text-center">
                <ListTodo className="w-8 h-8 text-ag-text-muted mx-auto mb-2 opacity-60" />
                <p className="text-xs font-medium text-ag-text mb-1">Task queue empty</p>
                <p className="text-[11px] text-ag-text-muted">
                  Long running commands and automation tasks will be monitored here.
                </p>
              </div>
            </div>
          )}

          {/* Terminal Tab */}
          {auxiliaryTab === 'terminal' && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex items-center justify-between text-xs text-ag-text-muted mb-2">
                <span className="font-mono">bash — 80x24</span>
                <span className="flex items-center gap-1.5 text-ag-green font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-ag-green animate-pulse" />
                  online
                </span>
              </div>
              <div className="flex-1 rounded-lg bg-ag-bg border border-ag-border p-3 font-mono text-xs overflow-hidden flex flex-col justify-between shadow-inner">
                <div className="space-y-1.5 text-ag-text-secondary select-text">
                  <p className="text-ag-text-muted">FreeAI Subshell Environment [Linux x86_64]</p>
                  <p className="text-ag-text-muted">Type commands or delegate bash execution to the agent.</p>
                  <div className="pt-2">
                    <span className="text-ag-accent">dream@antigravity</span>
                    <span className="text-ag-text-muted">:</span>
                    <span className="text-ag-green">~/Desktop/FreeAI</span>
                    <span className="text-ag-text-muted">$</span>{' '}
                    <span className="text-ag-text">echo $HEADLESS_ENGINE</span>
                  </div>
                  <p className="text-ag-green">deepseek-reasoner</p>
                  <div className="flex items-center gap-1 pt-1">
                    <span className="text-ag-accent">dream@antigravity</span>
                    <span className="text-ag-text-muted">:</span>
                    <span className="text-ag-green">~/Desktop/FreeAI</span>
                    <span className="text-ag-text-muted">$</span>
                    <span className="w-2 h-4 bg-ag-accent animate-pulse inline-block align-middle ml-1" />
                  </div>
                </div>

                <div className="pt-3 border-t border-ag-border/50 text-[10px] text-ag-text-muted flex items-center justify-between">
                  <span>TTY: /dev/pts/1</span>
                  <span>UTF-8</span>
                </div>
              </div>
            </div>
          )}

          {/* Browser Tab */}
          {auxiliaryTab === 'browser' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-ag-text">Headless Browser Monitor</h4>
                  <p className="text-[11px] text-ag-text-muted">Web driver session states & auth</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-ag-green/10 text-ag-green border border-ag-green/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Chromium 130
                </span>
              </div>

              {/* Provider Status Cards */}
              <div className="space-y-2.5">
                {browserProviders.map((p) => {
                  const isConnected = p.status === 'connected';
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-ag-bg-card border border-ag-border hover:border-ag-border-light transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isConnected
                                ? 'bg-ag-green shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                                : 'bg-ag-red shadow-[0_0_6px_rgba(239,68,68,0.7)]'
                            }`}
                          />
                          <span className="text-xs font-semibold text-ag-text">{p.name}</span>
                        </div>

                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                            isConnected
                              ? 'bg-ag-green/10 text-ag-green border border-ag-green/20'
                              : 'bg-ag-red/10 text-ag-red border border-ag-red/20'
                          }`}
                        >
                          {isConnected ? 'READY' : 'OFFLINE'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-ag-text-muted mt-2">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-ag-accent flex items-center gap-1 font-mono transition-colors"
                        >
                          {p.url}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="font-mono text-[10px] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {isConnected ? 'Sessão salva' : 'Sem sessão'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-ag-text-muted mt-2 pt-1.5 border-t border-ag-border/50">
                        <span>{isConnected ? 'Conectado ao provedor' : 'Clique para fazer login'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.freeai) {
                              window.freeai
                                .openLogin(p.id as any)
                                .then(({ success }) =>
                                  setProviderStatus(
                                    p.id as any,
                                    success ? 'connected' : 'disconnected'
                                  )
                                );
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-ag-bg hover:bg-ag-bg-hover text-ag-accent border border-ag-border hover:border-ag-accent/40 font-medium transition-all"
                        >
                          Conectar Conta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
