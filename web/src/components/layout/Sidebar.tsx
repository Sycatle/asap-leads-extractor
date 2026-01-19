'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Phone,
  Calendar,
  Settings,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, exact: true },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Session', href: '/call', icon: Phone, highlight: true },
  { name: 'Relances', href: '/followups', icon: Calendar },
];

const secondaryNav = [
  { name: 'Configuration', href: '/config', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            LeadFlow
          </h1>
          <p className="text-xs text-muted-foreground">Prospection B2B</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Principal
        </p>
        {navigation.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'sidebar-item group',
                isActive && 'active',
                item.highlight && !isActive && 'text-primary'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span className="flex-1">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-primary" />
              )}
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </Link>
          );
        })}

        <div className="pt-6">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Paramètres
          </p>
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn('sidebar-item group', isActive && 'active')}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <span className="flex-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Stats Footer */}
      <div className="p-4 border-t border-border">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary-light to-info-light border border-primary/20">
          <p className="text-xs font-medium text-primary mb-1">
            Conseil du jour
          </p>
          <p className="text-xs text-muted-foreground">
            Les meilleurs moments pour appeler sont entre 10h-12h et 14h-16h.
          </p>
        </div>
      </div>
    </aside>
  );
}

// Mobile bottom navigation
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navigation.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
