import { Phone, Globe, MapPin, Star, Building2, User, Clock, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { CALL_STATUS_LABELS, PRIORITY_COLORS } from '@/lib/constants';
import type { Lead } from '@/types';

interface LeadInfoCardProps {
  lead: Lead;
}

export function LeadInfoCard({ lead }: LeadInfoCardProps) {
  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Contact</h3>

          <InfoRow
            icon={Phone}
            iconColor="green"
            content={
              <div>
                <a
                  href={`tel:${lead.phone}`}
                  className="font-mono text-lg text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {lead.phone}
                </a>
                <p className="text-xs text-zinc-500">{CALL_STATUS_LABELS[lead.call_status]}</p>
              </div>
            }
          />

          {lead.website && (
            <InfoRow
              icon={Globe}
              iconColor="blue"
              content={
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {new URL(lead.website).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              }
            />
          )}

          <InfoRow
            icon={MapPin}
            iconColor="zinc"
            content={
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>{lead.address}</p>
                <p>{lead.postal_code} {lead.city}</p>
              </div>
            }
          />

          {lead.rating && (
            <InfoRow
              icon={Star}
              iconColor="yellow"
              content={
                <span className="text-zinc-600 dark:text-zinc-400">
                  {lead.rating} ({lead.reviews_count} avis)
                </span>
              }
            />
          )}
        </div>

        {/* Business Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Entreprise</h3>

          {lead.legal_name && (
            <InfoRow
              icon={Building2}
              iconColor="purple"
              content={
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{lead.legal_name}</p>
                  {lead.siren && (
                    <p className="text-xs text-zinc-500">SIREN: {lead.siren}</p>
                  )}
                </div>
              }
            />
          )}

          {lead.dirigeant && (
            <InfoRow
              icon={User}
              iconColor="indigo"
              content={
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{lead.dirigeant}</p>
                  <p className="text-xs text-zinc-500">Dirigeant</p>
                </div>
              }
            />
          )}

          <InfoRow
            icon={Clock}
            iconColor="zinc"
            content={
              <div className="text-sm">
                <p className={PRIORITY_COLORS[lead.priority]}>
                  Priorité {lead.priority.toUpperCase()}
                </p>
                {lead.last_contact_at && (
                  <p className="text-xs text-zinc-500">
                    Dernier contact: {new Date(lead.last_contact_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            }
          />

          {lead.next_followup_at && (
            <InfoRow
              icon={Calendar}
              iconColor="orange"
              content={
                <div className="text-sm">
                  <p className="text-orange-600 dark:text-orange-400 font-medium">
                    Relance prévue
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(lead.next_followup_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              }
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ===== HELPER COMPONENT =====

interface InfoRowProps {
  icon: React.ElementType;
  iconColor: 'green' | 'blue' | 'zinc' | 'yellow' | 'purple' | 'indigo' | 'orange';
  content: React.ReactNode;
}

const iconBgColors = {
  green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
  blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
  zinc: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400',
  purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400',
  orange: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400',
};

function InfoRow({ icon: Icon, iconColor, content }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', iconBgColors[iconColor])}>
        <Icon className="w-4 h-4" />
      </div>
      {content}
    </div>
  );
}
