import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  FileText,
  FilePen,
  FileOutput,
  Search,
  Globe,
  Wrench,
  ChevronDown,
  MessageSquareText,
  ChevronUp
} from 'lucide-react';
import { ToolCall } from '../../types';
import { AskUserCard } from './AskUserCard';
import { useAskStore } from '../../store/ask-store';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const getToolIcon = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('ask_user')) {
    return MessageSquareText;
  }
  if (normalized.includes('command') || normalized.includes('terminal') || normalized.includes('bash')) {
    return Terminal;
  }
  if (normalized.includes('replace') || normalized.includes('edit')) {
    return FilePen;
  }
  if (normalized.includes('write')) {
    return FileOutput;
  }
  if (normalized.includes('view') || normalized.includes('read')) {
    return FileText;
  }
  if (normalized.includes('search') || normalized.includes('find')) {
    return Search;
  }
  if (normalized.includes('web') || normalized.includes('browser') || normalized.includes('url')) {
    return Globe;
  }
  return Wrench;
};

// Simple ANSI color code to CSS class / style mapper
const renderAnsiText = (text: string): React.ReactNode => {
  // Pattern matches ANSI escape codes: \u001b[...m
  const ansiRegex = /\u001b\[([0-9;]+)m/g;
  if (!ansiRegex.test(text)) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor = '';

  const colorMap: Record<string, string> = {
    '30': 'text-gray-500',
    '31': 'text-ag-red',
    '32': 'text-ag-green',
    '33': 'text-ag-amber',
    '34': 'text-ag-accent',
    '35': 'text-purple-400',
    '36': 'text-cyan-400',
    '37': 'text-gray-200',
    '90': 'text-gray-400',
    '91': 'text-red-400',
    '92': 'text-emerald-400',
    '93': 'text-yellow-300',
    '94': 'text-blue-400',
    '95': 'text-fuchsia-400',
    '96': 'text-cyan-300',
    '97': 'text-white'
  };

  const regex = /\u001b\[([0-9;]+)m/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex} className={currentColor}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    const code = match[1];
    if (code === '0') {
      currentColor = '';
    } else {
      currentColor = colorMap[code] || currentColor;
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={lastIndex} className={currentColor}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts;
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('output');

  const hasPendingAsk = useAskStore((s) => !!s.pending[toolCall.id]);
  const hasAnsweredAsk = useAskStore((s) => !!s.submitted[toolCall.id]);
  const showAsk = toolCall.name === 'ask_user' && (hasPendingAsk || hasAnsweredAsk);
  const cardRef = useRef<HTMLDivElement>(null);

  // Abre e rola até as perguntas: a execução fica bloqueada aguardando o usuário.
  useEffect(() => {
    if (!showAsk) return;
    setIsOpen(true);
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [showAsk]);

  const Icon = getToolIcon(toolCall.name);

  const durationFormatted =
    typeof toolCall.durationMs === 'number'
      ? toolCall.durationMs < 1000
        ? `${toolCall.durationMs}ms`
        : `${(toolCall.durationMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div ref={cardRef} className="w-full my-2.5 rounded-lg border border-ag-border bg-ag-bg-card overflow-hidden text-xs">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-ag-bg-card hover:bg-ag-bg-hover transition-colors text-left select-none cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded bg-ag-bg-secondary border border-ag-border text-ag-text-secondary shrink-0">
            <Icon className="w-3.5 h-3.5 text-ag-accent" />
          </div>
          <span className="font-semibold text-ag-text truncate">
            {toolCall.displayName || toolCall.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Status Badge */}
          {toolCall.status === 'running' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-ag-amber/10 border border-ag-amber/30 text-ag-amber">
              <span className="w-1.5 h-1.5 rounded-full bg-ag-amber animate-pulse" />
              Executando...
            </span>
          )}
          {toolCall.status === 'completed' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-ag-green/10 border border-ag-green/30 text-ag-green">
              <span className="w-1.5 h-1.5 rounded-full bg-ag-green" />
              Concluído
            </span>
          )}
          {toolCall.status === 'failed' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-ag-red/10 border border-ag-red/30 text-ag-red">
              <span className="w-1.5 h-1.5 rounded-full bg-ag-red" />
              Falhou
            </span>
          )}

          {/* Duration */}
          {durationFormatted && (
            <span className="text-2xs font-mono text-ag-text-muted">
              {durationFormatted}
            </span>
          )}

          {/* Chevron */}
          <span className="text-ag-text-muted ml-0.5">
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="border-t border-ag-border bg-ag-bg animate-fade-in">
          {showAsk && <AskUserCard requestId={toolCall.id} />}
          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-ag-border/70 bg-ag-bg-secondary">
            <button
              type="button"
              onClick={() => setActiveTab('input')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'input'
                  ? 'border-ag-accent text-ag-text'
                  : 'border-transparent text-ag-text-muted hover:text-ag-text-secondary'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('output')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'output'
                  ? 'border-ag-accent text-ag-text'
                  : 'border-transparent text-ag-text-muted hover:text-ag-text-secondary'
              }`}
            >
              Saída
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3">
            {activeTab === 'input' ? (
              <pre className="font-mono text-xs text-ag-text-secondary bg-ag-bg-card p-3 rounded border border-ag-border overflow-x-auto whitespace-pre-wrap leading-relaxed m-0">
                {toolCall.input || '// Nenhuma entrada informada'}
              </pre>
            ) : (
              <pre className="font-mono text-xs text-ag-text bg-ag-bg-card p-3 rounded border border-ag-border overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed m-0">
                {toolCall.output ? renderAnsiText(toolCall.output) : '// Aguardando saída...'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
