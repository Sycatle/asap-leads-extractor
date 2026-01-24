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
  /** Cacher le bouton "Voir la fiche" (utile quand on est déjà sur la page de détail) */
  hideViewButton?: boolean;
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
      <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-muted">
        <Image
          src={lead.image_url}
          alt={lead.name}
          fill
          className="object-cover"
          sizes="96px"
          unoptimized // Google Maps images are external
        />
      </div>
    );
  }

  // Fallback: icon placeholder
  return (
    <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center shrink-0">
      <Building2 className="w-8 h-8 text-muted-foreground" />
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

// Labels lisibles pour chaque CMS/plateforme
const CMS_LABELS: Record<string, string> = {
  // CMS classiques
  wordpress: 'WordPress',
  wix: 'Wix',
  squarespace: 'Squarespace',
  webflow: 'Webflow',
  weebly: 'Weebly',
  jimdo: 'Jimdo',
  blogger: 'Blogger',
  ghost: 'Ghost',
  // E-commerce
  shopify: 'Shopify',
  prestashop: 'PrestaShop',
  woocommerce: 'WooCommerce',
  magento: 'Magento',
  opencart: 'OpenCart',
  // Plateformes métier (coiffure, beauté, santé)
  planity: 'Planity',
  treatwell: 'Treatwell',
  doctolib: 'Doctolib',
  kiute: 'Kiute Pro',
  flexy: 'Flexy',
  wavy: 'Wavy',
  // Plateformes restaurant
  thefork: 'TheFork',
  zenchef: 'Zenchef',
  metro: 'Metro Menu',
  eatbu: 'Eatbu',
  foxorders: 'FoxOrders',
  // Pages jaunes / Annuaires
  pagesjaunes: 'Pages Jaunes',
  solocal: 'Solocal',
  // Google Sites
  googlesites: 'Google Sites',
  // Réseaux sociaux comme site
  facebook: 'Page Facebook',
  instagram: 'Instagram',
  linktree: 'Linktree',
  // Autres
  custom: 'Sur-mesure',
  unknown: 'Inconnu',
};

// CMS considérés comme "plateformes" limitantes (bon argument de vente)
const PLATFORM_CMS = ['wix', 'squarespace', 'weebly', 'jimdo', 'blogger', 'linktree', 'googlesites'];

// Plateformes métier - pas un vrai site, juste une page de réservation
const BOOKING_PLATFORMS = ['planity', 'treatwell', 'doctolib', 'kiute', 'flexy', 'wavy', 'thefork', 'zenchef', 'eatbu', 'foxorders'];

// Pages sur réseaux sociaux utilisées comme site
const SOCIAL_AS_WEBSITE = ['facebook', 'instagram', 'linktree'];

// E-commerce
const ECOMMERCE_CMS = ['shopify', 'prestashop', 'woocommerce', 'magento', 'opencart'];

interface WebsiteInfo {
  label: string;
  sublabel?: string;
  type: 'none' | 'old' | 'platform' | 'ecommerce' | 'modern' | 'custom';
  issues: string[];
}

function getWebsiteInfo(lead: Lead): WebsiteInfo {
  const issues: string[] = [];
  
  // Collecter les problèmes techniques
  if (lead.has_mobile_friendly === false) issues.push('Non mobile-friendly');
  if (lead.has_ssl === false) issues.push('Pas de HTTPS');
  if (lead.page_load_time && lead.page_load_time > 3000) {
    issues.push(`Lent (${(lead.page_load_time / 1000).toFixed(1)}s)`);
  }
  
  // Pas de site web
  if (!lead.website) {
    return { label: '🚫 Pas de site web', type: 'none', issues };
  }
  
  const cms = lead.cms_type?.toLowerCase() || 'unknown';
  const cmsLabel = CMS_LABELS[cms] || cms.toUpperCase();
  
  // Site vieillot
  if (lead.website_status === 'old') {
    return {
      label: '⚠️ Site vieillot',
      sublabel: cms !== 'unknown' ? `Tech: ${cmsLabel}` : undefined,
      type: 'old',
      issues,
    };
  }
  
  // Réseaux sociaux comme site (Facebook, Instagram, Linktree)
  if (SOCIAL_AS_WEBSITE.includes(cms)) {
    return {
      label: `📱 ${cmsLabel} uniquement`,
      sublabel: 'Pas de vrai site web',
      type: 'none',
      issues,
    };
  }
  
  // Plateformes de réservation métier (Planity, Doctolib, etc.)
  if (BOOKING_PLATFORMS.includes(cms)) {
    return {
      label: `📅 Page ${cmsLabel}`,
      sublabel: 'Plateforme de réservation, pas un site propre',
      type: 'platform',
      issues,
    };
  }
  
  // Plateforme limitante (Wix, Squarespace, etc.)
  if (lead.website_status === 'platform' || PLATFORM_CMS.includes(cms)) {
    return {
      label: `📦 Site ${cmsLabel}`,
      sublabel: 'Plateforme limitante',
      type: 'platform',
      issues,
    };
  }
  
  // E-commerce
  if (ECOMMERCE_CMS.includes(cms)) {
    return {
      label: `🛒 E-commerce ${cmsLabel}`,
      type: 'ecommerce',
      issues,
    };
  }
  
  // WordPress (cas spécial - peut être bon ou mauvais)
  if (cms === 'wordpress') {
    if (lead.website_status === 'modern') {
      return {
        label: '✓ Site WordPress',
        sublabel: 'Moderne',
        type: 'modern',
        issues,
      };
    }
    return {
      label: '🔧 Site WordPress',
      sublabel: issues.length > 0 ? 'À optimiser' : undefined,
      type: 'custom',
      issues,
    };
  }
  
  // Site moderne
  if (lead.website_status === 'modern') {
    return {
      label: '✓ Site moderne',
      sublabel: cms !== 'unknown' ? cmsLabel : undefined,
      type: 'modern',
      issues,
    };
  }
  
  // Sur-mesure ou inconnu
  if (cms === 'custom') {
    return {
      label: '🔧 Site sur-mesure',
      type: 'custom',
      issues,
    };
  }
  
  return {
    label: '🌐 Site web',
    sublabel: cms !== 'unknown' ? cmsLabel : undefined,
    type: 'custom',
    issues,
  };
}

// ===== COMPOSANT ARGUMENTS DE VENTE =====
function SalesArgumentsSection({ lead }: { lead: Lead }) {
  const websiteInfo = getWebsiteInfo(lead);
  const hasPainPoints = lead.pain_points && lead.pain_points.length > 0;
  const hasTechIssues = websiteInfo.issues.length > 0;
  const hasOpportunity = websiteInfo.type === 'none' || websiteInfo.type === 'old' || websiteInfo.type === 'platform';
  
  const cms = lead.cms_type?.toLowerCase() || 'unknown';
  const isBookingPlatform = BOOKING_PLATFORMS.includes(cms);
  const isSocialOnly = SOCIAL_AS_WEBSITE.includes(cms);
  
  // Ne rien afficher s'il n'y a rien d'intéressant
  if (!hasPainPoints && !hasTechIssues && !hasOpportunity) {
    return null;
  }
  
  return (
    <div className="border-b border-border">
      {/* Header avec titre accrocheur */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-warning/20 to-danger/20">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <h3 className="text-sm font-semibold text-foreground">
            Arguments de Vente
          </h3>
          {(hasPainPoints || hasTechIssues) && (
            <span className="ml-auto px-2 py-0.5 bg-warning/20 rounded-full text-[10px] font-medium text-warning">
              {(lead.pain_points?.length || 0) + websiteInfo.issues.length} opportunités
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-gradient-to-b from-warning/5 to-transparent space-y-3">
        {/* Situation site web */}
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${
            websiteInfo.type === 'none' ? 'bg-danger/10' :
            websiteInfo.type === 'old' ? 'bg-warning/10' :
            websiteInfo.type === 'platform' ? 'bg-warning/10' :
            websiteInfo.type === 'modern' ? 'bg-success/10' :
            'bg-primary/10'
          }`}>
            <Globe className={`w-4 h-4 ${
              websiteInfo.type === 'none' ? 'text-danger' :
              websiteInfo.type === 'old' ? 'text-warning' :
              websiteInfo.type === 'platform' ? 'text-warning' :
              websiteInfo.type === 'modern' ? 'text-success' :
              'text-primary'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              websiteInfo.type === 'none' ? 'text-danger' :
              websiteInfo.type === 'old' ? 'text-warning' :
              websiteInfo.type === 'platform' ? 'text-warning' :
              websiteInfo.type === 'modern' ? 'text-success' :
              'text-primary'
            }`}>
              {websiteInfo.label}
            </p>
            {websiteInfo.sublabel && (
              <p className="text-xs text-muted-foreground">{websiteInfo.sublabel}</p>
            )}
            
            {/* Issues techniques */}
            {websiteInfo.issues.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {websiteInfo.issues.map((issue, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger/10 text-danger"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {issue}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pain points détaillés */}
        {hasPainPoints && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Points de douleur identifiés
            </p>
            <div className="grid gap-1.5">
              {lead.pain_points!.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-lg bg-card border border-warning/20"
                >
                  <span className="text-warning font-bold shrink-0 text-xs">→</span>
                  <p className="text-xs text-foreground">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Résumé rapide si pas de pain points mais opportunité */}
        {!hasPainPoints && hasOpportunity && (
          <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-xs font-medium text-warning">
              {isSocialOnly && "💡 Juste un réseau social = pas de vitrine professionnelle, aucun référencement Google"}
              {isBookingPlatform && "💡 Seulement une page de réservation = pas de site propre, dépendant de la plateforme, pas de SEO"}
              {websiteInfo.type === 'none' && !isSocialOnly && !isBookingPlatform && "💡 Pas de présence en ligne = besoin urgent d'un site web"}
              {websiteInfo.type === 'old' && "💡 Site vieillot = perte de crédibilité et de clients potentiels"}
              {websiteInfo.type === 'platform' && !isBookingPlatform && "💡 Plateforme limitante = difficile de se démarquer et de bien référencer"}
            </p>
          </div>
        )}
        
        {/* CMS et tech - toujours visible si disponible */}
        {lead.cms_type && lead.cms_type !== 'unknown' && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border">
            <span className="font-medium">Techno:</span>
            <span className="px-1.5 py-0.5 rounded bg-muted font-mono">
              {CMS_LABELS[lead.cms_type] || lead.cms_type}
            </span>
            {lead.has_booking === false && (
              <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                Pas de RDV en ligne
              </span>
            )}
            {lead.has_seo === false && (
              <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                SEO faible
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
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
    const injoignables = recentCalls.filter(h => h.new_value?.includes('injoignable'));
    if (injoignables.length >= 2) {
      return "💡 2+ tentatives sans réponse cette semaine. Essayez un autre créneau.";
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
  
  const injoignables = recentCalls.filter(h => 
    h.new_value?.toLowerCase().includes('injoignable')
  ).length;
  
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

export function CurrentLeadCard({ lead, hideViewButton = false }: CurrentLeadCardProps) {
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

  const websiteInfo = getWebsiteInfo(lead);
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
    ? 'border-l-4 border-l-danger' 
    : lead.priority === 'medium' 
      ? 'border-l-4 border-l-warning' 
      : '';

  return (
    <Card className={`p-0 overflow-hidden ${priorityBorderClass}`}>
      {/* ===== ALERTE B2C ===== */}
      {isPersoPhone && (
        <div className="px-4 py-2 bg-warning text-warning-foreground flex items-center gap-2 text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>⚠️ NUMÉRO PERSONNEL - Risque B2C, adaptez votre approche</span>
        </div>
      )}

      {/* ===== BLOC 1: ESSENTIEL ===== */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-3 mb-3">
          {/* Lead Image */}
          <LeadImage lead={lead} />

          <div className="flex-1 min-w-0">
            {/* Name + Priority */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {lead.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  PRIORITY_BADGE_COLORS[lead.priority]
                }`}
              >
                {lead.priority.toUpperCase()}
              </span>
              {lead.score && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {lead.score}
                </span>
              )}
            </div>

            {/* Activity + City */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {lead.niche && <span className="font-medium text-foreground">{lead.niche}</span>}
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {lead.city}
              </span>
              {lead.source && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {SOURCE_LABELS[lead.source] || lead.source}
                </span>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-1 shrink-0">
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                title="Site web"
              >
                <Globe className="w-4 h-4" />
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
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {!hideViewButton && (
              <Link
                href={`/leads/${lead.id}`}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                title="Voir la fiche"
              >
                <Eye className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Phone number - Main CTA */}
        <div className="flex flex-col items-center gap-2 py-3">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${lead.phone}`}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xl font-bold transition-colors tracking-wide ${
                isPersoPhone
                  ? 'bg-warning hover:bg-warning/90 text-warning-foreground'
                  : 'bg-success hover:bg-success/90 text-white'
              }`}
            >
              <Phone className="w-5 h-5" />
              {formattedPhone}
            </a>
            <button
              onClick={copyPhone}
              className="p-2.5 rounded-lg bg-muted hover:bg-accent transition-colors"
              title="Copier le numéro"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
          {phoneTypeLabel && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium ${
                isPersoPhone ? 'text-warning' : 'text-success'
              }`}
            >
              {isPersoPhone ? <Smartphone className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
              {phoneTypeLabel}
            </span>
          )}
        </div>

        {/* ===== TAGS CRITIQUES SOUS LE TÉLÉPHONE ===== */}
        <div className="flex flex-wrap justify-center gap-1.5 py-2">
          {/* Website status - compact version */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            websiteInfo.type === 'none' 
              ? 'bg-danger/10 text-danger' 
              : websiteInfo.type === 'modern'
                ? 'bg-success/10 text-success'
                : websiteInfo.type === 'platform' || websiteInfo.type === 'old'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-primary/10 text-primary'
          }`}>
            <Globe className="w-3.5 h-3.5" />
            {websiteInfo.label}
            {websiteInfo.sublabel && <span className="opacity-75">• {websiteInfo.sublabel}</span>}
          </span>
          
          {/* Créneau optimal */}
          {lead.best_call_time && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              callTimeStatus === 'optimal'
                ? 'bg-success/10 text-success'
                : 'bg-primary/10 text-primary'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {callTimeStatus === 'optimal' 
                ? `✓ Bon moment (${lead.best_call_time})`
                : `Appeler ${lead.best_call_time}`
              }
            </span>
          )}
          
          {/* Ouvert/Fermé */}
          {openStatus && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              openStatus === 'open'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}>
              {openStatus === 'open' ? '🟢 Ouvert' : '🔴 Fermé'}
            </span>
          )}
        </div>

        {/* Meta info row */}
        <div className="flex items-center justify-center gap-3 text-xs pt-2">
          {/* Last contact */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Dernier contact: <strong className="text-foreground">{formatLastContact(lead.last_contact_at)}</strong></span>
          </div>

          {/* Attempts counter */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>
              Tentatives: <strong className="text-foreground">{lead.attempts_30d ?? lead.attempts_count ?? 0}/4</strong>
            </span>
            {(lead.attempts_30d ?? 0) >= 3 && (
              <AlertTriangle className="w-3 h-3 text-warning" />
            )}
          </div>

          {/* Rating - compact */}
          {lead.rating && (
            <div className="flex items-center gap-1 text-warning">
              <Star className="w-3 h-3 fill-current" />
              <span>{lead.rating}</span>
              <span className="text-muted-foreground">({lead.reviews_count})</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== BLOC 2: DIRIGEANT ===== */}
      {lead.dirigeant && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border">
          <p className="text-xs text-primary">
            👤 Demander <strong>{lead.dirigeant}</strong>
            {lead.legal_name && lead.legal_name !== lead.name && (
              <span className="opacity-75"> ({lead.legal_name})</span>
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
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span>Script d&apos;appel</span>
            <kbd className="kbd">S</kbd>
          </div>
          {showScript ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        {showScript && (
          <div className="px-4 pb-3">
            <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">
              {script}
            </pre>
          </div>
        )}
      </div>

      {/* ===== BLOC 4: TIP CONTEXTUEL ===== */}
      {contextualTip && (
        <div className="px-4 py-2 bg-info/5 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-info">
            <Lightbulb className="w-3.5 h-3.5 shrink-0" />
            <span>{contextualTip}</span>
          </div>
        </div>
      )}

      {/* ===== BLOC 4.5: ARGUMENTS DE VENTE (Pain Points + Tech Issues) ===== */}
      <SalesArgumentsSection lead={lead} />

      {/* ===== BLOC 5: HISTORIQUE AVEC RÉSUMÉ ===== */}
      {(history.length > 0 || loadingHistory) && (
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Historique récent
              </h3>
            </div>
            
            {/* Résumé intelligent */}
            {historySummary && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                historySummary.type === 'warning'
                  ? 'bg-warning/10 text-warning'
                  : historySummary.type === 'success'
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {historySummary.text}
              </span>
            )}
          </div>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full" />
            </div>
          ) : (
            <LeadHistoryCompact history={history} maxItems={3} />
          )}
        </div>
      )}

      {/* Previous notes (if any and no history) */}
      {lead.notes && history.length === 0 && !loadingHistory && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
            {lead.notes}
          </pre>
        </div>
      )}
    </Card>
  );
}
