'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Phone,
  Globe,
  Eye,
  MapPin,
  Star,
  ExternalLink,
  Building2,
  Smartphone,
  AlertTriangle,
  Clock,
  TrendingUp,
  History,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { PRIORITY_BADGE_COLORS, CALL_STATUS_LABELS } from '@/lib/constants';
import { LeadContextTags } from './LeadContextTags';
import { LeadHistoryCompact } from './LeadHistoryCompact';
import { fetchLeadHistory } from '@/lib/api';
import type { Lead, HistoryEntry } from '@/types';

interface CurrentLeadCardProps {
  lead: Lead;
}

const SOURCE_LABELS: Record<string, string> = {
  gmb: 'Google Maps',
  annuaire: 'Annuaire',
  scraping: 'Scraping',
  import: 'Import',
  manual: 'Manuel',
};

// ===== LEAD AVATAR =====

function LeadImage({ lead }: { lead: Lead }) {
  if (lead.image_url) {
    return (
      <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 shadow-md">
        <Image
          src={lead.image_url}
          alt={lead.name}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized // Google Maps images are external
        />
      </div>
    );
  }

  // Fallback: icon placeholder
  return (
    <div className="w-20 h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-md">
      <Building2 className="w-8 h-8 text-zinc-400" />
    </div>
  );
}

function formatLastContact(dateStr: string | null): string {
  if (!dateStr) return 'Jamais contacté';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getWebsiteStatusLabel(lead: Lead): { label: string; color: string } | null {
  if (!lead.website) {
    return { label: 'Pas de site web', color: 'text-red-600 dark:text-red-400' };
  }
  if (lead.website_status === 'old') {
    return { label: 'Site vieillot', color: 'text-yellow-600 dark:text-yellow-400' };
  }
  if (lead.website_status === 'platform') {
    return { label: 'Site plateforme (Wix, etc.)', color: 'text-yellow-600 dark:text-yellow-400' };
  }
  if (lead.website_status === 'modern') {
    return { label: 'Site moderne', color: 'text-green-600 dark:text-green-400' };
  }
  return null;
}

export function CurrentLeadCard({ lead }: CurrentLeadCardProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await fetchLeadHistory(lead.id);
        setHistory(data.history);
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [lead.id]);

  const websiteStatus = getWebsiteStatusLabel(lead);
  const phoneTypeLabel = lead.phone_type === 'perso' ? 'PERSO' : lead.phone_type === 'pro' ? 'PRO' : null;
  const isPersoPhone = lead.phone_type === 'perso';

  return (
    <Card className="p-0 overflow-hidden">
      {/* ===== BLOC 1: ESSENTIEL ===== */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start gap-5 mb-4">
          {/* Lead Image */}
          <LeadImage lead={lead} />

          <div className="flex-1 min-w-0">
            {/* Name + Priority */}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-2xl font-bold text-foreground truncate">
                {lead.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  PRIORITY_BADGE_COLORS[lead.priority]
                }`}
              >
                {lead.priority.toUpperCase()}
              </span>
              {lead.score && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <TrendingUp className="w-3 h-3" />
                  {lead.score}
                </span>
              )}
            </div>

            {/* Activity + City */}
            <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
              {lead.niche && <span className="font-medium text-foreground">{lead.niche}</span>}
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {lead.city}
              </span>
              {lead.source && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">
                  {SOURCE_LABELS[lead.source] || lead.source}
                </span>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-2 shrink-0">
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                title="Site web"
              >
                <Globe className="w-5 h-5" />
              </a>
            )}
            {lead.maps_url && (
              <a
                href={lead.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                title="Google Maps"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
            <Link
              href={`/leads/${lead.id}`}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
              title="Voir la fiche"
            >
              <Eye className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Phone number - Main CTA */}
        <div className="flex items-center justify-center gap-4 py-6">
          <div className="flex flex-col items-center gap-2">
            <a
              href={`tel:${lead.phone}`}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-xl font-bold transition-colors ${
                isPersoPhone
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <Phone className="w-6 h-6" />
              {lead.phone}
            </a>
            {phoneTypeLabel && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  isPersoPhone ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                }`}
              >
                {isPersoPhone ? <Smartphone className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                {phoneTypeLabel}
                {isPersoPhone && <span className="text-yellow-500">(risque B2C)</span>}
              </span>
            )}
          </div>
        </div>

        {/* Meta info row */}
        <div className="flex items-center justify-center gap-6 text-sm">
          {/* Last contact */}
          <div className="flex items-center gap-2 text-zinc-500">
            <Clock className="w-4 h-4" />
            <span>Dernier contact: <strong>{formatLastContact(lead.last_contact_at)}</strong></span>
            {lead.call_status !== 'non_appele' && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {CALL_STATUS_LABELS[lead.call_status]}
              </span>
            )}
          </div>

          {/* Attempts counter */}
          {(lead.attempts_30d !== undefined || lead.attempts_count !== undefined) && (
            <div className="flex items-center gap-1 text-zinc-500">
              <span>
                Tentatives: <strong>{lead.attempts_30d ?? lead.attempts_count ?? 0}/4</strong>
              </span>
              {(lead.attempts_30d ?? 0) >= 3 && (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          )}

          {/* Rating */}
          {lead.rating && (
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              <span>{lead.rating}</span>
              <span className="text-zinc-400">({lead.reviews_count} avis)</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== BLOC 2: CONTEXTE DE VENTE ===== */}
      <div className="p-4 bg-muted border-b border-border">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Website & GMB status */}
          <div className="flex-1 space-y-2">
            {/* Website status */}
            {websiteStatus && (
              <div className="flex items-center gap-2">
                <Globe className={`w-4 h-4 ${websiteStatus.color}`} />
                <span className={`text-sm ${websiteStatus.color}`}>{websiteStatus.label}</span>
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline truncate max-w-[200px]"
                  >
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            )}

            {/* GMB info */}
            {lead.rating && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">
                  Note GMB: <strong>{lead.rating}/5</strong> ({lead.reviews_count} avis)
                </span>
                {lead.maps_url && (
                  <a
                    href={lead.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Voir fiche
                  </a>
                )}
              </div>
            )}

            {/* Best call time */}
            {lead.best_call_time && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
                <span>Meilleur créneau: <strong>{lead.best_call_time}</strong></span>
              </div>
            )}
          </div>

          {/* Right: Context tags */}
          <div className="shrink-0">
            <LeadContextTags lead={lead} compact />
          </div>
        </div>

        {/* Dirigeant info */}
        {lead.dirigeant && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              👤 Demander <strong>{lead.dirigeant}</strong>
              {lead.legal_name && lead.legal_name !== lead.name && (
                <span className="text-blue-500"> ({lead.legal_name})</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ===== BLOC 3: HISTORIQUE COMPACT ===== */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-zinc-400" />
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Historique récent
          </h3>
        </div>
        
        {loadingHistory ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
          </div>
        ) : (
          <LeadHistoryCompact history={history} maxItems={3} />
        )}

        {/* Previous notes (if any and no history) */}
        {lead.notes && history.length === 0 && (
          <div className="mt-2 p-3 bg-muted rounded-lg">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Notes</p>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
              {lead.notes}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
