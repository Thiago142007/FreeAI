import React, { useEffect, useMemo, useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderInput,
  AlertTriangle
} from 'lucide-react';
import { useSettingsStore } from '../../../store/settings-store';
import { useChatStore } from '../../../store/chat-store';
import { useEditorStore } from '../../../store/editor-store';

interface FsEntry {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
}

export const FileExplorerView: React.FC = () => {
  const cwd = useSettingsStore((s) => s.cwd);
  const projects = useChatStore((s) => s.projects);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const explorerRootOverride = useEditorStore((s) => s.explorerRootOverride);
  const setExplorerRootOverride = useEditorStore((s) => s.setExplorerRootOverride);
  const openFile = useEditorStore((s) => s.openFile);
  const editorError = useEditorStore((s) => s.error);
  const clearEditorError = useEditorStore((s) => s.clearError);
  const openedPath = useEditorStore((s) => s.opened.path);

  const [childrenMap, setChildrenMap] = useState<Record<string, FsEntry[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [treeError, setTreeError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const root = useMemo(() => {
    if (explorerRootOverride) return explorerRootOverride;
    const conv = conversations.find((c) => c.id === activeConversationId);
    const project = conv?.projectId ? projects.find((p) => p.id === conv.projectId) : undefined;
    if (project) return project.folderPath;
    return cwd;
  }, [explorerRootOverride, conversations, activeConversationId, projects, cwd]);

  useEffect(() => {
    if (!window.freeai) return;
    let cancelled = false;
    window.freeai.fsTree(root).then((res) => {
      if (cancelled) return;
      setTreeError(res.error ?? null);
      setChildrenMap({ [root]: res.entries ?? [] });
      setExpanded({});
    });
    return () => {
      cancelled = true;
    };
  }, [root, reloadToken]);

  const activeProjectId = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    const project = conv?.projectId
      ? projects.find((p) => p.id === conv.projectId)
      : undefined;
    const anyByRoot = projects.find((p) => p.folderPath === root);
    return (project?.folderPath === root ? project.id : undefined) ?? anyByRoot?.id ?? null;
  }, [conversations, activeConversationId, projects, root]);

  const toggleFolder = async (dirPath: string) => {
    const isOpen = !!expanded[dirPath];
    if (!isOpen && !childrenMap[dirPath] && window.freeai) {
      const res = await window.freeai.fsTree(dirPath);
      setChildrenMap((prev) => ({ ...prev, [dirPath]: res.entries ?? [] }));
      if (res.error) setTreeError(res.error);
    }
    setExpanded((prev) => ({ ...prev, [dirPath]: !isOpen }));
  };

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="w-3.5 h-3.5 text-ag-accent shrink-0" />;
      case 'json':
        return <FileJson className="w-3.5 h-3.5 text-ag-amber shrink-0" />;
      case 'md':
        return <FileText className="w-3.5 h-3.5 text-ag-indigo shrink-0" />;
      case 'css':
      case 'html':
        return <FileCode className="w-3.5 h-3.5 text-ag-green shrink-0" />;
      default:
        return <File className="w-3.5 h-3.5 text-ag-text-muted shrink-0" />;
    }
  };

  const renderEntry = (entry: FsEntry, depth: number) => {
    const isOpen = !!expanded[entry.path];
    const isSelected = openedPath === entry.path;

    if (entry.type === 'folder') {
      return (
        <div key={entry.path}>
          <div
            onClick={() => void toggleFolder(entry.path)}
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            className="flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-ag-bg-hover cursor-pointer text-xs text-ag-text-secondary hover:text-ag-text transition-colors"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-ag-text-muted shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-ag-text-muted shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-ag-accent shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-ag-text-muted shrink-0" />
            )}
            <span className="truncate font-medium">{entry.name}</span>
          </div>
          {isOpen && (childrenMap[entry.path] || []).map((child) => renderEntry(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={entry.path}
        onClick={() => void openFile(entry.path, root, activeProjectId)}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
        className={`flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-ag-bg-active text-ag-text font-medium border-l-2 border-ag-accent'
            : 'text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text'
        }`}
        title={entry.path}
      >
        {fileIcon(entry.name)}
        <span className="truncate">{entry.name}</span>
      </div>
    );
  };

  const handlePickFolder = async () => {
    if (!window.freeai) return;
    const picked = await window.freeai.fsPickFolder();
    if (picked) setExplorerRootOverride(picked);
  };

  return (
    <div className="flex-1 flex flex-col p-2 overflow-hidden animate-fade-in">
      {/* Explorer action bar */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-ag-border/50 text-xs">
        <div className="flex items-center gap-1.5 text-ag-text-muted truncate max-w-[160px]" title={root}>
          <span className="font-mono text-[10px] truncate">{root.split('/').pop() || root}</span>
        </div>
        <div className="flex items-center gap-1 text-ag-text-muted">
          <button
            onClick={handlePickFolder}
            className="p-1 rounded hover:bg-ag-bg-card hover:text-ag-text transition-colors"
            title="Abrir pasta..."
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setReloadToken((t) => t + 1)}
            className="p-1 rounded hover:bg-ag-bg-card hover:text-ag-text transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {(treeError || editorError) && (
        <div
          className="mb-1 px-2 py-1.5 rounded bg-ag-red/10 border border-ag-red/30 text-[11px] text-ag-red flex items-start justify-between gap-1 cursor-pointer"
          onClick={clearEditorError}
          title="Clique para dispensar"
        >
          <span className="flex items-center gap-1 min-w-0">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{editorError ?? treeError}</span>
          </span>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 font-mono text-[11px]">
        {(childrenMap[root] || []).map((entry) => renderEntry(entry, 0))}
        {!window.freeai && (
          <div className="p-3 text-[11px] text-ag-text-muted">
            Árvore real disponível apenas dentro do app desktop.
          </div>
        )}
      </div>
    </div>
  );
};
