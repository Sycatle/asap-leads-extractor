import Link from 'next/link';
import { Clock, Pause, Play, ArrowLeft, Phone, CheckCircle, Voicemail, X, TrendingUp } from 'lucide-react';
import { formatTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import type { Session } from '@/types';

interface SessionHeaderProps {
  session: Session;
  elapsedTime: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

// Format average time per call
function formatAvgTime(totalSeconds: number, totalCalls: number): string {
  if (totalCalls === 0) return '-';
  const avgSeconds = Math.round(totalSeconds / totalCalls);
  const mins = Math.floor(avgSeconds / 60);
  const secs = avgSeconds % 60;
  return `${mins}m${secs.toString().padStart(2, '0')}s`;
}

export function SessionHeader({
  session,
  elapsedTime,
  isPaused,
  onTogglePause,
  onEnd,
}: SessionHeaderProps) {
  const avgTimePerCall = formatAvgTime(elapsedTime, session.total_calls);
  const isLongCall = session.total_calls > 0 && (elapsedTime / session.total_calls) > 300;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads" onClick={onEnd}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-[18px] h-[18px] text-muted-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                Session d&apos;appel
              </h1>
              {isPaused && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning">
                  En pause
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="hidden md:inline">Raccourcis: </span>
              <kbd className="kbd">I M R V</kbd> résultat
              <span className="mx-1.5 opacity-40">•</span>
              <kbd className="kbd">Espace</kbd> passer
              <span className="mx-1.5 opacity-40">•</span>
              <kbd className="kbd">Échap</kbd> pause
            </p>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center gap-3">
          {/* Timer + Average */}
          <div className="flex flex-col items-center">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              isPaused 
                ? 'bg-warning/10 text-warning'
                : isLongCall
                  ? 'bg-danger/10 text-danger'
                  : 'bg-primary/10 text-primary'
            )}>
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-sm font-semibold tabular-nums">{formatTime(elapsedTime)}</span>
            </div>
            {session.total_calls > 0 && (
              <div className={cn(
                'flex items-center gap-1 text-[10px] mt-1',
                isLongCall ? 'text-danger' : 'text-muted-foreground'
              )}>
                <TrendingUp className="w-2.5 h-2.5" />
                <span>Moy: {avgTimePerCall}/appel</span>
              </div>
            )}
          </div>
          
          {/* Stats pills */}
          <div className="hidden lg:flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-xs">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-semibold tabular-nums">{session.total_calls}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 text-xs text-success">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-semibold tabular-nums">{session.total_reached}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning/10 text-xs text-warning">
              <Voicemail className="w-3.5 h-3.5" />
              <span className="font-semibold tabular-nums">{session.total_voicemail}</span>
            </div>
          </div>

          {/* Pause/Play button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePause}
            className={cn(
              isPaused
                ? 'bg-success text-white hover:bg-success/90'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>

          {/* End button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnd}
            className="bg-danger/10 text-danger hover:bg-danger/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
