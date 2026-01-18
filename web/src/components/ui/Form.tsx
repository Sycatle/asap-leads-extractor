import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

// ===== INPUT =====

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ className, error, icon, ...props }: InputProps) {
  return (
    <div className="w-full">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full px-4 py-2.5 border rounded-xl bg-white dark:bg-zinc-900 text-sm',
            'border-zinc-200 dark:border-zinc-800',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'transition-all duration-200',
            icon && 'pl-10',
            error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}

// ===== SEARCH INPUT =====

interface SearchInputProps extends Omit<InputProps, 'icon'> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ onSearch, onChange, ...props }: SearchInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };

  return (
    <Input
      icon={<Search className="w-4 h-4" />}
      onChange={handleChange}
      {...props}
    />
  );
}

// ===== SELECT =====

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  children?: React.ReactNode;
}

export function Select({ options, placeholder, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'px-4 py-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-sm',
        'border-zinc-200 dark:border-zinc-800',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
        'transition-all duration-200 cursor-pointer',
        'appearance-none bg-no-repeat bg-right',
        'pr-10', // Space for custom arrow
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundSize: '1.25rem',
        backgroundPosition: 'right 0.75rem center',
      }}
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </>
      )}
    </select>
  );
}

// ===== TEXTAREA =====

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      <textarea
        className={cn(
          'w-full px-4 py-3 border rounded-xl bg-white dark:bg-zinc-900 text-sm resize-none',
          'border-zinc-200 dark:border-zinc-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
          'transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}

// ===== LABEL =====

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ children, className, required, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
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
