import Link from 'next/link';
import { Phone, Globe, Eye, MapPin, Star } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PRIORITY_BADGE_COLORS } from '@/lib/constants';
import type { Lead } from '@/types';

interface CurrentLeadCardProps {
  lead: Lead;
}

export function CurrentLeadCard({ lead }: CurrentLeadCardProps) {
  return (
    <Card padding="lg">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {lead.name}
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                PRIORITY_BADGE_COLORS[lead.priority]
              }`}
            >
              {lead.priority.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {lead.niche && <span>{lead.niche}</span>}
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {lead.city}
            </span>
            {lead.rating && (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Star className="w-4 h-4" />
                {lead.rating} ({lead.reviews_count})
              </span>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2">
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              title="Site web"
            >
              <Globe className="w-5 h-5" />
            </a>
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            title="Voir la fiche"
          >
            <Eye className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Phone number */}
      <div className="flex items-center justify-center gap-4 py-8 border-y border-zinc-200 dark:border-zinc-800">
        <a
          href={`tel:${lead.phone}`}
          className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xl font-bold transition-colors"
        >
          <Phone className="w-6 h-6" />
          {lead.phone}
        </a>
      </div>

      {/* Dirigeant info */}
      {lead.dirigeant && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            👤 Demander <strong>{lead.dirigeant}</strong>
          </p>
        </div>
      )}

      {/* Previous notes */}
      {lead.notes && (
        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Notes précédentes
          </p>
          <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
            {lead.notes}
          </pre>
        </div>
      )}
    </Card>
  );
}
