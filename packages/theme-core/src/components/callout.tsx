export interface CalloutProps {
  type?: 'info' | 'warning' | 'tip' | 'danger';
  title?: string;
  children?: any;
}

export default function Callout({ 
  type = 'info', 
  title,
  children 
}: CalloutProps) {
  const styles = {
    info: 'border-[var(--color-info)] bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200',
    warning: 'border-[var(--color-warning)] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200',
    tip: 'border-[var(--color-success)] bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200',
    danger: 'border-[var(--color-danger)] bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200',
  };

  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    tip: '💡',
    danger: '🚨',
  };

  return (
    <div class={`border-l-4 p-4 rounded-r-lg ${styles[type]}`}>
      {title && <strong class="block mb-1">{icons[type]} {title}</strong>}
      {children}
    </div>
  );
}
