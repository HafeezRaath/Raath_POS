import React from 'react';

const VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm focus-visible:ring-indigo-500 border border-transparent',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm focus-visible:ring-indigo-500',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus-visible:ring-emerald-500 border border-transparent',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus-visible:ring-rose-500 border border-transparent',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm focus-visible:ring-amber-500 border border-transparent',
  outline: 'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 focus-visible:ring-indigo-500',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent focus-visible:ring-indigo-500',
  dark: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm focus-visible:ring-slate-900 border border-transparent',
};

const SIZES = {
  xs: 'px-2 py-1 text-xs rounded-md gap-1',
  sm: 'px-2.5 py-1.5 text-xs font-medium rounded-lg gap-1.5',
  md: 'px-3.5 py-2 text-sm font-medium rounded-lg gap-2',
  lg: 'px-4.5 py-2.5 text-base font-medium rounded-xl gap-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon = null,
  iconRight: IconRight = null,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${variantClass} ${sizeClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : Icon ? (
        <span className="flex-shrink-0">
          {React.isValidElement(Icon)
            ? Icon
            : (typeof Icon === 'function' || (typeof Icon === 'object' && Icon?.$$typeof))
              ? React.createElement(Icon, { size: size === 'xs' ? 14 : size === 'sm' ? 16 : 18 })
              : null}
        </span>
      ) : null}

      <span>{children}</span>

      {IconRight && !loading && (
        <span className="flex-shrink-0 ml-1.5">
          {React.isValidElement(IconRight)
            ? IconRight
            : (typeof IconRight === 'function' || (typeof IconRight === 'object' && IconRight?.$$typeof))
              ? React.createElement(IconRight, { size: size === 'xs' ? 14 : size === 'sm' ? 16 : 18 })
              : null}
        </span>
      )}
    </button>
  );
}
