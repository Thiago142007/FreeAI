import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Sparkles, MessageCircle, Bot, Cpu, Swords, Cloud, Infinity as InfinityIcon, Flower2, Layers, Loader2 } from 'lucide-react';
import { AIProvider, ConnectionStatus } from '../../types';
import { STATIC_PROVIDERS } from '../../provider-meta';
import { useSettingsStore } from '../../store/settings-store';
import { useChatStore } from '../../store/chat-store';

interface ModelSelectorProps {
  value?: AIProvider;
  onChange?: (provider: AIProvider) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bot,
  Sparkles,
  MessageCircle,
  Zap,
  Cpu,
  Swords,
  Cloud,
  Infinity: InfinityIcon,
  Flower2,
  Layers,
};

const SUBTITLES: Record<string, string> = {
  deepseek: 'DeepThink R1 / V3',
  gemini: 'Gemini 2.5 Flash / Pro',
  chatgpt: 'GPT-4o / o1 / o3',
  kimi: 'Instantané · K2.6 · K3',
  glm: 'GLM via chat.z.ai',
  arena: 'Arena (Direct)',
  qwen: 'Qwen3 via chat.qwen.ai',
  meta: 'Instantané / Réflexion',
  dola: 'Experimental',
  useai: 'Use AI · Instant',
};

const PROVIDER_OPTIONS: { id: AIProvider; name: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] =
  STATIC_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: SUBTITLES[p.id] || '',
    icon: ICON_MAP[p.icon] || Bot,
  }));

const getStatusColorClass = (status: ConnectionStatus = 'disconnected') => {
  switch (status) {
    case 'connected':
      return 'bg-ag-green';
    case 'connecting':
      return 'bg-ag-amber animate-pulse';
    case 'disconnected':
      return 'bg-ag-red';
    case 'auth-required':
      return 'bg-ag-text-muted';
    default:
      return 'bg-ag-red';
  }
};

const getProviderDisplayName = (id: AIProvider): string => {
  return PROVIDER_OPTIONS.find((o) => o.id === id)?.name || id;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
  const { provider: storeProvider, setProvider: setStoreProvider, providerStatus, providerBusy } = useSettingsStore();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const currentProvider = value ?? storeProvider;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isBusyElsewhere = (providerId: string) => {
    const info = providerBusy[providerId];
    return !!info && info.conversationId !== activeConversationId;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (providerId: AIProvider) => {
    if (onChange) {
      onChange(providerId);
    } else {
      setStoreProvider(providerId);
    }
    setIsOpen(false);
  };

  const currentStatus = providerStatus[currentProvider] ?? 'disconnected';

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger pill button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-ag-bg-hover hover:bg-ag-bg-active text-ag-text rounded-full px-3 py-1 text-sm border border-ag-border/50 transition-all duration-200 focus:outline-none focus:border-ag-border-focus"
      >
        <span
          className={`w-2 h-2 rounded-full ${getStatusColorClass(currentStatus)} shrink-0`}
          aria-hidden="true"
        />
        <span className="font-medium text-xs text-ag-text">
          {getProviderDisplayName(currentProvider)}
        </span>
        {isBusyElsewhere(currentProvider) && (
          <span
            className="flex items-center gap-0.5 text-[10px] font-mono text-ag-amber"
            title="O provedor está respondendo em outra conversa"
          >
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            em uso
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-ag-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-ag-text' : ''
          }`}
        />
      </button>

      {/* Dropdown menu (appears above trigger) */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-64 bg-ag-bg-card border border-ag-border rounded-lg shadow-xl p-1 z-50 animate-fade-in">
          <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border/50 mb-1">
            Selecione o Provedor
          </div>
          <div className="space-y-1">
            {PROVIDER_OPTIONS.map((option) => {
              const isSelected = option.id === currentProvider;
              const Icon = option.icon;
              const status = providerStatus[option.id] ?? 'disconnected';

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-ag-bg-active border-l-2 border-ag-accent text-ag-text'
                      : 'hover:bg-ag-bg-hover text-ag-text-secondary hover:text-ag-text'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1 rounded-md shrink-0 ${
                        isSelected ? 'bg-ag-accent/15 text-ag-accent' : 'bg-ag-bg-hover text-ag-text-secondary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-ag-text leading-tight truncate">
                        {option.name}
                      </div>
                      <div className="text-2xs text-ag-text-muted leading-tight mt-0.5 truncate">
                        {option.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pl-2 shrink-0">
                    {isBusyElsewhere(option.id) && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-ag-amber/15 text-ag-amber border border-ag-amber/40">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        em uso
                      </span>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full ${getStatusColorClass(status)}`}
                      title={`Status: ${status}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
