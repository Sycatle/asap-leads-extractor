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
        className="p-2 rounded-lg hover:bg-accent"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-foreground">
          {lead.name}
        </h1>
        <p className="text-muted-foreground">{lead.niche} • {lead.city}</p>
      </div>
      <StatusBadge status={lead.status} />
    </div>
  );
}
