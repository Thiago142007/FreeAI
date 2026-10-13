import React from 'react';
import { useSettingsStore } from '../../../store/settings-store';
import { Settings, Shield, Globe, Cpu, Palette, FolderOpen, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const provider = useSettingsStore((state) => state.provider);
  const setProvider = useSettingsStore((state) => state.setProvider);
  const mode = useSettingsStore((state) => state.mode);
  const setMode = useSettingsStore((state) => state.setMode);
  const cwd = useSettingsStore((state) => state.cwd);
  const setCwd = useSettingsStore((state) => state.setCwd);

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-4 animate-fade-in text-xs">
      {/* Provider Setting */}
      <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-ag-text">
          <Cpu className="w-3.5 h-3.5 text-ag-accent" />
          <span>Provedor de IA Padrão</span>
        </div>
        <p className="text-[11px] text-ag-text-muted">
          Selecione qual provedor web headless será utilizado para gerar respostas e tool calls gratuitas.
        </p>

        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {[
            { id: 'deepseek', label: 'DeepSeek (DeepThink R1 / V3)', note: 'Recomendado para Coding' },
            { id: 'gemini', label: 'Google Gemini 2.5 Flash', note: 'Mais rápido e conciso' },
            { id: 'chatgpt', label: 'ChatGPT (GPT-4o / o1)', note: 'Raciocínio OpenAI' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setProvider(item.id as any)}
              className={`p-2 rounded-md border text-left transition-all flex items-center justify-between ${provider === item.id
                  ? 'bg-ag-bg-active border-ag-accent text-ag-text font-medium'
                  : 'bg-ag-bg border-ag-border text-ag-text-secondary hover:text-ag-text'
                }`}
            >
              <div>
                <span className="block text-xs">{item.label}</span>
                <span className="text-[10px] text-ag-text-muted font-normal">{item.note}</span>
              </div>
              {provider === item.id && <Check className="w-3.5 h-3.5 text-ag-accent" />}
            </button>
          ))}
        </div>
      </div>

      {/* Headless Engine Settings */}
      <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-ag-text">
          <Globe className="w-3.5 h-3.5 text-ag-indigo" />
          <span>Navegador em background (Electron)</span>
        </div>
        <p className="text-[11px] text-ag-text-muted">
          Configurações da automação em segundo plano sem interface gráfica visível.
        </p>

        <div className="space-y-2 pt-1 font-mono text-[11px]">
          <div className="flex items-center justify-between p-2 rounded bg-ag-bg border border-ag-border">
            <span className="text-ag-text-secondary font-sans text-xs">Modo Headless</span>
            <span className="text-ag-green font-semibold">100% Oculto</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-ag-bg border border-ag-border">
            <span className="text-ag-text-secondary font-sans text-xs">Cofre de Sessão</span>
            <span className="text-ag-text-muted">~/.config/freeai</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-ag-bg border border-ag-border">
            <span className="text-ag-text-secondary font-sans text-xs">Porta IPC Local</span>
            <span className="text-ag-accent font-semibold">17613 (WS)</span>
          </div>
        </div>
      </div>

      {/* Tool execution behavior */}
      <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-ag-text">
          <Shield className="w-3.5 h-3.5 text-ag-green" />
          <span>Execução de Comandos</span>
        </div>
        <p className="text-[11px] text-ag-text-muted">
          Os comandos são executados diretamente no shell do sistema, sem sandbox isolada ou confirmação obrigatória.
        </p>
      </div>

      {/* Workspace directory */}
      <div className="p-3 rounded-lg bg-ag-bg-card border border-ag-border space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-ag-text">
          <FolderOpen className="w-3.5 h-3.5 text-ag-amber" />
          <span>Diretório do Projeto (CWD)</span>
        </div>
        <input
          type="text"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded bg-ag-bg border border-ag-border text-xs font-mono text-ag-text focus:outline-none focus:border-ag-accent"
        />
      </div>
    </div>
  );
};
