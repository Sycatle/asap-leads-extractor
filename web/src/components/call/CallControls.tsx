'use client';

import { useRef, useEffect } from 'react';
import { MessageSquare, SkipForward } from 'lucide-react';
import { Card } from '@/components/ui';

// ===== QUICK NOTE INPUT =====

interface QuickNoteInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function QuickNoteInput({ value, onChange }: QuickNoteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Note rapide (optionnelle)..."
          className="flex-1 bg-transparent border-none outline-none text-sm"
        />
        <kbd className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
          N
        </kbd>
      </div>
    </Card>
  );
}

// ===== CALL ACTIONS =====

interface CallActionsProps {
  onSkip: () => void;
  onEnd: () => void;
  disabled?: boolean;
}

export function CallActions({ onSkip, onEnd, disabled }: CallActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onSkip}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
      >
        <SkipForward className="w-5 h-5" />
        Passer
        <kbd className="text-xs opacity-50 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded ml-1">
          Espace
        </kbd>
      </button>

      <button
        onClick={onEnd}
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Terminer la session
      </button>
    </div>
  );
}
