import {
  Globe,
  X,
  Calendar,
  Search,
  Image,
  Clock,
  Smartphone,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import type { Lead } from '@/types';

interface LeadContextTagsProps {
  lead: Lead;
  compact?: boolean;
}

interface ContextTag {
  id: string;
  label: string;
  icon: typeof Globe;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'zinc';
  priority: number;
}

const TAG_COLORS = {
  red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

function generateTags(lead: Lead): ContextTag[] {
  const tags: ContextTag[] = [];

  // Website status
  if (!lead.website) {
    tags.push({
      id: 'no-site',
      label: 'Pas de site',
      icon: X,
      color: 'red',
      priority: 1,
    });
  } else if (lead.website_status === 'old') {
    tags.push({
      id: 'old-site',
      label: 'Site vieillot',
      icon: Globe,
      color: 'yellow',
      priority: 2,
    });
  } else if (lead.website_status === 'platform') {
    tags.push({
      id: 'platform-site',
      label: 'Site plateforme',
      icon: Globe,
      color: 'yellow',
      priority: 3,
    });
  }

  // Booking system
  if (lead.has_booking === false) {
    tags.push({
      id: 'no-booking',
      label: 'Pas de RDV en ligne',
      icon: Calendar,
      color: 'yellow',
      priority: 4,
    });
  }

  // SEO
  if (lead.has_seo === false) {
    tags.push({
      id: 'no-seo',
      label: 'Pas visible Google',
      icon: Search,
      color: 'red',
      priority: 5,
    });
  }

  // GMB freshness
  if (lead.last_gmb_update) {
    const lastUpdate = new Date(lead.last_gmb_update);
    const monthsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    if (monthsAgo > 6) {
      tags.push({
        id: 'gmb-stale',
        label: 'GMB inactif',
        icon: Image,
        color: 'yellow',
        priority: 6,
      });
    }
  }

  // Low rating
  if (lead.rating && lead.rating < 4) {
    tags.push({
      id: 'low-rating',
      label: `Note ${lead.rating}/5`,
      icon: AlertTriangle,
      color: 'yellow',
      priority: 7,
    });
  }

  // Few reviews
  if (lead.reviews_count !== null && lead.reviews_count < 10) {
    tags.push({
      id: 'few-reviews',
      label: 'Peu d\'avis',
      icon: AlertTriangle,
      color: 'zinc',
      priority: 8,
    });
  }

  // Phone type
  if (lead.phone_type === 'perso') {
    tags.push({
      id: 'perso-phone',
      label: 'N° perso (B2C?)',
      icon: Smartphone,
      color: 'red',
      priority: 0,
    });
  } else if (lead.phone_type === 'pro') {
    tags.push({
      id: 'pro-phone',
      label: 'N° pro',
      icon: Building2,
      color: 'green',
      priority: 10,
    });
  }

  // Best call time
  if (lead.best_call_time) {
    tags.push({
      id: 'best-time',
      label: `Appeler ${lead.best_call_time}`,
      icon: Clock,
      color: 'blue',
      priority: 9,
    });
  }

  // Sort by priority
  return tags.sort((a, b) => a.priority - b.priority);
}

export function LeadContextTags({ lead, compact = false }: LeadContextTagsProps) {
  const tags = generateTags(lead);
  
  // In compact mode, show max 3 most important tags
  const displayTags = compact ? tags.slice(0, 3) : tags;

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayTags.map((tag) => {
        const Icon = tag.icon;
        return (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLORS[tag.color]}`}
          >
            <Icon className="w-3 h-3" />
            {tag.label}
          </span>
        );
      })}
      {compact && tags.length > 3 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}
