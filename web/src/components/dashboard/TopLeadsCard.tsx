'use client';

import { Star, Phone, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TopLead {
  id: number;
  name: string;
  city: string;
  niche: string | null;
  phone: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  website: string | null;
  website_status: string | null;
  pain_points: string[] | null;
  reason: string;
}

interface TopLeadsCardProps {
  leads: TopLead[];
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

      <CardContent className="space-y-1">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate group-hover:text-primary transition-colors">
                  {lead.name}
                </span>
                {!lead.website && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600">
                    Sans site
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {lead.niche ? `${lead.niche} • ` : ''}{lead.city}
              </p>
            </div>

            <div className="flex items-center gap-3 ml-3">
              <span className="text-sm font-medium text-muted-foreground">{lead.score} pts</span>
              <Phone className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
