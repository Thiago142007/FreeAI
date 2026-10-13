import React from 'react';
import {
  MessageSquare,
  FolderTree,
  Clock,
  Boxes,
  Settings
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings-store';
import { SidebarView } from '../../types';

interface NavItem {
  id: SidebarView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const topNavItems: (NavItem & { shortcut?: string })[] = [
  { id: 'conversations', label: 'Conversations', icon: MessageSquare, shortcut: 'Ctrl+B' },
  { id: 'explorer', label: 'File Explorer', icon: FolderTree, shortcut: 'Ctrl+P' },
  { id: 'scheduled', label: 'Scheduled Tasks', icon: Clock },
  { id: 'skills', label: 'Skills & Plugins', icon: Boxes }
];

export const ActivityBar: React.FC = () => {
  const sidebarView = useSettingsStore((state) => state.sidebarView);
  const sidebarOpen = useSettingsStore((state) => state.sidebarOpen);
  const setSidebarView = useSettingsStore((state) => state.setSidebarView);
  const setSidebarOpen = useSettingsStore((state) => state.setSidebarOpen);

  const handleSelectView = (view: SidebarView): void => {
    setSidebarView(view);
    if (!sidebarOpen) {
      setSidebarOpen(true);
    }
  };

  const renderNavButton = (item: NavItem, isBottom: boolean = false) => {
    const isActive = sidebarOpen && sidebarView === item.id;
    const IconComponent = item.icon;

    return (
      <div key={item.id} className="relative group flex items-center justify-center w-full">
        <button
          onClick={() => handleSelectView(item.id)}
          className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
            isActive
              ? 'bg-ag-bg-active text-ag-accent shadow-sm'
              : 'text-ag-text-muted hover:text-ag-text hover:bg-ag-bg-hover'
          }`}
          aria-label={item.label}
          title={item.label}
        >
          {/* Left blue accent bar when active */}
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-ag-accent rounded-r shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          )}

          <IconComponent className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
        </button>

        {/* Floating tooltip */}
        <div
          className={`absolute left-[54px] z-50 pointer-events-none hidden group-hover:flex items-center gap-1.5 px-2 py-1 rounded bg-ag-bg-card border border-ag-border text-ag-text text-xs font-medium whitespace-nowrap shadow-lg animate-fade-in ${
            isBottom ? 'bottom-2' : ''
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <kbd className="text-[10px] font-mono text-ag-text-muted bg-ag-bg px-1 py-0.5 rounded border border-ag-border">
              {item.shortcut}
            </kbd>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className="w-[48px] min-w-[48px] h-full bg-ag-bg-secondary border-r border-ag-border flex flex-col items-center py-3 select-none z-40"
      aria-label="Activity Bar"
    >
      {/* Top 4 Icons */}
      <div className="flex flex-col items-center space-y-2 w-full">
        {topNavItems.map((item) => renderNavButton(item))}
      </div>

      {/* Bottom Settings Icon */}
      <div className="mt-auto flex flex-col items-center w-full pt-2 border-t border-ag-border/50">
        {renderNavButton(
          {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            shortcut: 'Ctrl+,'
          },
          true
        )}
      </div>
    </aside>
  );
};
