'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { PRIORITY_BADGE_COLORS, CALL_STATUS_LABELS } from '@/lib/constants';
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
      <div className="relative w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 shadow-md">
        <Image
          src={lead.image_url}
          alt={lead.name}
          fill
          className="object-cover"
          sizes="112px"
          unoptimized // Google Maps images are external
        />
      </div>
    );
  }

  // Fallback: icon placeholder
  return (
    <div className="w-28 h-28 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-md">
      <Building2 className="w-10 h-10 text-zinc-400" />
    </div>
  );
}

// ===== FORMATAGE TÉLÉPHONE =====
function formatPhoneNumber(phone: string): string {
  // Format: 02 43 20 85 15
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  return phone;
}

// ===== VÉRIFICATION OUVERT/FERMÉ =====
function isOpenNow(openingHours: string | null | undefined): 'open' | 'closed' | null {
  if (!openingHours) return null;
  
  const now = new Date();
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const today = dayNames[now.getDay()].toLowerCase();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  // Chercher les horaires du jour actuel
  const lowerHours = openingHours.toLowerCase();
  
  // Pattern: "lundi: 9:00-12:00, 14:00-18:00" ou "lun 9h-12h"
  const dayPatterns = [
    new RegExp(`${today}[^|]*?(\\d{1,2})[h:]?(\\d{0,2})?\\s*-\\s*(\\d{1,2})[h:]?(\\d{0,2})?`, 'i'),
    new RegExp(`${today.substring(0,3)}[^|]*?(\\d{1,2})[h:]?(\\d{0,2})?\\s*-\\s*(\\d{1,2})[h:]?(\\d{0,2})?`, 'i'),
  ];
  
  for (const pattern of dayPatterns) {
    const match = lowerHours.match(pattern);
    if (match) {
      const openHour = parseInt(match[1], 10);
      const openMin = parseInt(match[2] || '0', 10);
      const closeHour = parseInt(match[3], 10);
      const closeMin = parseInt(match[4] || '0', 10);
      
      const openTime = openHour * 60 + openMin;
      const closeTime = closeHour * 60 + closeMin;
      
      if (currentTime >= openTime && currentTime < closeTime) {
        return 'open';
      }
    }
  }
  
  // Si on n'a pas trouvé d'horaires pour aujourd'hui, ou fermé
  if (lowerHours.includes(today) || lowerHours.includes(today.substring(0,3))) {
    return 'closed';
  }
  
  return null; // Pas d'info
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

// ===== SCRIPTS PAR NICHE =====
const NICHE_SCRIPTS: Record<string, string> = {
  coiffeur: `Bonjour, je suis [Prénom] de [Société]. Je vous contacte car j'accompagne des salons de coiffure à développer leur visibilité en ligne et à attirer de nouveaux clients.

Est-ce que vous avez quelques minutes pour que je vous explique comment on peut vous aider ?`,
  restaurant: `Bonjour, je suis [Prénom] de [Société]. Je travaille avec des restaurants de votre région pour les aider à remplir leurs tables grâce au digital.

Vous avez 2 minutes pour que je vous présente notre approche ?`,
  default: `Bonjour, je suis [Prénom] de [Société]. Je vous contacte car j'ai vu votre établissement et je pense pouvoir vous aider à développer votre activité.

Vous avez quelques minutes ?`,
};

// ===== TIPS CONTEXTUELS =====
function getContextualTip(lead: Lead, history: HistoryEntry[]): string | null {
  const callHistory = history.filter(h => h.type === 'call');
  const recentCalls = callHistory.filter(h => {
    const daysAgo = (Date.now() - new Date(h.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  
  // Si beaucoup de tentatives sans réponse
  if (recentCalls.length >= 2) {
    const messageries = recentCalls.filter(h => h.new_value?.includes('messagerie'));
    if (messageries.length >= 2) {
      return "💡 2+ messageries cette semaine. Essayez un SMS ou un autre créneau.";
    }
  }
  
  // Si dernière interaction positive
  const lastCall = callHistory[0];
  if (lastCall?.new_value?.includes('interessé') || lastCall?.new_value?.includes('intéressé')) {
    return "✅ Intéressé au dernier appel ! Relancez avec confiance.";
  }
  
  // Si tentatives élevées
  if ((lead.attempts_30d ?? 0) >= 3) {
    return "⚠️ 3+ tentatives ce mois. Variez l'approche ou espacez les appels.";
  }
  
  // Tips par niche (même si premier appel)
  const niche = lead.niche?.toLowerCase() || '';
  if (niche.includes('coiffeur') || niche.includes('coiffure') || niche.includes('barbier')) {
    return "💡 Coiffeurs/barbiers : mardi-jeudi 10h-11h30. Évitez samedi (rush).";
  }
  if (niche.includes('restaurant')) {
    return "💡 Évitez 11h30-14h et 18h-21h (service). Préférez 14h30-16h.";
  }
  if (niche.includes('boulangerie') || niche.includes('patisserie')) {
    return "💡 Boulangeries : évitez 6h-9h (rush matin). Préférez 14h-16h.";
  }
  
  // Tip générique pour premier appel
  if (callHistory.length === 0 && !lead.website) {
    return "💡 Premier appel + pas de site web = excellente opportunité !";
  }
  
  return null;
}

// ===== RÉSUMÉ HISTORIQUE =====
function getHistorySummary(history: HistoryEntry[]): { text: string; type: 'warning' | 'success' | 'info' } | null {
  if (history.length === 0) return null;
  
  const callHistory = history.filter(h => h.type === 'call');
  if (callHistory.length === 0) return null;
  
  const recentCalls = callHistory.filter(h => {
    const daysAgo = (Date.now() - new Date(h.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  
  const messageries = recentCalls.filter(h => 
    h.new_value?.toLowerCase().includes('messagerie')
  ).length;
  const injoignables = recentCalls.filter(h => 
    h.new_value?.toLowerCase().includes('injoignable')
  ).length;
  
  if (messageries >= 2) {
    return { text: `📞 ${messageries}x messagerie en 7j`, type: 'warning' };
  }
  if (injoignables >= 2) {
    return { text: `📞 ${injoignables}x injoignable en 7j`, type: 'warning' };
  }
  
  const lastCall = callHistory[0];
  if (lastCall?.new_value?.toLowerCase().includes('interessé') || 
      lastCall?.new_value?.toLowerCase().includes('intéressé')) {
    return { text: '✅ Intéressé au dernier appel', type: 'success' };
  }
  
  if (callHistory.length === 1) {
    return { text: '📞 1 appel précédent', type: 'info' };
  }
  
  return { text: `📞 ${callHistory.length} appels précédents`, type: 'info' };
}

// ===== VÉRIFICATION CRÉNEAU OPTIMAL =====
function isOptimalCallTime(bestCallTime: string | null): 'optimal' | 'suboptimal' | null {
  if (!bestCallTime) return null;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Pattern: "10h-11h" ou "10h" ou "10:00-11:00"
  const match = bestCallTime.match(/(\d{1,2})[h:]?(\d{0,2})?\s*-?\s*(\d{1,2})?[h:]?(\d{0,2})?/);
  if (!match) return null;
  
  const startHour = parseInt(match[1], 10);
  const startMin = match[2] ? parseInt(match[2], 10) : 0;
  const endHour = match[3] ? parseInt(match[3], 10) : startHour + 1;
  const endMin = match[4] ? parseInt(match[4], 10) : 0;
  
  const currentTime = currentHour * 60 + currentMinute;
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (currentTime >= startTime && currentTime < endTime) {
    return 'optimal';
  }
  return 'suboptimal';
}

export function CurrentLeadCard({ lead }: CurrentLeadCardProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

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

  // Keyboard shortcut 'S' for script toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowScript(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Copy phone to clipboard
  const copyPhone = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [lead.phone]);

  const websiteStatus = getWebsiteStatusLabel(lead);
  const phoneTypeLabel = lead.phone_type === 'perso' ? 'PERSO' : lead.phone_type === 'pro' ? 'PRO' : null;
  const isPersoPhone = lead.phone_type === 'perso';
  const callTimeStatus = isOptimalCallTime(lead.best_call_time ?? null);
  const historySummary = getHistorySummary(history);
  const contextualTip = getContextualTip(lead, history);
  const openStatus = isOpenNow(lead.opening_hours);
  const formattedPhone = formatPhoneNumber(lead.phone);
  
  // Get script for niche
  const niche = lead.niche?.toLowerCase() || '';
  let script = NICHE_SCRIPTS.default;
  if (niche.includes('coiffeur') || niche.includes('coiffure') || niche.includes('barbier')) {
    script = NICHE_SCRIPTS.coiffeur;
  } else if (niche.includes('restaurant')) {
    script = NICHE_SCRIPTS.restaurant;
  }
  
  // Bordure priorité
  const priorityBorderClass = lead.priority === 'high' 
    ? 'border-l-4 border-l-red-500' 
    : lead.priority === 'medium' 
      ? 'border-l-4 border-l-yellow-500' 
      : '';

  return (
    <Card className={`p-0 overflow-hidden ${priorityBorderClass}`}>
      {/* ===== ALERTE B2C ===== */}
      {isPersoPhone && (
        <div className="px-4 py-2 bg-yellow-500 text-yellow-950 flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          <span>⚠️ NUMÉRO PERSONNEL - Risque B2C, adaptez votre approche</span>
        </div>
      )}

      {/* ===== BLOC 1: ESSENTIEL ===== */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-4 mb-3">
          {/* Lead Image */}
          <LeadImage lead={lead} />

          <div className="flex-1 min-w-0">
            {/* Name + Priority */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h2 className="text-xl font-bold text-foreground truncate">
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

        {/* Phone number - Main CTA - BIGGER */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${lead.phone}`}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-2xl font-bold transition-colors tracking-wide ${
                isPersoPhone
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <Phone className="w-7 h-7" />
              {formattedPhone}
            </a>
            <button
              onClick={copyPhone}
              className="p-3 rounded-xl bg-muted hover:bg-accent transition-colors"
              title="Copier le numéro"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
          {phoneTypeLabel && (
            <span
              className={`flex items-center gap-1 text-xs font-medium ${
                isPersoPhone ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
              }`}
            >
              {isPersoPhone ? <Smartphone className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
              {phoneTypeLabel}
            </span>
          )}
        </div>

        {/* ===== TAGS CRITIQUES SOUS LE TÉLÉPHONE ===== */}
        <div className="flex flex-wrap justify-center gap-2 py-2">
          {/* Website status */}
          {websiteStatus && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              !lead.website 
                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' 
                : lead.website_status === 'modern'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
            }`}>
              <Globe className="w-4 h-4" />
              {websiteStatus.label}
            </span>
          )}
          
          {/* Créneau optimal */}
          {lead.best_call_time && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              callTimeStatus === 'optimal'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
            }`}>
              <Clock className="w-4 h-4" />
              {callTimeStatus === 'optimal' 
                ? `✓ Bon moment (${lead.best_call_time})`
                : `Appeler ${lead.best_call_time}`
              }
            </span>
          )}
          
          {/* Pas de réservation */}
          {lead.has_booking === false && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
              Pas de RDV en ligne
            </span>
          )}
          
          {/* Ouvert/Fermé */}
          {openStatus && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              openStatus === 'open'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            }`}>
              {openStatus === 'open' ? '🟢 Ouvert' : '🔴 Fermé'}
            </span>
          )}
        </div>

        {/* Meta info row */}
        <div className="flex items-center justify-center gap-4 text-sm pt-2">
          {/* Last contact */}
          <div className="flex items-center gap-2 text-zinc-500">
            <Clock className="w-4 h-4" />
            <span>Dernier contact: <strong>{formatLastContact(lead.last_contact_at)}</strong></span>
          </div>

          {/* Attempts counter */}
          <div className="flex items-center gap-1 text-zinc-500">
            <span>
              Tentatives: <strong>{lead.attempts_30d ?? lead.attempts_count ?? 0}/4</strong>
            </span>
            {(lead.attempts_30d ?? 0) >= 3 && (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
          </div>

          {/* Rating - compact */}
          {lead.rating && (
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              <span>{lead.rating}</span>
              <span className="text-zinc-400">({lead.reviews_count})</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== BLOC 2: DIRIGEANT ===== */}
      {lead.dirigeant && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-border">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            👤 Demander <strong>{lead.dirigeant}</strong>
            {lead.legal_name && lead.legal_name !== lead.name && (
              <span className="text-blue-500"> ({lead.legal_name})</span>
            )}
          </p>
        </div>
      )}

      {/* ===== BLOC 3: SCRIPT D'APPEL (COLLAPSE) ===== */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowScript(!showScript)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2 hover:bg-accent transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>Script d&apos;appel</span>
            <kbd className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">S</kbd>
          </div>
          {showScript ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {showScript && (
          <div className="px-4 pb-3">
            <pre className="text-sm text-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">
              {script}
            </pre>
          </div>
        )}
      </div>

      {/* ===== BLOC 4: TIP CONTEXTUEL ===== */}
      {contextualTip && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Lightbulb className="w-4 h-4 shrink-0" />
            <span>{contextualTip}</span>
          </div>
        </div>
      )}

      {/* ===== BLOC 5: HISTORIQUE AVEC RÉSUMÉ ===== */}
      {(history.length > 0 || loadingHistory) && (
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Historique récent
              </h3>
            </div>
            
            {/* Résumé intelligent */}
            {historySummary && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                historySummary.type === 'warning'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                  : historySummary.type === 'success'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {historySummary.text}
              </span>
            )}
          </div>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
            </div>
          ) : (
            <LeadHistoryCompact history={history} maxItems={3} />
          )}
        </div>
      )}

      {/* Previous notes (if any and no history) */}
      {lead.notes && history.length === 0 && !loadingHistory && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Notes</p>
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2">
            {lead.notes}
          </pre>
        </div>
      )}
    </Card>
  );
}
