import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { ThinkingBlock } from '../../types';

interface ThinkingAccordionProps {
  thinking: ThinkingBlock;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({ thinking }) => {
  const [isOpen, setIsOpen] = useState(thinking.isExpanded ?? false);
  const isFinished = thinking.durationMs > 0;
  const durationText = isFinished ? `${(thinking.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <div className="w-full my-2.5 rounded-lg border border-ag-border/80 bg-ag-bg-card/40 transition-colors overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-ag-text-secondary hover:text-ag-text hover:bg-ag-bg-hover/50 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-ag-indigo shrink-0" />
          <span className="font-medium text-ag-text-secondary">
            {isFinished ? 'Raciocínio concluído' : 'Pensando...'}
          </span>
          {durationText && (
            <span className="px-1.5 py-0.5 rounded-full text-2xs font-mono font-medium bg-ag-bg border border-ag-border text-ag-text-muted">
              {durationText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-ag-text-muted">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 py-2.5 border-t border-ag-border/60 bg-ag-bg-card/70 animate-fade-in">
          <div className="border-l-2 border-ag-indigo pl-3 max-h-60 overflow-y-auto">
            <pre className="font-mono text-xs text-ag-text-secondary whitespace-pre-wrap break-words leading-relaxed m-0 bg-transparent !border-0 !p-0">
              {thinking.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
