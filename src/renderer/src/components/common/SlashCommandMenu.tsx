import React, { useState, useEffect, useRef } from 'react';
import { Target, ListChecks, Clock, Globe, GraduationCap } from 'lucide-react';

export interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: string) => void;
  filter: string;
}

interface CommandItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COMMANDS: CommandItem[] = [
  {
    id: '/goal',
    name: '/goal',
    description: 'Run a thorough long-running task',
    icon: Target,
  },
  {
    id: '/plan',
    name: '/plan',
    description: 'Create a step-by-step plan',
    icon: ListChecks,
  },
  {
    id: '/schedule',
    name: '/schedule',
    description: 'Schedule a recurring task',
    icon: Clock,
  },
  {
    id: '/browser',
    name: '/browser',
    description: 'Browse the web',
    icon: Globe,
  },
  {
    id: '/learn',
    name: '/learn',
    description: 'Teach FreeAI a new behavior',
    icon: GraduationCap,
  },
];

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  onClose,
  onSelect,
  filter,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanFilter = filter.startsWith('/') ? filter.slice(1).toLowerCase() : filter.toLowerCase();

  const filteredCommands = COMMANDS.filter((cmd) => {
    const cmdClean = cmd.name.replace('/', '').toLowerCase();
    return (
      cmdClean.includes(cleanFilter) ||
      cmd.description.toLowerCase().includes(cleanFilter)
    );
  });

  // Reset selection index when filter changes or opened
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          onSelect(selected.name);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 bottom-full mb-2 w-80 bg-ag-bg-card border border-ag-border rounded-lg shadow-xl p-1 z-50 animate-slide-up select-none"
    >
      <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border/50 mb-1 flex items-center justify-between">
        <span>Comandos Slash</span>
        <span className="text-[10px] text-ag-text-muted lowercase">↑↓ navegar • ↵ escolher</span>
      </div>

      {filteredCommands.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-ag-text-muted">
          Nenhum comando correspondente a "{filter}"
        </div>
      ) : (
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {filteredCommands.map((command, index) => {
            const isSelected = index === selectedIndex;
            const Icon = command.icon;

            return (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onSelect(command.name)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors duration-150 ${
                  isSelected
                    ? 'bg-ag-bg-hover text-ag-text'
                    : 'text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text'
                }`}
              >
                <div
                  className={`p-1.5 rounded-md shrink-0 ${
                    isSelected ? 'bg-ag-accent/20 text-ag-accent' : 'bg-ag-bg-secondary text-ag-text-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-ag-text">{command.name}</span>
                  </div>
                  <p className="text-2xs text-ag-text-muted truncate mt-0.5">
                    {command.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
