'use client';

import { PhoneCall, Calendar, PhoneOff, CheckCircle2, XCircle, MapPin, Phone, Loader2, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Lead, CallStatus, LeadStatus } from '@/types';

interface LeadActionsCardProps {
  lead: Lead;
  actionLoading: string | null;
  onLogCall: (status: CallStatus) => void;
  onUpdateStatus: (status: LeadStatus) => void;
  onScheduleFollowup: () => void;
}

// Action button styles using CSS variables
const actionStyles = {
  green: 'bg-success/10 text-success hover:bg-success/20',
  blue: 'bg-primary/10 text-primary hover:bg-primary/20',
  red: 'bg-danger/10 text-danger hover:bg-danger/20',
  purple: 'bg-info/10 text-info hover:bg-info/20',
  orange: 'bg-warning/10 text-warning hover:bg-warning/20',
  zinc: 'bg-muted text-muted-foreground hover:bg-accent',
};

interface ActionBtnProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  color: keyof typeof actionStyles;
  small?: boolean;
}

function ActionBtn({ icon, label, onClick, loading, color, small }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        inline-flex items-center justify-center gap-1.5 rounded-lg font-medium 
        transition-colors disabled:opacity-50
        ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
        ${actionStyles[color]}
      `}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
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
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Zap className="w-4 h-4 text-muted-foreground" />
          Actions rapides
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Call actions */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Résultat d&apos;appel
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              icon={<PhoneCall className="w-4 h-4" />}
              label="Conversation"
              onClick={() => onLogCall('appele')}
              loading={actionLoading === 'appele'}
              color="green"
            />
            <ActionBtn
              icon={<Calendar className="w-4 h-4" />}
              label="Rappeler"
              onClick={() => onLogCall('rappeler')}
              loading={actionLoading === 'rappeler'}
              color="blue"
            />
            <ActionBtn
              icon={<PhoneOff className="w-4 h-4" />}
              label="Injoignable"
              onClick={() => onLogCall('injoignable')}
              loading={actionLoading === 'injoignable'}
              color="red"
            />
          </div>
        </div>

        {/* Status actions */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Changer le statut
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              label="Qualifié"
              onClick={() => onUpdateStatus('qualifie')}
              loading={actionLoading === 'qualifie'}
              color="purple"
              small
            />
            <ActionBtn
              label="Proposition"
              onClick={() => onUpdateStatus('proposition')}
              loading={actionLoading === 'proposition'}
              color="orange"
              small
            />
            <ActionBtn
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              label="Converti"
              onClick={() => onUpdateStatus('converti')}
              loading={actionLoading === 'converti'}
              color="green"
              small
            />
            <ActionBtn
              icon={<XCircle className="w-3.5 h-3.5" />}
              label="Perdu"
              onClick={() => onUpdateStatus('perdu')}
              loading={actionLoading === 'perdu'}
              color="zinc"
              small
            />
          </div>
        </div>

        {/* Main actions */}
        <div className="pt-4 border-t border-border">
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              className="h-10 bg-success hover:bg-success/90 text-white"
            >
              <a href={`tel:${lead.phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Appeler
              </a>
            </Button>
            <Button
              onClick={onScheduleFollowup}
              variant="outline"
              className="h-10"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Planifier relance
            </Button>
            {lead.maps_url && (
              <Button
                asChild
                variant="outline"
                className="h-10"
              >
                <a href={lead.maps_url} target="_blank" rel="noopener noreferrer">
                  <MapPin className="w-4 h-4 mr-2" />
                  Maps
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
