import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from './icons';

const VARIANTS = {
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: <Info className="text-blue-500 flex-shrink-0" size={18} />,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <CheckCircle className="text-emerald-500 flex-shrink-0" size={18} />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: <AlertTriangle className="text-amber-500 flex-shrink-0" size={18} />,
  },
  danger: {
    container: 'bg-rose-50 border-rose-200 text-rose-800',
    icon: <AlertCircle className="text-rose-500 flex-shrink-0" size={18} />,
  },
};

export default function Alert({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
  action = null,
}) {
  const current = VARIANTS[type] || VARIANTS.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all duration-150 ${current.container} ${className}`}
    >
      <div className="mt-0.5">{current.icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold leading-tight mb-0.5">{title}</h4>}
        <div className="text-xs sm:text-sm opacity-90">{children}</div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 transition-opacity"
          aria-label="Close alert"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
