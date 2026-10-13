import React from 'react';
import { Check, Image as ImageIcon, Loader2 } from 'lucide-react';
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

  const meta = getProviderMeta(provider);
  const models = meta?.modelOptions || [];
  const caps = (meta?.capabilities || []).filter((c) => c.id !== 'vision');

  if (models.length === 0 && caps.length === 0) return null;

  const isLimited = (key: string) => !!limited[`${provider}:${key}`] || !!limited[`${provider}:chat`];

  const busy = providerBusy[provider];
  const busyElsewhere = !!busy && busy.conversationId !== activeConversationId;
  const busyModelLabel = busy?.modelId
    ? models.find((m) => m.id === busy.modelId)?.label || busy.modelId
    : null;

  const chipClass = (active: boolean, disabled: boolean, inUse: boolean) =>
    `flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border transition-all ${
      inUse
        ? 'bg-ag-amber/15 text-ag-amber border-ag-amber/40 opacity-90'
        : disabled
        ? 'bg-ag-red/15 text-ag-red border-ag-red/40 cursor-not-allowed opacity-60'
        : active
        ? 'bg-ag-accent/15 text-ag-accent border-ag-accent/40'
        : 'text-ag-text-muted border-ag-border hover:border-ag-border-focus/50 hover:text-ag-text'
    }`;

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
      {models.map((m) => {
        const disabled = isLimited(`model:${m.id}`) || (busyElsewhere && busy?.modelId !== m.id);
        const inUse = busyElsewhere && busy?.modelId === m.id;
        const active = activeModels[provider] === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled || inUse}
            title={
              inUse
                ? 'Modelo em uso em outra conversa — um modelo não responde duas conversas ao mesmo tempo'
                : busyElsewhere
                ? 'Provedor ocupado em outra conversa'
                : disabled
                ? 'Limite atingido — indisponível'
                : `Modelo: ${m.label}`
            }
            onClick={() => setActiveModel(provider, active ? '' : m.id)}
            className={chipClass(active, disabled, !!inUse)}
          >
            {inUse ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? <Check className="w-3 h-3" /> : null}
            <span className="truncate max-w-[120px]">
              {m.label}
              {inUse ? ' · em uso' : ''}
            </span>
          </button>
        );
      })}
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
            className={chipClass(active, disabled, false)}
          >
            <ImageIcon className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
};
