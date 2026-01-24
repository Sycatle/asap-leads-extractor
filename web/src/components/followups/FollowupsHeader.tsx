'use client';

import { Calendar } from 'lucide-react';
import Link from 'next/link';
import type { FollowupsData } from '@/types';
import { Button } from '@/components/ui/button';

interface FollowupsHeaderProps {
  counts: FollowupsData['counts'];
}

export function FollowupsHeader({ counts }: FollowupsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <FollowupsQuickStats counts={counts} />
    </div>
  );
}

function FollowupsQuickStats({ counts }: { counts: FollowupsData['counts'] }) {
  return (
    <div className="flex items-center gap-2">
      {counts.overdue > 0 && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-danger/10 text-danger rounded-full text-xs font-medium">
          {counts.overdue} en retard
        </span>
      )}
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 text-warning rounded-full text-xs font-medium">
        {counts.today} aujourd&apos;hui
      </span>
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
        {counts.total} total
      </span>
    </div>
  );
}

export function FollowupsEmpty() {
  return (
    <div className="bg-card rounded-xl border border-border p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
        <Calendar className="w-7 h-7 text-success" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Aucune relance prévue
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Lancez une session d&apos;appel pour planifier des relances
      </p>
      <Link href="/call">
        <Button>
          Lancer une session
        </Button>
      </Link>
    </div>
  );
}
