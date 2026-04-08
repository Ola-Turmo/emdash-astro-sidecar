import type { HTMLAttributes } from 'astro/types';

export interface ButtonProps extends HTMLAttributes<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children?: any;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md', 
  class: className,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] focus:ring-[var(--color-primary-500)]',
    secondary: 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-300)] focus:ring-[var(--color-neutral-400)]',
    ghost: 'bg-transparent hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] focus:ring-[var(--color-neutral-400)]',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizes = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-base px-4 py-2 gap-2',
    lg: 'text-lg px-6 py-3 gap-2.5',
  };

  return (
    <button
      class={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ''}`}
      {...props}
    />
  );
}
