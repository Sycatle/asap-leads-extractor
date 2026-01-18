import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-blue-500 border-t-transparent animate-spin',
        sizes[size],
        className
      )}
    />
  );
}

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Chargement...', className }: LoadingStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-100 gap-4 animate-fade-in',
      className
    )}>
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}

// ===== SKELETON =====

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div 
      className={cn(
        'bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse',
        className
      )} 
    />
  );
}

// ===== SKELETON CARD =====

export function SkeletonCard() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

// ===== SKELETON TABLE ROW =====

export function SkeletonTableRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-4"><Skeleton className="h-5 w-32" /></td>
      <td className="p-4"><Skeleton className="h-5 w-24" /></td>
      <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="p-4"><Skeleton className="h-5 w-28" /></td>
      <td className="p-4"><Skeleton className="h-8 w-8 rounded-lg" /></td>
    </tr>
  );
}
