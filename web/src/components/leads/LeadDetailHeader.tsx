'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui';
import type { Lead } from '@/types';

interface LeadDetailHeaderProps {
  lead: Lead;
}

export function LeadDetailHeader({ lead }: LeadDetailHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.back()}
        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {lead.name}
        </h1>
        <p className="text-zinc-500">{lead.niche} • {lead.city}</p>
      </div>
      <StatusBadge status={lead.status} />
    </div>
  );
}
