import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useSettingsStore } from '../../store/settings-store';

export const TitleBar: React.FC = () => {
  const isMac = window.electronAPI?.platform === 'darwin';
  const cwd = useSettingsStore((state) => state.cwd);
  const provider = useSettingsStore((state) => state.provider);
  const providerStatus = useSettingsStore((state) => state.providerStatus);

  const currentStatus = providerStatus[provider] || 'connected';
  const isOnline = currentStatus === 'connected';

  const providerDisplayName =
    provider === 'deepseek' ? 'DeepSeek' : provider === 'gemini' ? 'Gemini' : 'ChatGPT';

  const handleMinimize = (): void => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = (): void => {
    window.electronAPI?.maximize();
  };

  const handleClose = (): void => {
    window.electronAPI?.close();
  };

  return (
    <header
      className={`h-[38px] min-h-[38px] w-full bg-ag-bg-secondary border-b border-ag-border flex items-center justify-between py-1 pe-3 select-none z-50 text-xs ${isMac ? 'ps-[74px]' : 'ps-3'}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side: Logo & CWD */}
      <div className="flex items-center space-x-3 overflow-hidden pr-2">
        <div className="flex items-center space-x-1.5 font-bold tracking-tight">
          <span className="bg-gradient-to-r from-ag-text via-ag-text-secondary to-ag-text bg-clip-text text-transparent text-sm font-extrabold">
            FreeAI
          </span>
          <span className="text-[10px] font-semibold text-ag-accent px-1 py-0.5 bg-ag-accent/10 rounded border border-ag-accent/20">
            2.0
          </span>
        </div>

        <div className="h-3.5 w-px bg-ag-border mx-1" />

        <div
          className="text-ag-text-muted hover:text-ag-text-secondary truncate max-w-[280px] lg:max-w-[420px] font-mono text-[11px] transition-colors duration-200"
          title={cwd}
        >
          {cwd}
        </div>
      </div>

      {/* Center: Status indicator pill */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ag-bg-card border border-ag-border text-[11px] text-ag-text-secondary shadow-sm">
          <span
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              isOnline ? 'bg-ag-green shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-ag-red'
            }`}
          />
          <span className="font-medium text-ag-text">Headless Engine:</span>
          <span className={isOnline ? 'text-ag-green font-medium' : 'text-ag-red font-medium'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <span className="text-ag-text-muted font-mono text-[10px]">[{providerDisplayName}]</span>
        </div>
      </div>

      {/* Right side: Window controls (native traffic lights take over on macOS) */}
      {!isMac && (
      <div
        className="flex items-center space-x-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover active:bg-ag-bg-active transition-colors duration-150"
          title="Minimize"
          aria-label="Minimize window"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover active:bg-ag-bg-active transition-colors duration-150"
          title="Maximize"
          aria-label="Maximize window"
        >
          <Square className="w-3 h-3" />
        </button>

        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-ag-text-muted hover:text-white hover:bg-ag-red active:bg-red-700 transition-colors duration-150"
          title="Close"
          aria-label="Close window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      )}
    </header>
  );
};
