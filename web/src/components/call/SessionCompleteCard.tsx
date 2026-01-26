import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Session } from '@/types';

interface SessionCompleteCardProps {
  session: Session;
  onEnd: () => void;
}

export function SessionCompleteCard({ session, onEnd }: SessionCompleteCardProps) {
  return (
    <Card className="text-center p-8">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Tous les leads ont été traités !
      </h2>
      <p className="text-zinc-500 mb-6">
        {session.total_calls} appels • {session.total_reached} conversations •{' '}
        {session.total_scheduled} relances planifiées
      </p>
      <Link
        href="/leads"
        onClick={onEnd}
        className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium"
      >
        Terminer la session
      </Link>
    </Card>
  );
}
