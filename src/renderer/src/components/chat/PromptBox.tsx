import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  ArrowUp,
  Square,
  Globe,
  Paperclip,
  Target,
  ListChecks,
  Clock,
  Compass,
  BookOpen,
  FileCode,
  Terminal,
  Shield
} from 'lucide-react';
import { ModelSelector } from '../common/ModelSelector';
import { ModeSelector } from '../common/ModeSelector';
import { VariantSelector } from '../common/VariantSelector';
import { useSettingsStore } from '../../store/settings-store';

interface PromptBoxProps {
  onSendMessage?: (content: string) => void;
  isGenerating?: boolean;
  onStopGenerating?: () => void;
}

interface SlashCommandItem {
  command: string;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    command: '/goal',
    label: 'Definir Meta',
    description: 'Estabelecer objetivo ou missão de alto nível para o agente',
    icon: Target
  },
  {
    command: '/plan',
    label: 'Plano Estruturado',
    description: 'Criar plano de execução com passos e dependências',
    icon: ListChecks
  },
  {
    command: '/schedule',
    label: 'Agendador',
    description: 'Configurar temporizador ou tarefa cron em segundo plano',
    icon: Clock
  },
  {
    command: '/browser',
    label: 'Navegador Web',
    description: 'Abrir sessão do navegador para pesquisa e navegação autônoma',
    icon: Compass
  },
  {
    command: '/learn',
    label: 'Aprender Regra',
    description: 'Gravar diretrizes de projeto ou memória persistente',
    icon: BookOpen
  }
];

const MENTION_ITEMS = [
  {
    token: '@files',
    label: 'Arquivos do Projeto',
    description: 'Referenciar código, diretórios ou arquivos locais',
    icon: FileCode
  },
  {
    token: '@terminal',
    label: 'Sessão Terminal',
    description: 'Capturar ou injetar comandos do terminal ativo',
    icon: Terminal
  },
  {
    token: '@rules',
    label: 'Regras de Contexto',
    description: 'Incluir instruções do sistema e regras de estilo',
    icon: Shield
  }
];

export const PromptBox: React.FC<PromptBoxProps> = ({
  onSendMessage,
  isGenerating = false,
  onStopGenerating
}) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { webSearchEnabled, toggleWebSearch } = useSettingsStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 44), 200)}px`;
    }
  }, [content]);

  // Slash and Mention triggers
  useEffect(() => {
    if (content.startsWith('/')) {
      setShowSlashMenu(true);
      setShowMentionMenu(false);
      setSelectedMenuIndex(0);
    } else if (content.includes('@')) {
      setShowMentionMenu(true);
      setShowSlashMenu(false);
      setSelectedMenuIndex(0);
    } else {
      setShowSlashMenu(false);
      setShowMentionMenu(false);
    }
  }, [content]);

  const handleSelectSlash = (item: SlashCommandItem) => {
    setContent(`${item.command} `);
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectMention = (item: typeof MENTION_ITEMS[0]) => {
    const lastAtIndex = content.lastIndexOf('@');
    const newContent = content.substring(0, lastAtIndex) + `${item.token} `;
    setContent(newContent);
    setShowMentionMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev + 1) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlash(SLASH_COMMANDS[selectedMenuIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    if (showMentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev + 1) % MENTION_ITEMS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev - 1 + MENTION_ITEMS.length) % MENTION_ITEMS.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(MENTION_ITEMS[selectedMenuIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || isGenerating) return;

    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setContent('');
    setShowSlashMenu(false);
    setShowMentionMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Slash Command Popover */}
      {showSlashMenu && (
        <div className="absolute left-4 bottom-[calc(100%-8px)] w-80 rounded-xl bg-ag-bg-card border border-ag-border shadow-2xl z-50 overflow-hidden animate-slide-up">
          <div className="px-3.5 py-2 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border bg-ag-bg-secondary">
            Comandos Rápidos
          </div>
          <div className="p-1.5 space-y-0.5">
            {SLASH_COMMANDS.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedMenuIndex;
              return (
                <button
                  key={item.command}
                  type="button"
                  onClick={() => handleSelectSlash(item)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-ag-bg-active text-ag-text'
                      : 'text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text'
                  }`}
                >
                  <div className="p-1 rounded bg-ag-bg border border-ag-border text-ag-accent shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-ag-text flex items-center gap-1.5">
                      <span className="font-mono text-ag-accent">{item.command}</span>
                      <span>— {item.label}</span>
                    </div>
                    <div className="text-2xs text-ag-text-muted leading-tight mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mention Menu Popover */}
      {showMentionMenu && (
        <div className="absolute left-4 bottom-[calc(100%-8px)] w-72 rounded-xl bg-ag-bg-card border border-ag-border shadow-2xl z-50 overflow-hidden animate-slide-up">
          <div className="px-3.5 py-2 text-2xs font-semibold uppercase tracking-wider text-ag-text-muted border-b border-ag-border bg-ag-bg-secondary">
            Mencionar Recurso
          </div>
          <div className="p-1.5 space-y-0.5">
            {MENTION_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedMenuIndex;
              return (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleSelectMention(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-ag-bg-active text-ag-text'
                      : 'text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text'
                  }`}
                >
                  <div className="p-1 rounded bg-ag-bg border border-ag-border text-ag-indigo shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-ag-text font-mono">{item.token}</div>
                    <div className="text-2xs text-ag-text-muted leading-tight">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div
        className={`w-full rounded-xl bg-ag-bg-card border transition-all duration-200 ${
          isFocused
            ? 'border-ag-border-focus shadow-glow'
            : 'border-ag-border hover:border-ag-border-light shadow-md'
        }`}
      >
        {/* Input Textarea Area */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Pergunte ao FreeAI... (Ctrl+L para focar, / para comandos, Ctrl+N novo chat)"
            className="w-full bg-transparent border-none outline-none resize-none font-sans text-sm text-ag-text placeholder-ag-text-muted leading-relaxed"
            style={{ maxHeight: '200px' }}
          />
        </div>

        {/* Bottom Toolbar Row */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-ag-border/50 bg-ag-bg-card/90 rounded-b-xl">
          {/* Left tools */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <ModelSelector />
            <ModeSelector />
            <VariantSelector />

            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={toggleWebSearch}
              title={webSearchEnabled ? 'Pesquisa Web ativada' : 'Ativar Pesquisa Web'}
              className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                webSearchEnabled
                  ? 'bg-ag-accent/15 border-ag-accent/40 text-ag-accent shadow-sm'
                  : 'bg-ag-bg-secondary border-ag-border text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
            </button>

            {/* Attach button */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const fileName = e.target.files[0].name;
                  setContent((prev) => `${prev} @${fileName} `);
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Anexar arquivo"
              className="p-1.5 rounded-lg border bg-ag-bg-secondary border-ag-border text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-3 shrink-0">
            {charCount > 0 && (
              <span className="text-2xs font-mono text-ag-text-muted select-none">
                {charCount} carac{lineCount > 1 ? ` • ${lineCount} lin` : ''}
              </span>
            )}

            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="w-7 h-7 rounded-full bg-ag-red hover:bg-red-600 text-white flex items-center justify-center transition-all duration-200 shadow-sm focus:outline-none"
                title="Interromper geração"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!content.trim()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                  content.trim()
                    ? 'bg-ag-accent hover:bg-ag-accent-hover text-ag-bg shadow-glow-sm cursor-pointer'
                    : 'bg-ag-bg-active text-ag-text-muted cursor-not-allowed opacity-60'
                }`}
                title="Enviar mensagem (Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
