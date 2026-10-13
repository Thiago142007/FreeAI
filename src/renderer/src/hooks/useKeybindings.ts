import { useEffect } from 'react';
import { useChatStore } from '../store/chat-store';
import { useSettingsStore } from '../store/settings-store';

export const useKeybindings = () => {
  const createConversation = useChatStore((state) => state.createConversation);
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar);
  const setSidebarOpen = useSettingsStore((state) => state.setSidebarOpen);
  const toggleAuxiliaryPane = useSettingsStore((state) => state.toggleAuxiliaryPane);
  const setAuxiliaryPaneOpen = useSettingsStore((state) => state.setAuxiliaryPaneOpen);
  const setAuxiliaryTab = useSettingsStore((state) => state.setAuxiliaryTab);
  const setSidebarView = useSettingsStore((state) => state.setSidebarView);
  const provider = useSettingsStore((state) => state.provider);
  const mode = useSettingsStore((state) => state.mode);
  const cwd = useSettingsStore((state) => state.cwd);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // 1. Ctrl+N / Cmd+N: Nova Conversa
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const newId = createConversation(provider, mode, cwd);
        setTimeout(() => {
          const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
          textarea?.focus();
        }, 50);
        return;
      }

      // 2. Ctrl+B / Cmd+B: Alternar Barra Lateral (Sidebar)
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 3. Ctrl+J / Cmd+J: Alternar Painel Auxiliar (Auxiliary Pane)
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleAuxiliaryPane();
        return;
      }

      // 4. Ctrl+L / Cmd+L: Focar Caixa de Prompt (Chat Canvas)
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
        textarea?.focus();
        return;
      }

      // 5. Ctrl+I / Cmd+I: Focar Prompt / Inline Command
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
        textarea?.focus();
        return;
      }

      // 6. Ctrl+, : Abrir Configurações
      if (isCmdOrCtrl && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        setSidebarView('settings');
        setSidebarOpen(true);
        return;
      }

      // 7. Ctrl+P / Cmd+P: Explorador de Arquivos / Quick Open
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setSidebarView('explorer');
        setSidebarOpen(true);
        return;
      }

      // 8. Ctrl+Shift+P: Command Palette / Slash Commands
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.focus();
          // Injeta a barra / para acionar o menu de slash commands se estiver vazio
          if (!textarea.value.startsWith('/')) {
            textarea.value = '/' + textarea.value;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        return;
      }

      // 9. Ctrl+Shift+T: Alternar para aba Terminal no Painel Auxiliar
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setAuxiliaryTab('terminal');
        setAuxiliaryPaneOpen(true);
        return;
      }

      // 10. Ctrl+Shift+B: Alternar para aba Browser no Painel Auxiliar
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setAuxiliaryTab('browser');
        setAuxiliaryPaneOpen(true);
        return;
      }

      // 11. Ctrl+Shift+A: Alternar para aba Artifacts no Painel Auxiliar
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAuxiliaryTab('artifacts');
        setAuxiliaryPaneOpen(true);
        return;
      }

      // 12. Escape: Desfocar ou fechar menus
      if (e.key === 'Escape') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    createConversation,
    toggleSidebar,
    setSidebarOpen,
    toggleAuxiliaryPane,
    setAuxiliaryPaneOpen,
    setAuxiliaryTab,
    setSidebarView,
    provider,
    mode,
    cwd
  ]);
};
