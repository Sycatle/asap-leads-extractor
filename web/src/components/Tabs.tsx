"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, Phone, Calendar, LayoutDashboard } from "lucide-react";

const tabs = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Session", href: "/call", icon: Phone },
  { name: "Relances", href: "/followups", icon: Calendar },
  { name: "Config", href: "/config", icon: Settings },
];

export function Tabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const isActive = tab.exact 
          ? pathname === tab.href 
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive 
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" 
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
