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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            LeadFlow
          </h1>
          <p className="text-xs text-zinc-500">Prospection B2B</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
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
                item.highlight && !isActive && 'text-blue-600 dark:text-blue-400'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
              )} />
              <span className="flex-1">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </Link>
          );
        })}

        <div className="pt-6">
          <p className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
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
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                )} />
                <span className="flex-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Stats Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="p-3 rounded-xl bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
            Conseil du jour
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 safe-area-bottom">
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
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
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
