import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ===== BUTTON =====

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const buttonVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98]',
  secondary: 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600',
  ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md active:scale-[0.98]',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98]',
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ===== LINK BUTTON =====

interface LinkButtonProps {
  href: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  onClick,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ===== ACTION BUTTON =====

interface ActionButtonProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  color: 'green' | 'yellow' | 'blue' | 'red' | 'purple' | 'orange' | 'zinc';
  small?: boolean;
}

const actionColors = {
  green: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300',
  blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300',
  zinc: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
};

export function ActionButton({
  icon,
  label,
  onClick,
  loading,
  color,
  small,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50',
        small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        actionColors[color]
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ===== ICON BUTTON =====

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'ghost' | 'subtle';
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  const variants = {
    ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
    subtle: 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500',
  };

  return (
    <button
      title={label}
      className={cn(
        'p-2 rounded-lg transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
