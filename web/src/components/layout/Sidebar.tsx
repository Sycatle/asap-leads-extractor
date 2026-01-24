'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Phone,
  Calendar,
  Settings,
  Sparkles,
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            LeadFlow
          </h1>
          <p className="text-xs text-muted-foreground">Prospection B2B</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
        <p className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
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
                'sidebar-item group relative',
                isActive && 'active'
              )}
            >
              <Icon className={cn(
                'w-[18px] h-[18px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span className="flex-1 text-[13px]">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-primary opacity-60" />
              )}
              {item.highlight && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
              )}
            </Link>
          );
        })}

        <div className="pt-6">
          <p className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Système
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
                  'w-[18px] h-[18px] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <span className="flex-1 text-[13px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Stats Footer */}
      <div className="p-3 border-t border-border">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-info/5 border border-primary/10">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <p className="text-xs font-medium text-foreground">
              Conseil du jour
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Appelez entre 10h-12h et 14h-16h pour de meilleurs résultats.
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
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
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
