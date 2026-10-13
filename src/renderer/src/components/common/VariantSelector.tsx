import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Image as ImageIcon, Layers, Loader2 } from 'lucide-react';
import { getProviderMeta } from '../../provider-meta';
import { useSettingsStore } from '../../store/settings-store';
import { useChatStore } from '../../store/chat-store';

export const VariantSelector: React.FC = () => {
  const provider = useSettingsStore((s) => s.provider);
  const activeModels = useSettingsStore((s) => s.activeModels);
  const activeCapabilities = useSettingsStore((s) => s.activeCapabilities);
  const limited = useSettingsStore((s) => s.limitedFeatures);
  const providerBusy = useSettingsStore((s) => s.providerBusy);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);
  const setActiveCapability = useSettingsStore((s) => s.setActiveCapability);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const meta = getProviderMeta(provider);
  const models = meta?.modelOptions || [];
  const caps = (meta?.capabilities || []).filter((c) => c.id !== 'vision');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (models.length === 0 && caps.length === 0) return null;

  const isLimited = (key: string) => !!limited[`${provider}:${key}`] || !!limited[`${provider}:chat`];

  const busy = providerBusy[provider];
  const busyElsewhere = !!busy && busy.conversationId !== activeConversationId;
  const busyModelLabel = busy?.modelId
    ? models.find((m) => m.id === busy.modelId)?.label || busy.modelId
    : null;

  const chipClass = (active: boolean, disabled: boolean) =>
    `flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border transition-all ${
      disabled
        ? 'bg-ag-red/15 text-ag-red border-ag-red/40 cursor-not-allowed opacity-60'
        : active
        ? 'bg-ag-accent/15 text-ag-accent border-ag-accent/40'
        : 'text-ag-text-muted border-ag-border hover:border-ag-border-focus/50 hover:text-ag-text'
    }`;

  const activeModelId = activeModels[provider];
  const activeModelLabel = models.find((m) => m.id === activeModelId)?.label;

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      {busyElsewhere && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-ag-amber/15 text-ag-amber border border-ag-amber/40"
          title="O provedor está respondendo em outra conversa; aguarde para enviar aqui"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>em uso{busyModelLabel ? ` — ${busyModelLabel}` : ''}</span>
        </span>
      )}

      {models.length > 1 && (
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            title={
              busyElsewhere
                ? 'Provedor ocupado em outra conversa'
                : `Modelos de ${meta?.name || provider}`
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-medium border bg-ag-bg-hover hover:bg-ag-bg-active text-ag-text border-ag-border/50 transition-all focus:outline-none focus:border-ag-border-focus"
          >
            <Layers className="w-3 h-3 text-ag-text-secondary" />
            <span className="truncate max-w-[130px]">{activeModelLabel || 'Modelos'}</span>
            <ChevronDown
              className={`w-3 h-3 text-ag-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div className="absolute left-0 bottom-full mb-2 w-60 bg-ag-bg-card border border-ag-border rounded-lg shadow-xl p-1 z-50 animate-fade-in">
              <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border/50 mb-1">
                Selecione o modelo
              </div>
              <div className="space-y-0.5">
                {models.map((m) => {
                  const inUse = busyElsewhere && busy?.modelId === m.id;
                  const disabled = isLimited(`model:${m.id}`) || (busyElsewhere && !inUse);
                  const active = activeModelId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabled || inUse}
                      title={
                        inUse
                          ? 'Modelo em uso em outra conversa — um modelo não responde duas conversas ao mesmo tempo'
                          : disabled
                          ? isLimited(`model:${m.id}`)
                            ? 'Limite atingido — indisponível'
                            : 'Provedor ocupado em outra conversa'
                          : `Modelo: ${m.label}`
                      }
                      onClick={() => {
                        setActiveModel(provider, active ? '' : m.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'bg-ag-bg-active border-l-2 border-ag-accent text-ag-text'
                          : 'text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text border-l-2 border-transparent'
                      }`}
                    >
                      <span className="truncate">{m.label}</span>
                      {inUse ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-ag-amber shrink-0" />
                      ) : active ? (
                        <Check className="w-3.5 h-3.5 text-ag-accent shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provedores com um único modelo continuam com o nome dele à mostra */}
      {models.length === 1 &&
        (() => {
          const m = models[0];
          const disabled = isLimited(`model:${m.id}`) || busyElsewhere;
          const active = activeModelId === m.id;
          return (
            <button
              type="button"
              disabled={disabled}
              title={disabled ? 'Provedor ocupado em outra conversa' : `Modelo: ${m.label}`}
              onClick={() => setActiveModel(provider, active ? '' : m.id)}
              className={chipClass(active, disabled)}
            >
              {active ? <Check className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
              <span className="truncate max-w-[120px]">{m.label}</span>
            </button>
          );
        })()}

      {caps.map((c) => {
        const disabled = isLimited(c.id) || busyElsewhere;
        const active = activeCapabilities[provider] === c.id;
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            title={
              disabled && !isLimited(c.id)
                ? 'Provedor ocupado em outra conversa'
                : disabled
                ? 'Limite atingido — indisponível'
                : c.experimental
                ? `${c.label} (experimental — depende do layout do site)`
                : c.label
            }
            onClick={() => setActiveCapability(provider, active ? null : c.id)}
            className={chipClass(active, disabled)}
          >
            <ImageIcon className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
};
