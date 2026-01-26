import Link from 'next/link';
import { Phone, ArrowRight, Play, Sparkles } from 'lucide-react';
import type { Session } from '@/types';

interface SessionBannerProps {
  session: Session;
}

export function SessionBanner({ session }: SessionBannerProps) {
  const successRate = session.total_calls > 0 
    ? Math.round((session.total_reached / session.total_calls) * 100) 
    : 0;

  return (
    <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-r from-success/90 to-emerald-500/90 text-white">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full" />
      </div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-medium">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-soft" />
                Session active
              </span>
            </div>
            <p className="text-lg font-semibold">{session.total_calls} appels</p>
            <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
              <span>{session.total_reached} conversations</span>
              <span>•</span>
              <span>{successRate}% succès</span>
            </div>
          </div>
        </div>
        <Link
          href="/call"
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-success rounded-lg text-sm font-medium hover:bg-white/90 transition-all shadow-lg"
        >
          <span>Reprendre</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

interface CallCTAProps {
  toCall: number;
  overdueFollowups: number;
}

export function CallCTA({ toCall, overdueFollowups }: CallCTAProps) {
  const hasUrgent = overdueFollowups > 0;
  
  return (
    <Link
      href="/call"
      className="group relative block overflow-hidden rounded-xl p-5 bg-gradient-to-r from-primary via-indigo-500 to-violet-500 text-white transition-all hover:shadow-xl hover:shadow-primary/20"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white rounded-full" />
        <div className="absolute -bottom-8 left-1/4 w-32 h-32 bg-white rounded-full" />
      </div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-105 transition-transform">
            <Play className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-0.5 flex items-center gap-2">
              Lancer une session
              <Sparkles className="w-4 h-4 text-amber-300" />
            </h2>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {toCall} leads à contacter
              </span>
              {hasUrgent && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-pulse-soft" />
                    {overdueFollowups} urgentes
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/10 group-hover:bg-white/20 transition-all">
          <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
