'use client';

import { Bell, Search, User } from 'lucide-react';


interface TopBarProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-6 bg-card/80 backdrop-blur-lg border-b border-border">
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-lg font-semibold text-foreground truncate">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>

      {/* Center content (optional) */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* User */}
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center">
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
        <h1 className="text-2xl font-bold text-foreground">
          {title}
        </h1>
        {desc && (
          <p className="text-muted-foreground mt-1">{desc}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
