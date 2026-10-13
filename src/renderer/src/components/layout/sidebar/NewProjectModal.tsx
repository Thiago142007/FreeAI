import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, X, Plus } from 'lucide-react';
import { useChatStore } from '../../../store/chat-store';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ open, onClose }) => {
  const createProject = useChatStore((state) => state.createProject);
  const createConversation = useChatStore((state) => state.createConversation);

  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFolderPath(null);
      setName('');
      setNameEdited(false);
      setError(null);
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePickFolder = async () => {
    setError(null);
    if (!window.freeai) {
      setError('Selecione pastas funciona apenas dentro do app desktop (Electron).');
      return;
    }
    const picked = await window.freeai.pickProjectFolder();
    if (!picked) return;
    setFolderPath(picked.folderPath);
    if (!nameEdited) setName(picked.name);
  };

  const handleCreate = async () => {
    if (!folderPath || !name.trim()) return;
    setBusy(true);
    try {
      const project = await createProject(name.trim(), folderPath);
      createConversation(undefined, undefined, project.folderPath, project.id);
      onClose();
    } catch (err: any) {
      setError(`Falha ao criar projeto: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Novo Projeto"
    >
      <div
        className="w-[440px] max-w-[92vw] rounded-xl bg-ag-bg-secondary border border-ag-border shadow-glow-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ag-text uppercase tracking-wide">Novo Projeto</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handlePickFolder}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-ag-border-light bg-ag-bg hover:bg-ag-bg-hover text-ag-text-muted hover:text-ag-text transition-all duration-200"
        >
          <FolderOpen className="w-6 h-6" />
          <span className="text-xs font-medium">
            {folderPath ? 'Trocar pasta do projeto' : 'Clique para selecionar a pasta do projeto'}
          </span>
          {folderPath && (
            <span className="text-[11px] font-mono text-ag-accent truncate max-w-full px-4">{folderPath}</span>
          )}
        </button>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ag-text-muted" htmlFor="project-name">
            Nome do projeto
          </label>
          <input
            id="project-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameEdited(true);
            }}
            placeholder="O nome da pasta aparece aqui (editável)"
            className="w-full px-3 py-2 rounded-lg bg-ag-bg border border-ag-border text-xs text-ag-text placeholder-ag-text-muted focus:outline-none focus:border-ag-border-focus focus:shadow-glow transition-all"
          />
        </div>

        {error && <p className="text-[11px] text-ag-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs text-ag-text-secondary hover:bg-ag-bg-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!folderPath || !name.trim() || busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ag-accent hover:bg-ag-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-ag-bg text-xs font-medium shadow-glow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{busy ? 'Criando...' : 'Novo Projeto'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
