'use client';

import { Calendar, Phone } from 'lucide-react';
import Link from 'next/link';
import type { FollowupsData } from '@/types';

interface FollowupsHeaderProps {
  counts: FollowupsData['counts'];
}

export function FollowupsHeader({ counts }: FollowupsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Relances
        </h1>
        <p className="text-zinc-500">
          {counts.total} relances à venir cette semaine
        </p>
      </div>

      {/* Quick stats */}
      <FollowupsQuickStats counts={counts} />
    </div>
  );
}

function FollowupsQuickStats({ counts }: { counts: FollowupsData['counts'] }) {
  return (
    <div className="flex items-center gap-4">
      {counts.overdue > 0 && (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
          {counts.overdue} en retard
        </span>
      )}
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium">
        {counts.today} aujourd&apos;hui
      </span>
    </div>
  );
}

export function FollowupsEmpty() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
      <Calendar className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Aucune relance prévue
      </h2>
      <p className="text-zinc-500 mb-6">
        Lancez une session d&apos;appel pour planifier des relances
      </p>
      <Link
        href="/call"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
      >
        <Phone className="w-5 h-5" />
        Lancer une session
      </Link>
    </div>
  );
}
