import Link from 'next/link';
import { CheckCircle2, Bell, ArrowRight, Clock } from 'lucide-react';
import { Card, CardHeader, LinkButton } from '@/components/ui';
import { FollowupItem } from '@/components/leads/LeadItem';
import type { FollowupLead } from '@/types';

interface UrgentFollowupsCardProps {
  followups: FollowupLead[];
}

export function UrgentFollowupsCard({ followups }: UrgentFollowupsCardProps) {
  const hasFollowups = followups.length > 0;
  
  return (
    <Card>
      <CardHeader
        title="Relances Urgentes"
        icon={Bell}
        description={hasFollowups ? `${followups.length} leads nécessitent votre attention` : undefined}
        action={
          hasFollowups ? (
            <LinkButton
              href="/followups"
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Tout voir
            </LinkButton>
          ) : undefined
        }
      />

      {hasFollowups ? (
        <div className="space-y-2">
          {followups.map((lead) => (
            <FollowupItem key={lead.id} lead={lead} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Tout est à jour !
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aucune relance urgente pour le moment
          </p>
          
          <Link 
            href="/leads"
            className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Clock className="w-4 h-4" />
            Planifier des relances
          </Link>
        </div>
      )}
    </Card>
  );
}
