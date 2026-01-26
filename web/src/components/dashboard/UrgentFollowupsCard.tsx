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
    <Card className="p-5">
      <CardHeader
        title="Relances Urgentes"
        icon={Bell}
        description={hasFollowups ? `${followups.length} à traiter` : undefined}
        action={
          hasFollowups ? (
            <LinkButton
              href="/followups"
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Voir tout
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
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-success/10 mb-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            Tout est à jour !
          </h3>
          <p className="text-xs text-muted-foreground">
            Aucune relance urgente
          </p>
          
          <Link 
            href="/leads"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Planifier des relances
          </Link>
        </div>
      )}
    </Card>
  );
}
