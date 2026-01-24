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
  green: 'bg-success/15 text-success hover:bg-success/25 border-success/30',
  blue: 'bg-primary/15 text-primary hover:bg-primary/25 border-primary/30',
  red: 'bg-danger/15 text-danger hover:bg-danger/25 border-danger/30',
  purple: 'bg-info/15 text-info hover:bg-info/25 border-info/30',
  orange: 'bg-warning/15 text-warning hover:bg-warning/25 border-warning/30',
  zinc: 'bg-muted text-foreground hover:bg-accent border-border',
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
        inline-flex items-center justify-center gap-1.5 rounded-xl border font-medium 
        transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
        <div className="pt-2 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              asChild
              className="h-10 bg-success hover:bg-success/90 text-white shadow-sm"
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
