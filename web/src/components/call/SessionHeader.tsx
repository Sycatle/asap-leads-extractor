import Link from 'next/link';
import { Clock, Pause, Play, ArrowLeft, Phone, CheckCircle, Voicemail, X } from 'lucide-react';
import { formatTime, cn } from '@/lib/utils';

import type { Session } from '@/types';

interface SessionHeaderProps {
  session: Session;
  elapsedTime: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

export function SessionHeader({
  session,
  elapsedTime,
  isPaused,
  onTogglePause,
  onEnd,
}: SessionHeaderProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/leads"
            onClick={onEnd}
            className="p-2.5 rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                Session d&apos;appel
              </h1>
              {isPaused && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  En pause
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">
              <span className="hidden md:inline">Raccourcis: </span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">1-5</kbd> résultat
              <span className="mx-1">•</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Espace</kbd> passer
              <span className="mx-1">•</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Échap</kbd> pause
            </p>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl',
            isPaused 
              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
              : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
          )}>
            <Clock className="w-4 h-4" />
            <span className="font-mono text-lg font-bold tabular-nums">{formatTime(elapsedTime)}</span>
          </div>
          
          {/* Stats pills */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{session.total_calls}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">{session.total_reached}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-600 dark:text-amber-400">
              <Voicemail className="w-4 h-4" />
              <span className="font-semibold">{session.total_voicemail}</span>
            </div>
          </div>

          {/* Pause/Play button */}
          <button
            onClick={onTogglePause}
            className={cn(
              'p-3 rounded-xl transition-all',
              isPaused
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          {/* End button */}
          <button
            onClick={onEnd}
            className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
