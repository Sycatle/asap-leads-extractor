import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(date: Date, isOverdue = false): string {
  if (isOverdue) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days}j`;
  }
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR');
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('fr-FR');
}
