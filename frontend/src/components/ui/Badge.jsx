import React from 'react';

const VARIANTS = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
  info: 'bg-blue-50 text-blue-700 border-blue-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

const DOT_COLORS = {
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  slate: 'bg-slate-500',
};

export default function Badge({
  children,
  variant = 'slate',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.slate;
  const dotColor = DOT_COLORS[variant] || DOT_COLORS.slate;
  const sizeClass = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors ${sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />}
      <span>{children}</span>
    </span>
  );
}
