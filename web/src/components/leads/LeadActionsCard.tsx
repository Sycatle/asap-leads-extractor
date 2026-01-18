import { PhoneCall, PhoneMissed, PhoneOff, Calendar, CheckCircle2, XCircle, MapPin, Phone } from 'lucide-react';
import { Card, CardHeader, Button, ActionButton } from '@/components/ui';
import type { Lead, CallStatus, LeadStatus } from '@/types';

interface LeadActionsCardProps {
  lead: Lead;
  actionLoading: string | null;
  onLogCall: (status: CallStatus) => void;
  onUpdateStatus: (status: LeadStatus) => void;
  onScheduleFollowup: () => void;
}

export function LeadActionsCard({
  lead,
  actionLoading,
  onLogCall,
  onUpdateStatus,
  onScheduleFollowup,
}: LeadActionsCardProps) {
  return (
    <Card>
      <CardHeader title="Actions rapides" />

      {/* Call actions */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Résultat d&apos;appel
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={<PhoneCall className="w-4 h-4" />}
            label="Conversation"
            onClick={() => onLogCall('appele')}
            loading={actionLoading === 'appele'}
            color="green"
          />
          <ActionButton
            icon={<PhoneMissed className="w-4 h-4" />}
            label="Messagerie"
            onClick={() => onLogCall('messagerie')}
            loading={actionLoading === 'messagerie'}
            color="yellow"
          />
          <ActionButton
            icon={<Calendar className="w-4 h-4" />}
            label="Rappeler"
            onClick={() => onLogCall('rappeler')}
            loading={actionLoading === 'rappeler'}
            color="blue"
          />
          <ActionButton
            icon={<PhoneOff className="w-4 h-4" />}
            label="Injoignable"
            onClick={() => onLogCall('injoignable')}
            loading={actionLoading === 'injoignable'}
            color="red"
          />
        </div>
      </div>

      {/* Status actions */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Changer le statut
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Qualifié"
            onClick={() => onUpdateStatus('qualifie')}
            loading={actionLoading === 'qualifie'}
            color="purple"
            small
          />
          <ActionButton
            label="Proposition"
            onClick={() => onUpdateStatus('proposition')}
            loading={actionLoading === 'proposition'}
            color="orange"
            small
          />
          <ActionButton
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Converti"
            onClick={() => onUpdateStatus('converti')}
            loading={actionLoading === 'converti'}
            color="green"
            small
          />
          <ActionButton
            icon={<XCircle className="w-4 h-4" />}
            label="Perdu"
            onClick={() => onUpdateStatus('perdu')}
            loading={actionLoading === 'perdu'}
            color="zinc"
            small
          />
        </div>
      </div>

      {/* Other actions */}
      <div className="flex gap-2">
        <a
          href={`tel:${lead.phone}`}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Phone className="w-4 h-4" />
          Appeler
        </a>
        <Button
          onClick={onScheduleFollowup}
        >
          <Calendar className="w-4 h-4" />
          Planifier relance
        </Button>
        {lead.maps_url && (
          <a
            href={lead.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Maps
          </a>
        )}
      </div>
    </Card>
  );
}
