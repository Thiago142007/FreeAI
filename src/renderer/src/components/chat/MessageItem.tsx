import React from 'react';
import { User, Bot } from 'lucide-react';
import { Message } from '../../types';
import { ThinkingAccordion } from './ThinkingAccordion';
import { ToolCallCard } from './ToolCallCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: Message;
}

// Nunca mostrar o protocolo de chamada de ferramenta ao usuário: remove blocos completos
// e, se o modelo deixou um bloco aberto (formato desconhecido), corta a partir dele.
const TOOL_MARKUP_STARTERS = [
  /<tool_call[\s>]/i,
  /[<｜|]\s*[|｜]*DSML/i,
  /\binvoke\s+name\s*=\s*["'][^"']+["']/i,
  /<(?:function|tool|call)[\s_]*name\s*=/i,
  /###MCP_TOOL###/i,
  /<\s*im_start\s*>\s*functions\./i
];

function stripToolMarkup(text: string): string {
  let out = text
    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
    .replace(/###MCP_TOOL###[\s\S]*?###END_MCP_TOOL###/gi, '')
    .replace(/[<｜|][|｜\s]*DSML[\s\S]*?[<｜|]\s*\/?[|｜\s]*DSML[|｜\s]*>\s*(?:invoke|calls|tool_calls)\s*>/gi, '');

  let cut = out.length;
  for (const re of TOOL_MARKUP_STARTERS) {
    const m = re.exec(out);
    if (m && m.index < cut) cut = m.index;
  }
  return out.slice(0, cut).trimEnd();
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const formatTimestamp = (date: Date | string | number) => {
    try {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (isUser) {
    return (
      <div className="w-full flex justify-end mb-6 animate-fade-in group">
        <div className="flex items-start gap-3 max-w-[85%] md:max-w-[75%] flex-row-reverse">
          {/* User Avatar */}
          <div className="w-7 h-7 rounded-full bg-ag-bg-active border border-ag-border flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <User className="w-4 h-4 text-ag-text-secondary" />
          </div>

          {/* User Bubble */}
          <div className="flex flex-col items-end">
            <div className="bg-ag-bg-card border border-ag-border/80 text-ag-text px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm transition-all duration-200 hover:border-ag-border-light">
              <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ag-text select-text">
                {message.content}
              </div>
            </div>
            <span className="text-2xs text-ag-text-muted mt-1 px-1 font-mono">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex mb-6 animate-fade-in group">
      <div className="flex items-start gap-3 w-full">
        {/* Assistant Avatar */}
        <div className="w-7 h-7 rounded-full bg-ag-accent/15 border border-ag-accent/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Bot className="w-4 h-4 text-ag-accent" />
        </div>

        {/* Assistant Content Container */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-ag-text">FreeAI</span>
            <span className="text-2xs text-ag-text-muted font-mono">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {/* Thinking Block */}
          {message.thinking && (
            <ThinkingAccordion thinking={message.thinking} />
          )}

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2 my-2">
              {message.toolCalls.map((toolCall) => (
                <ToolCallCard key={toolCall.id} toolCall={toolCall} />
              ))}
            </div>
          )}

          {/* Main Markdown Content */}
          {message.content && (
            <div className="mt-1 text-ag-text">
              <MarkdownRenderer content={stripToolMarkup(message.content)} />
            </div>
          )}

          {/* Streaming Cursor */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-ag-accent animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
};
