import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon = null,
    iconRight: IconRight = null,
    className = '',
    containerClassName = '',
    id,
    type = 'text',
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
            {React.isValidElement(Icon)
              ? Icon
              : (typeof Icon === 'function' || (typeof Icon === 'object' && Icon?.$$typeof))
                ? React.createElement(Icon, { size: 18 })
                : null}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-lg border transition-all duration-150 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
            Icon ? 'pl-9' : ''
          } ${IconRight ? 'pr-9' : ''} ${
            error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 hover:border-slate-400'
          } ${className}`}
          {...props}
        />

        {IconRight && (
          <div className="absolute right-3 flex items-center text-slate-400">
            {React.isValidElement(IconRight)
              ? IconRight
              : (typeof IconRight === 'function' || (typeof IconRight === 'object' && IconRight?.$$typeof))
                ? React.createElement(IconRight, { size: 18 })
                : null}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, helperText, className = '', containerClassName = '', id, rows = 3, ...props },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-lg border transition-all duration-150 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-50 disabled:text-slate-500 ${
          error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 hover:border-slate-400'
        } ${className}`}
        {...props}
      />
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, helperText, children, className = '', containerClassName = '', id, ...props },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={`w-full bg-white text-slate-900 text-sm rounded-lg border transition-all duration-150 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-50 disabled:text-slate-500 ${
          error ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 hover:border-slate-400'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

export default Input;
