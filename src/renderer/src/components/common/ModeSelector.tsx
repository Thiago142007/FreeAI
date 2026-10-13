import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Bot, ListChecks, Zap } from 'lucide-react';
import { AgentMode } from '../../types';
import { useSettingsStore } from '../../store/settings-store';

interface ModeSelectorProps {
  value?: AgentMode;
  onChange?: (mode: AgentMode) => void;
}

interface ModeOption {
  id: AgentMode;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dotColor: string;
  badgeColor: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'agent',
    name: 'Agent',
    description: 'Full autonomous agent with tool execution',
    icon: Bot,
    dotColor: 'bg-ag-accent',
    badgeColor: 'text-ag-accent',
  },
  {
    id: 'planning',
    name: 'Planning',
    description: 'Plan and review before executing',
    icon: ListChecks,
    dotColor: 'bg-ag-indigo',
    badgeColor: 'text-ag-indigo',
  },
  {
    id: 'fast',
    name: 'Fast',
    description: 'Quick responses without tool use',
    icon: Zap,
    dotColor: 'bg-ag-green',
    badgeColor: 'text-ag-green',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange }) => {
  const { mode: storeMode, setMode: setStoreMode } = useSettingsStore();
  const currentMode = value ?? storeMode;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modeId: AgentMode) => {
    if (onChange) {
      onChange(modeId);
    } else {
      setStoreMode(modeId);
    }
    setIsOpen(false);
  };

  const selectedOption = MODE_OPTIONS.find((m) => m.id === currentMode) ?? MODE_OPTIONS[0];
  const CurrentIcon = selectedOption.icon;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger pill button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-ag-bg-hover hover:bg-ag-bg-active text-ag-text rounded-full px-3 py-1 text-sm border border-ag-border/50 transition-all duration-200 focus:outline-none focus:border-ag-border-focus"
      >
        <span className={`w-2 h-2 rounded-full ${selectedOption.dotColor} shrink-0`} aria-hidden="true" />
        <CurrentIcon className={`w-3.5 h-3.5 ${selectedOption.badgeColor} shrink-0`} />
        <span className="font-medium text-xs text-ag-text">{selectedOption.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ag-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-ag-text' : ''
          }`}
        />
      </button>

      {/* Dropdown menu (appears above trigger) */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-72 bg-ag-bg-card border border-ag-border rounded-lg shadow-xl p-1 z-50 animate-fade-in">
          <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border/50 mb-1">
            Modo do Agente
          </div>
          <div className="space-y-1">
            {MODE_OPTIONS.map((option) => {
              const isSelected = option.id === currentMode;
              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-ag-bg-active border-l-2 border-ag-accent text-ag-text'
                      : 'hover:bg-ag-bg-hover text-ag-text-secondary hover:text-ag-text'
                  }`}
                >
                  <div
                    className={`p-1 rounded-md mt-0.5 shrink-0 ${
                      isSelected ? 'bg-ag-accent/15 text-ag-accent' : 'bg-ag-bg-hover text-ag-text-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${option.dotColor}`} />
                      <span className="text-xs font-medium text-ag-text leading-tight">{option.name}</span>
                    </div>
                    <p className="text-2xs text-ag-text-muted leading-relaxed mt-0.5">
                      {option.description}
                    </p>
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
