'use client';

import { Star, Phone, ArrowRight, ExternalLink, Eye, Building2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/ui';
import type { TopLead } from '@/types';

interface TopLeadsCardProps {
  leads: TopLead[];
}

function LeadAvatar({ lead }: { lead: TopLead }) {
  // TopLead doesn't have image_url, so we use a placeholder
  return (
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <Building2 className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

export function TopLeadsCard({ leads }: TopLeadsCardProps) {
  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Star className="h-4 w-4 text-muted-foreground" />
            Leads prioritaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun lead prioritaire pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-medium">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            Leads prioritaires
          </div>
          <Link href="/leads?orderBy=score&orderDir=desc">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Voir tout
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-y border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                  Établissement
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                  Ville
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                  Score
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                  Raison
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 w-[80px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0 group hover:bg-muted/30 transition-colors">
                  {/* Établissement */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <LeadAvatar lead={lead} />
                      <div className="min-w-0">
                        <Link 
                          href={`/leads/${lead.id}`}
                          className="text-[13px] font-medium text-foreground hover:text-primary transition-colors truncate block max-w-[160px]"
                        >
                          {lead.name}
                        </Link>
                        {lead.niche && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {lead.niche}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Ville */}
                  <td className="px-4 py-3 text-[13px] text-muted-foreground">
                    {lead.city || '-'}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">{lead.score}</span>
                      <span className="text-[11px] text-muted-foreground">pts</span>
                    </div>
                  </td>

                  {/* Raison */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-muted-foreground">
                      {lead.reason}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Voir le site"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="p-1.5 rounded-md hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                          title="Appeler"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/leads/${lead.id}`}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Voir la fiche"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
