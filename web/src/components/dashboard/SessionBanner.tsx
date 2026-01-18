import Link from 'next/link';
import { Phone, ArrowRight, Rocket, Zap } from 'lucide-react';
import type { Session } from '@/types';

interface SessionBannerProps {
  session: Session;
}

export function SessionBanner({ session }: SessionBannerProps) {
  const successRate = session.total_calls > 0 
    ? Math.round((session.total_reached / session.total_calls) * 100) 
    : 0;

  return (
    <div className="relative overflow-hidden card p-6 bg-linear-to-r from-emerald-600 to-teal-600 text-white border-none">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                Session active
              </span>
            </div>
            <p className="text-xl font-bold">{session.total_calls} appels</p>
            <div className="flex items-center gap-3 text-sm text-emerald-100 mt-1">
              <span>{session.total_reached} conversations</span>
              <span>•</span>
              <span>{session.total_voicemail} messages</span>
              <span>•</span>
              <span>{successRate}% de succès</span>
            </div>
          </div>
        </div>
        <Link
          href="/call"
          className="flex items-center gap-2 px-5 py-3 bg-white text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl hover:scale-105"
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
      className="group relative block overflow-hidden card p-6 bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 text-white border-none hover:shadow-2xl transition-all duration-300"
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white rounded-full translate-y-1/2" />
      </div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
            <Rocket className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
              Lancer une session
              <Zap className="w-5 h-5 text-yellow-300" />
            </h2>
            <div className="flex items-center gap-3 text-blue-100">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                {toCall} leads à contacter
              </span>
              {hasUrgent && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-orange-200">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                    {overdueFollowups} relances urgentes
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/10 group-hover:bg-white/20 transition-all">
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
