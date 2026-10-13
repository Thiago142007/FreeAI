import React from 'react';
import { ConnectionStatus } from '../../types';

export interface StatusBadgeProps {
  status: ConnectionStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  {
    label: string;
    dotClass: string;
    textClass: string;
    pulse?: boolean;
  }
> = {
  connected: {
    label: 'Online',
    dotClass: 'bg-ag-green shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    textClass: 'text-ag-green',
  },
  connecting: {
    label: 'Conectando...',
    dotClass: 'bg-ag-amber shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse',
    textClass: 'text-ag-amber',
    pulse: true,
  },
  disconnected: {
    label: 'Offline',
    dotClass: 'bg-ag-red',
    textClass: 'text-ag-red',
  },
  'auth-required': {
    label: 'Login necessário',
    dotClass: 'bg-ag-text-muted',
    textClass: 'text-ag-text-muted',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const dotSizeClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <span
        className={`rounded-full shrink-0 transition-colors duration-200 ${dotSizeClass} ${config.dotClass}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={`text-xs font-medium tracking-tight ${config.textClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};
