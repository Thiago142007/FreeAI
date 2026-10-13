import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreHorizontal,
  FolderTree,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Clock,
  Boxes,
  Settings,
  MessageSquare
} from 'lucide-react';
import { useChatStore } from '../../store/chat-store';
import { useSettingsStore } from '../../store/settings-store';
import { Conversation, Project, SidebarView } from '../../types';
import { FileExplorerView } from './sidebar/FileExplorerView';
import { ScheduledTasksView } from './sidebar/ScheduledTasksView';
import { SkillsView } from './sidebar/SkillsView';
import { SettingsView } from './sidebar/SettingsView';
import { NewProjectModal } from './sidebar/NewProjectModal';

const ConversationRow: React.FC<{ conv: Conversation; projectFolder?: string }> = ({ conv }) => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);

  const isActive = activeConversationId === conv.id;
  const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
  const preview = (lastMessage
    ? lastMessage.content
    : conv.preview || ''
  )
    .replace(/[#*`_~]/g, '')
    .trim();
  const timestamp = new Date(conv.updatedAt || conv.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      onClick={() => setActiveConversation(conv.id)}
      className={`group relative flex flex-col px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 border-l-2 ${
        isActive
          ? 'bg-ag-bg-active border-ag-accent text-ag-text shadow-sm'
          : 'border-transparent text-ag-text-secondary hover:bg-ag-bg-hover hover:text-ag-text'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs font-medium truncate flex-1 text-ag-text">
          {conv.title || 'Untitled Conversation'}
        </span>
        <span className="text-[10px] text-ag-text-muted font-mono flex-shrink-0">{timestamp}</span>
        <button
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-ag-bg-card text-ag-text-muted hover:text-ag-text transition-opacity duration-150"
          title="Conversation actions"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="text-[11px] text-ag-text-muted truncate mt-0.5 group-hover:text-ag-text-secondary transition-colors">
        {preview || 'No messages yet'}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const sidebarOpen = useSettingsStore((state) => state.sidebarOpen);
  const sidebarView = useSettingsStore((state) => state.sidebarView);
  const provider = useSettingsStore((state) => state.provider);
  const mode = useSettingsStore((state) => state.mode);
  const cwd = useSettingsStore((state) => state.cwd);

  const projects = useChatStore((state) => state.projects);
  const conversations = useChatStore((state) => state.conversations);
  const createConversation = useChatStore((state) => state.createConversation);

  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const handleCreateNew = (): void => {
    createConversation(provider, mode, cwd);
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.messages.some((m) => m.content.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  const projectSections = useMemo(() => {
    return projects
      .map((project: Project) => ({
        project,
        chats: filteredConversations
          .filter((c) => c.projectId === project.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      }))
      .filter((section) => !searchQuery.trim() || section.chats.length > 0 || section.project.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [projects, filteredConversations, searchQuery]);

  const standaloneGroups = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterday = today - oneDayMs;
    const sevenDaysAgo = today - 7 * oneDayMs;

    const groups: {
      today: Conversation[];
      yesterday: Conversation[];
      last7Days: Conversation[];
      older: Conversation[];
    } = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: []
    };

    filteredConversations
      .filter((conv) => !conv.projectId)
      .forEach((conv) => {
        const convDate = new Date(conv.updatedAt || conv.createdAt).getTime();
        if (convDate >= today) {
          groups.today.push(conv);
        } else if (convDate >= yesterday) {
          groups.yesterday.push(conv);
        } else if (convDate >= sevenDaysAgo) {
          groups.last7Days.push(conv);
        } else {
          groups.older.push(conv);
        }
      });

    return [
      { title: 'Today', items: groups.today },
      { title: 'Yesterday', items: groups.yesterday },
      { title: 'Last 7 days', items: groups.last7Days },
      { title: 'Older', items: groups.older }
    ].filter((g) => g.items.length > 0);
  }, [filteredConversations]);

  const getViewTitle = (view: SidebarView): string => {
    switch (view) {
      case 'conversations':
        return 'Conversations';
      case 'explorer':
        return 'File Explorer';
      case 'scheduled':
        return 'Scheduled Tasks';
      case 'skills':
        return 'Skills & Plugins';
      case 'settings':
        return 'Settings';
      default:
        return 'Sidebar';
    }
  };

  const hasAnyStandalone =
    standaloneGroups.reduce((acc, g) => acc + g.items.length, 0) > 0;

  return (
    <aside
      className={`h-full bg-ag-bg-secondary border-r border-ag-border flex flex-col transition-all duration-300 ease-in-out select-none overflow-hidden ${
        sidebarOpen ? 'w-[280px] min-w-[280px]' : 'w-0 min-w-0 border-r-0'
      }`}
      aria-label="Sidebar panel"
    >
      <div className="w-[280px] h-full flex flex-col">
        {/* Sidebar Header */}
        <div className="h-10 min-h-10 px-4 flex items-center justify-between border-b border-ag-border/70">
          <span className="text-xs font-semibold text-ag-text tracking-wide uppercase">
            {getViewTitle(sidebarView)}
          </span>
          <span className="text-[11px] font-mono text-ag-text-muted">
            {sidebarView === 'conversations' ? `${conversations.length} total` : ''}
          </span>
        </div>

        {/* View Content */}
        {sidebarView === 'conversations' && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            {/* New Conversation Button */}
            <button
              onClick={handleCreateNew}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-ag-accent hover:bg-ag-accent-hover text-ag-bg text-xs font-medium shadow-glow-sm transition-all duration-200 active:scale-[0.98]"
              title="Nova Conversa (Ctrl+N)"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Nova Conversa</span>
              </div>
              <kbd className="text-[10px] font-mono bg-ag-bg/15 px-1.5 py-0.5 rounded text-ag-bg/80">Ctrl+N</kbd>
            </button>

            {/* New Project Button */}
            <button
              onClick={() => setNewProjectOpen(true)}
              className="mt-2 w-full flex items-center justify-between py-2 px-3 rounded-lg bg-ag-bg-card hover:bg-ag-bg-hover border border-ag-border text-ag-text text-xs font-medium transition-all duration-200 active:scale-[0.98]"
              title="Novo Projeto"
            >
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-ag-accent" />
                <span>Novo Projeto</span>
              </div>
            </button>

            {/* Search Input */}
            <div className="relative mt-2.5 mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ag-text-muted" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-ag-bg border border-ag-border text-xs text-ag-text placeholder-ag-text-muted focus:outline-none focus:border-ag-border-focus focus:shadow-glow transition-all duration-200"
              />
            </div>

            {/* Projects + Conversation List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mt-1">
              {projectSections.length === 0 && !hasAnyStandalone && (
                <div className="py-8 text-center text-xs text-ag-text-muted">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </div>
              )}

              {/* Projects always render above standalone chats */}
              {projectSections.map(({ project, chats }) => {
                const collapsed = collapsedProjects[project.id];
                return (
                  <div key={project.id} className="space-y-1">
                    <div className="flex items-center gap-1 px-1 group/project">
                      <button
                        onClick={() =>
                          setCollapsedProjects((prev) => ({ ...prev, [project.id]: !prev[project.id] }))
                        }
                        className="flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left"
                        title={project.folderPath}
                      >
                        {collapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-ag-text-muted shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-ag-text-muted shrink-0" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-ag-accent shrink-0" />
                        <span className="text-[10px] font-semibold text-ag-text uppercase tracking-wider truncate">
                          {project.name}
                        </span>
                      </button>
                      <button
                        onClick={() => createConversation(provider, mode, project.folderPath, project.id)}
                        className="opacity-0 group-hover/project:opacity-100 p-1 rounded hover:bg-ag-bg-hover text-ag-text-muted hover:text-ag-text transition-all"
                        title="Nova conversa neste projeto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!collapsed && (
                      <div className="space-y-0.5 pl-3 border-l border-ag-border/60">
                        {chats.length === 0 ? (
                          <div className="px-2.5 py-1.5 text-[11px] text-ag-text-muted italic">
                            Sem conversas ainda
                          </div>
                        ) : (
                          chats.map((conv) => <ConversationRow key={conv.id} conv={conv} />)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone (avulso) conversations below projects */}
              {hasAnyStandalone && (
                <div className="space-y-4">
                  <div className="text-[10px] font-semibold text-ag-text-muted uppercase tracking-wider px-2 py-1 border-t border-ag-border/60 pt-3">
                    Conversas avulsas
                  </div>
                  {standaloneGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                      <div className="text-[10px] font-semibold text-ag-text-muted uppercase tracking-wider px-2 py-1">
                        {group.title}
                      </div>

                      <div className="space-y-0.5">
                        {group.items.map((conv) => (
                          <ConversationRow key={conv.id} conv={conv} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {sidebarView === 'explorer' && <FileExplorerView />}
        {sidebarView === 'scheduled' && <ScheduledTasksView />}
        {sidebarView === 'skills' && <SkillsView />}
        {sidebarView === 'settings' && <SettingsView />}
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </aside>
  );
};
