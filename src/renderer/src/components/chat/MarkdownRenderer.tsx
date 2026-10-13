import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const textContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-ag-bg-card border border-ag-border font-mono text-xs text-ag-text"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-lg border border-ag-border bg-ag-bg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ag-bg-secondary border-b border-ag-border text-2xs text-ag-text-muted">
        <span className="font-mono uppercase tracking-wider">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-ag-text-secondary hover:text-ag-text hover:bg-ag-bg-hover transition-colors"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-ag-green" />
              <span className="text-ag-green font-medium">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 font-mono text-xs text-ag-text overflow-x-auto m-0 !bg-ag-bg !border-0 leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-ag-text leading-relaxed text-[13.5px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as any,
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-lg font-bold text-ag-text mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-ag-text mt-3.5 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-ag-text mt-3 mb-1.5 first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-ag-text">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-ag-indigo pl-3 py-0.5 my-2 text-ag-text-secondary italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ag-accent hover:underline inline-flex items-center gap-0.5"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-md border border-ag-border">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-ag-bg-secondary px-3 py-2 font-medium text-ag-text border-b border-ag-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-ag-border/50 text-ag-text-secondary">{children}</td>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
