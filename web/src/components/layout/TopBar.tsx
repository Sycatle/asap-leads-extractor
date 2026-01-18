'use client';

import { Bell, Search, User } from 'lucide-react';


interface TopBarProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-sm text-zinc-500 truncate">{subtitle}</p>
        )}
      </div>

      {/* Center content (optional) */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User */}
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>
    </header>
  );
}

// Page header with actions
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({ title, subtitle, description, action }: PageHeaderProps) {
  const desc = description || subtitle;
  
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        {desc && (
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">{desc}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
