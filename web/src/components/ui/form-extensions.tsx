'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Search } from 'lucide-react';

// ===== LABEL =====

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ children, className, required, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'block text-sm font-medium text-foreground mb-2',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

// ===== SEARCH INPUT =====

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ onSearch, onChange, className, ...props }: SearchInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
      <Input
        className={cn('pl-10', className)}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}

// ===== FORM GROUP =====

interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({ children, className }: FormGroupProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {children}
    </div>
  );
}

// ===== NATIVE SELECT =====

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export function NativeSelect({ children, className, ...props }: NativeSelectProps) {
  return (
    <select
      className={cn(
        'flex h-9 rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
