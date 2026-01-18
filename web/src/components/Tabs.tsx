"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings } from "lucide-react";

const tabs = [
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Config", href: "/config", icon: Settings },
];

export function Tabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href) || (pathname === "/" && tab.href === "/leads");
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
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
