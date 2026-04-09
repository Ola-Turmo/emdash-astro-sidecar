import type { HTMLAttributes } from 'astro/types';

export interface CardProps extends HTMLAttributes<'div'> {
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: any;
}

export default function Card({ 
  variant = 'default', 
  padding = 'md', 
  class: className,
  ...props 
}: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-[var(--color-neutral-900)] rounded-xl',
    elevated: 'bg-white dark:bg-[var(--color-neutral-900)] rounded-xl shadow-lg',
    bordered: 'bg-white dark:bg-[var(--color-neutral-900)] rounded-xl border border-[var(--color-neutral-200)] dark:border-[var(--color-neutral-700)]',
  };
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      class={`${variants[variant]} ${paddings[padding]} ${className || ''}`}
      {...props}
    />
  );
}
