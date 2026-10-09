import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { X } from './icons';

// ==================== THEME & UTILITIES ====================
export const parseSx = (sx) => {
  if (!sx) return {};
  if (Array.isArray(sx)) {
    return sx.reduce((acc, item) => ({ ...acc, ...parseSx(item) }), {});
  }
  if (typeof sx === 'function') {
    return parseSx(sx({
      palette: {
        primary: { main: '#1c2580', light: '#e8eaf6', dark: '#141a5c' },
        secondary: { main: '#00c853', light: '#e8f5e9', dark: '#009624' },
        success: { main: '#10b981', light: '#ecfdf5', dark: '#059669' },
        warning: { main: '#f59e0b', light: '#fffbeb', dark: '#d97706' },
        error: { main: '#ef4444', light: '#fef2f2', dark: '#dc2626' },
        info: { main: '#2563eb', light: '#eff6ff', dark: '#1d4ed8' },
      }
    }));
  }
  if (typeof sx !== 'object') return {};

  const spacing = (val) => {
    if (typeof val === 'number') return `${val * 8}px`;
    return val;
  };

  const radius = (val) => {
    if (typeof val === 'number') return `${val * 4}px`;
    return val;
  };

  const resolveColor = (c) => {
    if (c === 'text.primary') return '#0f172a';
    if (c === 'text.secondary') return '#475569';
    if (c === 'text.disabled') return '#94a3b8';
    if (c === 'primary' || c === 'primary.main') return '#1c2580';
    if (c === 'primary.light' || c === 'primary.50') return '#e8eaf6';
    if (c === 'primary.dark') return '#141a5c';
    if (c === 'secondary' || c === 'secondary.main') return '#00c853';
    if (c === 'secondary.light' || c === 'secondary.50') return '#e8f5e9';
    if (c === 'secondary.dark') return '#009624';
    if (c === 'success' || c === 'success.main') return '#10b981';
    if (c === 'success.light' || c === 'success.50') return '#ecfdf5';
    if (c === 'success.dark') return '#059669';
    if (c === 'error' || c === 'error.main') return '#ef4444';
    if (c === 'error.light' || c === 'error.50') return '#fef2f2';
    if (c === 'error.dark') return '#dc2626';
    if (c === 'warning' || c === 'warning.main') return '#f59e0b';
    if (c === 'warning.light' || c === 'warning.50') return '#fffbeb';
    if (c === 'warning.dark') return '#d97706';
    if (c === 'info' || c === 'info.main') return '#2563eb';
    if (c === 'info.light' || c === 'info.50') return '#eff6ff';
    if (c === 'info.dark') return '#1d4ed8';
    if (c === 'grey.50') return '#f8fafc';
    if (c === 'grey.100') return '#f1f5f9';
    if (c === 'grey.200') return '#e2e8f0';
    if (c === 'divider') return '#e2e8f0';
    return c;
  };

  const resolveVal = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v.md ?? v.sm ?? v.xs ?? Object.values(v)[0];
    }
    return v;
  };

  const style = {};

  for (const [key, rawValue] of Object.entries(sx)) {
    if (key.startsWith('&') || key.startsWith('@')) {
      continue;
    }
    if (rawValue === undefined || rawValue === null) continue;

    const val = resolveVal(rawValue);

    switch (key) {
      case 'bgcolor':
      case 'bg':
      case 'backgroundColor':
        style.backgroundColor = resolveColor(val);
        break;
      case 'color':
        style.color = resolveColor(val);
        break;
      case 'borderColor':
        style.borderColor = resolveColor(val);
        break;
      case 'p':
      case 'padding':
        style.padding = spacing(val);
        break;
      case 'px':
        style.paddingLeft = spacing(val);
        style.paddingRight = spacing(val);
        break;
      case 'py':
        style.paddingTop = spacing(val);
        style.paddingBottom = spacing(val);
        break;
      case 'pt':
      case 'paddingTop':
        style.paddingTop = spacing(val);
        break;
      case 'pb':
      case 'paddingBottom':
        style.paddingBottom = spacing(val);
        break;
      case 'pl':
      case 'paddingLeft':
        style.paddingLeft = spacing(val);
        break;
      case 'pr':
      case 'paddingRight':
        style.paddingRight = spacing(val);
        break;
      case 'm':
      case 'margin':
        style.margin = spacing(val);
        break;
      case 'mx':
        style.marginLeft = spacing(val);
        style.marginRight = spacing(val);
        break;
      case 'my':
        style.marginTop = spacing(val);
        style.marginBottom = spacing(val);
        break;
      case 'mt':
      case 'marginTop':
        style.marginTop = spacing(val);
        break;
      case 'mb':
      case 'marginBottom':
        style.marginBottom = spacing(val);
        break;
      case 'ml':
      case 'marginLeft':
        style.marginLeft = spacing(val);
        break;
      case 'mr':
      case 'marginRight':
        style.marginRight = spacing(val);
        break;
      case 'gap':
        style.gap = spacing(val);
        break;
      case 'rowGap':
        style.rowGap = spacing(val);
        break;
      case 'columnGap':
        style.columnGap = spacing(val);
        break;
      case 'borderRadius':
        style.borderRadius = radius(val);
        break;
      case 'fontSize':
        style.fontSize = typeof val === 'number' ? `${val}px` : val;
        break;
      case 'fontWeight':
        style.fontWeight = val;
        break;
      case 'boxShadow':
        if (typeof val === 'number') {
          const shadows = [
            'none',
            '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          ];
          style.boxShadow = shadows[val] || shadows[1];
        } else {
          style.boxShadow = val;
        }
        break;
      default:
        style[key] = val;
        break;
    }
  }

  return style;
};

// ==================== CORE LAYOUT: Box ====================
export const Box = forwardRef(function Box(
  { component: Component = 'div', className = '', sx, style = {}, children, onClick, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  return (
    <Component
      ref={ref}
      className={className}
      style={{ ...parsedSx, ...style }}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
});
export const alpha = (color, opacity) => {
  if (!color) return `rgba(0, 0, 0, ${opacity})`;
  if (color.startsWith('#')) {
    let c = color.substring(1);
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${opacity})`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  return color;
};

export const useTheme = () => ({
  palette: {
    primary: { main: '#1c2580', light: '#e8eaf6', dark: '#141a5c', contrastText: '#ffffff' },
    secondary: { main: '#00c853', light: '#e8f5e9', dark: '#009624', contrastText: '#ffffff' },
    success: { main: '#10b981', light: '#ecfdf5', dark: '#059669', contrastText: '#ffffff' },
    warning: { main: '#f59e0b', light: '#fffbeb', dark: '#d97706', contrastText: '#ffffff' },
    error: { main: '#ef4444', light: '#fef2f2', dark: '#dc2626', contrastText: '#ffffff' },
    info: { main: '#2563eb', light: '#eff6ff', dark: '#1d4ed8', contrastText: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#475569', disabled: '#94a3b8' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    divider: '#e2e8f0',
    common: { white: '#ffffff', black: '#000000' },
  },
  breakpoints: {
    down: (key) => key,
    up: (key) => key,
  },
});

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (typeof query === 'string') {
        if (query === 'sm') setMatches(w < 640);
        else if (query === 'md') setMatches(w < 768);
        else if (query === 'lg') setMatches(w < 1024);
        else setMatches(w < 768);
      } else {
        setMatches(w < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [query]);
  return matches;
};

export const styled = (Component) => (stylesFn) => {
  const StyledComponent = forwardRef(({ className = '', sx, ...props }, ref) => {
    return <Component ref={ref} className={className} {...props} />;
  });
  StyledComponent.displayName = 'StyledComponent';
  return StyledComponent;
};

// ==================== TYPOGRAPHY ====================
export const Typography = forwardRef(function Typography(
  {
    variant = 'body1',
    component,
    color,
    align,
    fontWeight,
    gutterBottom,
    noWrap = false,
    className = '',
    children,
    sx,
    style = {},
    ...props
  },
  ref
) {
  const parsedSx = parseSx(sx);
  const tagMap = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    subtitle1: 'p',
    subtitle2: 'p',
    body1: 'p',
    body2: 'p',
    caption: 'span',
    button: 'span',
    overline: 'span',
  };

  const Component = component || tagMap[variant] || 'p';

  const variantClasses = {
    h1: 'text-3xl sm:text-4xl font-black tracking-tight text-slate-900',
    h2: 'text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900',
    h3: 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900',
    h4: 'text-lg sm:text-xl font-bold text-slate-900',
    h5: 'text-[17.5px] sm:text-lg font-bold text-slate-900',
    h6: 'text-[16.5px] sm:text-[18px] font-bold text-slate-900',
    subtitle1: 'text-[17px] sm:text-[18.5px] font-bold text-slate-900',
    subtitle2: 'text-[16px] font-semibold text-slate-800',
    body1: 'text-[16.5px] sm:text-[17px] text-slate-800 leading-relaxed font-normal',
    body2: 'text-[15.5px] sm:text-[16px] text-slate-700 leading-normal',
    caption: 'text-[13.5px] sm:text-[14px] text-slate-500 leading-normal font-medium',
    button: 'text-[15px] sm:text-[15.5px] font-bold tracking-wide',
    overline: 'text-[13.5px] font-bold uppercase tracking-widest text-slate-400',
  };

  const alignClass = align ? `text-${align}` : '';
  const gutterClass = gutterBottom ? 'mb-2' : '';
  const weightClass =
    fontWeight === 'bold'
      ? 'font-bold'
      : fontWeight === 'medium'
      ? 'font-medium'
      : fontWeight === 'normal'
      ? 'font-normal'
      : '';

  const noWrapStyle = noWrap ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {};

  return (
    <Component
      ref={ref}
      className={`${variantClasses[variant] || 'text-base'} ${alignClass} ${gutterClass} ${weightClass} ${className}`}
      style={{ ...noWrapStyle, ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </Component>
  );
});

// ==================== BUTTONS ====================
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'contained',
    color = 'primary',
    size = 'medium',
    fullWidth = false,
    disabled = false,
    startIcon = null,
    endIcon = null,
    className = '',
    onClick,
    component: Component = 'button',
    to,
    type = 'button',
    sx,
    style = {},
    ...props
  },
  ref
) {
  const parsedSx = parseSx(sx);
  const hasCustomBg = parsedSx.backgroundColor || style.backgroundColor;
  const hasCustomBorder = parsedSx.borderColor || style.borderColor;
  const hasCustomColor = parsedSx.color || style.color;

  let baseColorClass = '';

  if (variant === 'contained') {
    if (hasCustomBg) {
      baseColorClass = hasCustomColor ? '' : 'text-white shadow-xs';
    } else if (color === 'success') baseColorClass = 'bg-[#00c853] hover:bg-[#00b046] text-white shadow-xs';
    else if (color === 'error') baseColorClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs';
    else if (color === 'warning') baseColorClass = 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs';
    else if (color === 'info') baseColorClass = 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs';
    else if (color === 'secondary') baseColorClass = 'bg-[#00c853] hover:bg-[#00b046] text-white shadow-xs';
    else baseColorClass = 'bg-[#1c2580] hover:bg-[#141a5c] text-white shadow-xs';
  } else if (variant === 'outlined') {
    if (hasCustomBorder || hasCustomColor) {
      baseColorClass = 'border';
    } else if (color === 'success') baseColorClass = 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50';
    else if (color === 'error') baseColorClass = 'border border-rose-400 text-rose-600 hover:bg-rose-50';
    else if (color === 'warning') baseColorClass = 'border border-amber-400 text-amber-600 hover:bg-amber-50';
    else baseColorClass = 'border border-slate-300 text-[#1c2580] hover:bg-blue-50/50 hover:border-[#1c2580]';
  } else {
    // text
    baseColorClass = hasCustomColor ? '' : 'text-[#1c2580] hover:bg-blue-50 hover:text-[#141a5c]';
  }

  const sizeClasses = {
    small: 'h-[38px] px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-lg',
    medium: 'h-[42px] px-4 py-2 text-sm font-semibold gap-2 rounded-xl',
    large: 'px-5 py-2.5 text-base font-bold gap-2.5 rounded-xl',
  };

  const finalSize = sizeClasses[size] || sizeClasses.medium;

  return (
    <Component
      ref={ref}
      to={to}
      type={Component === 'button' ? type : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${baseColorClass} ${finalSize} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
      <span>{children}</span>
      {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton(
  { children, onClick, disabled = false, size = 'medium', color, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  const sizeClasses = {
    small: 'p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg',
    medium: 'p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg',
    large: 'p-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl',
  };
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        sizeClasses[size] || sizeClasses.medium
      } ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </button>
  );
});

export const ButtonGroup = ({ children, size = 'medium', className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`inline-flex rounded-lg shadow-xs overflow-hidden border border-slate-300 divide-x divide-slate-300 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const Fab = forwardRef(function Fab(
  { children, color = 'primary', size = 'large', className = '', onClick, sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  const colorClasses = {
    primary: 'bg-[#1c2580] hover:bg-[#141a5c] text-white shadow-lg shadow-indigo-950/30',
    success: 'bg-[#00c853] hover:bg-[#00b046] text-white shadow-lg shadow-emerald-950/30',
    secondary: 'bg-slate-800 hover:bg-slate-900 text-white shadow-lg',
  };
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`rounded-full flex items-center justify-center font-bold transition-transform active:scale-95 ${
        colorClasses[color] || colorClasses.primary
      } ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </button>
  );
});

// ==================== CARDS & CONTAINERS ====================
export const Paper = forwardRef(function Paper(
  { elevation = 1, variant = 'elevation', children, className = '', sx, style = {}, onClick, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  const hasCustomBg = parsedSx.backgroundColor || style.backgroundColor;
  const hasCustomRadius = parsedSx.borderRadius !== undefined || style.borderRadius !== undefined;

  const shadowClass =
    variant === 'outlined'
      ? 'border border-slate-200/80 shadow-none'
      : elevation >= 4
      ? 'shadow-lg border border-slate-200/60'
      : 'shadow-xs border border-slate-200/80';

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`${hasCustomBg ? '' : 'bg-white'} ${hasCustomRadius ? '' : 'rounded-xl'} ${shadowClass} ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </div>
  );
});

export const Card = forwardRef(function Card({ children, className = '', sx, style = {}, onClick, ...props }, ref) {
  const parsedSx = parseSx(sx);
  const hasCustomRadius = parsedSx.borderRadius !== undefined || style.borderRadius !== undefined;
  return (
    <Paper ref={ref} onClick={onClick} className={`${hasCustomRadius ? '' : 'rounded-xl'} overflow-hidden ${className}`} sx={sx} style={style} {...props}>
      {children}
    </Paper>
  );
});

export const CardContent = forwardRef(function CardContent({ children, className = '', sx, style = {}, ...props }, ref) {
  const parsedSx = parseSx(sx);
  return (
    <div ref={ref} className={`p-4 sm:p-5 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
});

export const CardHeader = forwardRef(function CardHeader(
  { title, subheader, action, avatar, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  return (
    <div ref={ref} className={`p-4 sm:p-5 pb-2 flex items-center justify-between gap-3 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      <div className="flex items-center gap-3">
        {avatar}
        <div>
          {title && <h4 className="text-sm font-bold text-slate-900 leading-tight">{title}</h4>}
          {subheader && <p className="text-xs text-slate-500 mt-0.5">{subheader}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
});

// ==================== FORM INPUTS ====================
export const TextField = forwardRef(function TextField(
  {
    label,
    value,
    onChange,
    type = 'text',
    name,
    placeholder,
    disabled = false,
    required = false,
    multiline = false,
    rows = 3,
    size = 'medium',
    fullWidth = false,
    error = false,
    helperText,
    InputProps,
    inputRef,
    slotProps,
    className = '',
    sx,
    style = {},
    inputProps,
    select = false,
    children,
    ...props
  },
  ref
) {
  const parsedSx = parseSx(sx);
  const isFull = fullWidth && !parsedSx.width && !parsedSx.minWidth;
  const startAdornment = InputProps?.startAdornment || slotProps?.input?.startAdornment;
  const endAdornment = InputProps?.endAdornment || slotProps?.input?.endAdornment;
  const targetRef = inputRef || ref;
  const isSmall = size === 'small' || slotProps?.textField?.size === 'small';

  return (
    <div
      className={`flex flex-col gap-1 ${isFull ? 'w-full' : ''} ${className}`}
      style={{ ...parsedSx, ...style }}
    >
      {label && (
        <label className="text-sm font-semibold text-slate-700 select-none flex items-center gap-0.5 mb-0.5">
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {startAdornment && (
          <div className="absolute left-2.5 flex items-center pointer-events-none text-slate-400">
            {startAdornment}
          </div>
        )}

        {select ? (
          <select
            ref={targetRef}
            name={name}
            {...(value !== undefined && value !== null ? { value } : {})}
            defaultValue={props.defaultValue}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={`w-full bg-white text-slate-900 text-sm rounded-lg border transition-all duration-150 py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-[#1c2580] disabled:bg-slate-50 disabled:text-slate-500 ${
              isSmall ? 'h-[38px] py-1.5 px-3 text-xs' : 'h-[42px] py-2.5 px-3.5 text-sm'
            } ${startAdornment ? 'pl-8' : ''} ${endAdornment ? 'pr-8' : ''} ${
              error ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 hover:border-slate-400'
            }`}
            {...inputProps}
            {...props}
          >
            {children}
          </select>
        ) : multiline ? (
          <textarea
            ref={targetRef}
            name={name}
            {...(value !== undefined && value !== null ? { value } : {})}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            rows={rows}
            className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-lg border transition-all duration-150 py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-[#1c2580] disabled:bg-slate-50 disabled:text-slate-500 ${
              startAdornment ? 'pl-8' : ''
            } ${endAdornment ? 'pr-8' : ''} ${
              error ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 hover:border-slate-400'
            }`}
            {...inputProps}
            {...props}
          />
        ) : (
          <input
            ref={targetRef}
            type={type}
            name={name}
            {...(value !== undefined && value !== null ? { value } : {})}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-lg border transition-all duration-150 py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-[#1c2580] disabled:bg-slate-50 disabled:text-slate-500 ${
              isSmall ? 'h-[38px] py-1.5 px-3 text-xs' : 'h-[42px] py-2.5 px-3.5 text-sm'
            } ${startAdornment ? 'pl-8' : ''} ${endAdornment ? 'pr-8' : ''} ${
              error ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 hover:border-slate-400'
            }`}
            {...inputProps}
            {...props}
          />
        )}

        {endAdornment && (
          <div className="absolute right-2.5 flex items-center text-slate-400">
            {endAdornment}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <p className={`text-xs mt-0.5 ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
});

export const InputBase = forwardRef(function InputBase(
  { placeholder, value, onChange, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  return (
    <input
      ref={ref}
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`bg-transparent focus:outline-none text-sm ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    />
  );
});

export const InputAdornment = ({ position = 'start', children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <span className={`inline-flex items-center text-slate-400 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </span>
  );
};

export const FormControl = ({ children, fullWidth = false, size = 'medium', className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const isFull = fullWidth && !parsedSx.width && !parsedSx.minWidth;
  return (
    <div className={`flex flex-col gap-1 ${isFull ? 'w-full' : ''} ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const InputLabel = ({ children, className = '', id, sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <label id={id} className={`text-sm font-semibold text-slate-700 select-none mb-0.5 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </label>
  );
};

export const Select = forwardRef(function Select(
  {
    children,
    value,
    onChange,
    name,
    label,
    startAdornment,
    size = 'medium',
    fullWidth = false,
    className = '',
    sx,
    style = {},
    ...props
  },
  ref
) {
  const parsedSx = parseSx(sx);
  const isFull = fullWidth && !parsedSx.width && !parsedSx.minWidth;
  return (
    <div className={`relative ${isFull ? 'w-full' : 'inline-block'}`} style={{ ...parsedSx, ...style }}>
      {startAdornment && (
        <div className="absolute left-2.5 top-3 pointer-events-none text-slate-400">
          {startAdornment}
        </div>
      )}
      <select
        ref={ref}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-[#1c2580] transition-all ${
          size === 'small' ? 'h-[38px] py-1.5 px-3 text-xs' : 'h-[42px] py-2.5 px-3.5 text-sm'
        } ${startAdornment ? 'pl-8' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});

const extractTextFromReactNode = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).filter(Boolean).join(' ').trim();
  }
  if (React.isValidElement(node)) {
    if (node.props && node.props.children) {
      return extractTextFromReactNode(node.props.children);
    }
    return '';
  }
  if (typeof node === 'object') {
    return String(node.label || node.name || node.title || '');
  }
  return '';
};

export const MenuItem = ({ value, children, ...props }) => {
  const textContent = extractTextFromReactNode(children);
  return (
    <option value={value} {...props}>
      {textContent || (typeof children === 'string' ? children : '')}
    </option>
  );
};

export const Autocomplete = forwardRef(function Autocomplete(
  {
    options = [],
    getOptionLabel = (o) => (typeof o === 'string' ? o : o.label || o.name || ''),
    value,
    onChange,
    renderInput,
    className = '',
    sx,
    style = {},
    ...props
  },
  ref
) {
  const parsedSx = parseSx(sx);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  const filtered = options.filter((opt) => {
    const lbl = getOptionLabel(opt).toLowerCase();
    return lbl.includes(query.toLowerCase());
  });

  return (
    <div ref={wrapperRef} className={`relative ${className}`} style={{ ...parsedSx, ...style }}>
      {renderInput({
        value: query || (value ? getOptionLabel(value) : ''),
        onChange: (e) => {
          setQuery(e.target.value);
          setOpen(true);
        },
        onFocus: () => setOpen(true),
      })}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto z-50 py-1">
          {filtered.slice(0, 20).map((opt, idx) => (
            <div
              key={idx}
              onClick={() => {
                onChange(null, opt);
                setQuery('');
                setOpen(false);
              }}
              className="px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
            >
              {getOptionLabel(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ==================== TABLES ====================
export const TableContainer = ({ children, component = 'div', className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const Table = ({ children, size = 'medium', stickyHeader = false, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <table className={`w-full text-left text-sm text-slate-700 border-collapse ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </table>
  );
};

export const TableHeadContext = React.createContext(false);

export const TableHead = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <TableHeadContext.Provider value={true}>
      <thead
        className={`bg-[#1c2580] text-white text-sm uppercase font-bold tracking-wider border-b border-indigo-950 ${className}`}
        style={{ backgroundColor: '#1c2580', color: '#ffffff', ...parsedSx, ...style }}
        {...props}
      >
        {children}
      </thead>
    </TableHeadContext.Provider>
  );
};

export const TableBody = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, hover = true, selected = false, onClick, className = '', sx, style = {}, ...props }) => {
  const isHeader = React.useContext(TableHeadContext);
  const parsedSx = parseSx(sx);
  
  if (isHeader) {
    return (
      <tr
        className={`bg-[#1c2580] text-white ${className}`}
        style={{ backgroundColor: '#1c2580', color: '#ffffff', ...parsedSx, ...style }}
        {...props}
      >
        {children}
      </tr>
    );
  }

  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${hover ? 'hover:bg-slate-50/80' : ''} ${
        selected ? 'bg-blue-50/80 font-semibold text-[#1c2580]' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, align = 'left', colSpan, className = '', sx, style = {}, ...props }) => {
  const isHeader = React.useContext(TableHeadContext);
  const parsedSx = parseSx(sx);
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (isHeader) {
    const headerSx = { ...parsedSx };
    // Ensure header text is always crisp visible white
    if (!headerSx.color || headerSx.color === 'black' || headerSx.color === '#000000' || headerSx.color === '#0f172a') {
      headerSx.color = '#ffffff';
    }
    return (
      <th
        scope="col"
        colSpan={colSpan}
        className={`px-4 py-3.5 text-sm font-bold tracking-wider text-white select-none ${alignClass} ${className}`}
        style={{ color: '#ffffff', ...headerSx, ...style }}
        {...props}
      >
        {children}
      </th>
    );
  }

  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-3.5 text-sm text-slate-800 font-medium ${alignClass} ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </td>
  );
};

// ==================== MODALS & DIALOGS ====================
export const Dialog = ({ open = false, onClose, maxWidth = 'sm', fullWidth, children, PaperProps, className = '', sx, style = {}, ...props }) => {
  if (!open) return null;
  const parsedSx = parseSx(sx);
  const widthClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-md',
    md: 'max-w-4xl',
    lg: 'max-w-5xl',
    xl: 'max-w-7xl',
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" style={{ zIndex: 9999 }} onClick={onClose} />
      <div
        role="dialog"
        className={`relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full z-[10000] my-auto flex flex-col max-h-[92vh] overflow-hidden ${
          widthClasses[maxWidth] || widthClasses.sm
        } ${className}`}
        style={{ ...parsedSx, ...style }}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogTitle = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const hasCustomBg = parsedSx.backgroundColor || style.backgroundColor;
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 font-bold ${hasCustomBg ? '' : 'text-slate-900'} text-base sm:text-lg ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const DialogContent = ({ children, dividers = false, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`p-5 overflow-y-auto text-sm sm:text-[15px] text-slate-700 ${dividers ? 'border-y border-slate-100' : ''} ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const DialogActions = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 border-t border-slate-100 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

// ==================== BADGES & CHIPS ====================
export const Chip = ({
  label,
  color = 'default',
  size = 'medium',
  variant = 'filled',
  onDelete,
  onClick,
  icon,
  className = '',
  sx,
  style = {},
  ...props
}) => {
  const parsedSx = parseSx(sx);
  const colorMap = {
    primary: 'bg-blue-50 text-[#1c2580] border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const isSmall = size === 'small';
  const hasCustomBg = parsedSx.backgroundColor || style.backgroundColor;

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors ${
        isSmall ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${hasCustomBg ? '' : colorMap[color] || colorMap.default} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 hover:text-slate-900 rounded-full"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};

export const Badge = ({ badgeContent, color = 'error', max = 99, children, className = '', sx, style = {}, ...props }) => {
  if (!badgeContent && badgeContent !== 0) return children || null;
  const parsedSx = parseSx(sx);
  const displayValue = Number(badgeContent) > max ? `${max}+` : badgeContent;
  return (
    <div className={`relative inline-flex ${className}`} style={{ ...parsedSx, ...style }}>
      {children}
      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
        {displayValue}
      </span>
    </div>
  );
};

export const Divider = ({ orientation = 'horizontal', flexItem = false, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  if (orientation === 'vertical') {
    return <div className={`w-[1px] bg-slate-200 self-stretch ${flexItem ? '' : 'h-full'} ${className}`} style={{ ...parsedSx, ...style }} {...props} />;
  }
  return <hr className={`border-0 h-[1px] bg-slate-200 my-2 w-full ${className}`} style={{ ...parsedSx, ...style }} {...props} />;
};

// ==================== ALERTS & TOASTS ====================
export const Alert = ({ severity = 'info', children, onClose, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div
      role="alert"
      className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
        styles[severity] || styles.info
      } ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="p-1 hover:opacity-75">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export const Snackbar = ({ open = false, message, children, onClose, sx, style = {}, ...props }) => {
  if (!open) return null;
  const parsedSx = parseSx(sx);
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-in fade-in-50 slide-in-from-bottom duration-200" style={{ ...parsedSx, ...style }}>
      {children || (
        <div className="bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center justify-between gap-3">
          <span>{message}</span>
          {onClose && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const Tooltip = ({ title, children, ...props }) => {
  if (!React.isValidElement(children)) return children;
  return React.cloneElement(children, { title: title || children.props.title });
};

// ==================== GRID & STACK ====================
const GRID_COL_SPANS = {
  xs: {
    1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
    5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
    9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
  },
  sm: {
    1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4',
    5: 'sm:col-span-5', 6: 'sm:col-span-6', 7: 'sm:col-span-7', 8: 'sm:col-span-8',
    9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
  },
  md: {
    1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
    5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
    9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
  },
  lg: {
    1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
    5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8',
    9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
  },
};

export const Grid = forwardRef(function Grid(
  { container = false, item = false, xs, sm, md, lg, spacing = 2, alignItems, justifyContent, alignSelf, children, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  if (container) {
    const gapMap = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6' };
    const containerStyle = { ...parsedSx, ...style };
    if (alignItems) containerStyle.alignItems = alignItems;
    if (justifyContent) containerStyle.justifyContent = justifyContent;
    return (
      <div ref={ref} className={`grid grid-cols-12 ${gapMap[spacing] || 'gap-3'} ${className}`} style={containerStyle} {...props}>
        {children}
      </div>
    );
  }

  const xsClass = xs ? (GRID_COL_SPANS.xs[xs] || 'col-span-12') : 'col-span-12';
  const smClass = sm ? (GRID_COL_SPANS.sm[sm] || '') : '';
  const mdClass = md ? (GRID_COL_SPANS.md[md] || '') : '';
  const lgClass = lg ? (GRID_COL_SPANS.lg[lg] || '') : '';
  const itemStyle = { ...parsedSx, ...style };
  if (alignSelf || alignItems) itemStyle.alignSelf = alignSelf || alignItems;

  return (
    <div ref={ref} className={`${xsClass} ${smClass} ${mdClass} ${lgClass} min-w-0 ${className}`} style={itemStyle} {...props}>
      {children}
    </div>
  );
});

export const Stack = ({ direction = 'column', spacing = 2, children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const isRow = direction === 'row';
  const gapMap = { 0.5: 'gap-1', 1: 'gap-2', 1.5: 'gap-3', 2: 'gap-4', 2.5: 'gap-5', 3: 'gap-6' };
  return (
    <div className={`flex ${isRow ? 'flex-row' : 'flex-col'} ${gapMap[spacing] || 'gap-3'} ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

// ==================== LISTS ====================
export const List = ({ children, dense = false, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`divide-y divide-slate-100 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const ListItem = ({ children, disablePadding, secondaryAction, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`py-2 px-3 flex items-center justify-between gap-2 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      <div className="flex items-center gap-3 min-w-0 flex-1">{children}</div>
      {secondaryAction && <div className="flex-shrink-0">{secondaryAction}</div>}
    </div>
  );
};

export const ListItemButton = ({ children, selected = false, onClick, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-2 px-3 rounded-lg flex items-center gap-3 transition-colors text-left ${
        selected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
      } ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </button>
  );
};

export const ListItemIcon = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <span className={`text-slate-400 flex-shrink-0 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </span>
  );
};

export const ListItemText = ({ primary, secondary, slotProps, sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className="min-w-0 flex-1" style={{ ...parsedSx, ...style }}>
      {primary && <div className="text-sm font-semibold text-slate-800 truncate">{primary}</div>}
      {secondary && <div className="text-xs text-slate-500 truncate mt-0.5">{secondary}</div>}
    </div>
  );
};

// ==================== SWITCH & CONTROLS ====================
export const Switch = forwardRef(function Switch(
  { checked = false, onChange, disabled = false, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${disabled ? 'opacity-50' : ''} ${className}`} style={{ ...parsedSx, ...style }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e, e.target.checked)}
        className="sr-only peer"
        {...props}
      />
      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1c2580]"></div>
    </label>
  );
});

export const Checkbox = forwardRef(function Checkbox(
  { checked = false, onChange, disabled = false, color, className = '', sx, style = {}, ...props },
  ref
) {
  const parsedSx = parseSx(sx);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={`w-4 h-4 rounded text-[#1c2580] border-slate-300 focus:ring-blue-600 cursor-pointer ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    />
  );
});

export const FormControlLabel = ({ control, label, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {control}
      <span>{label}</span>
    </label>
  );
};

export const ToggleButtonGroup = ({ value, exclusive = true, onChange, children, size = 'small', className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const isSelected = value === child.props.value;
        return React.cloneElement(child, {
          selected: isSelected,
          onClick: (e) => onChange && onChange(e, child.props.value),
        });
      })}
    </div>
  );
};

export const ToggleButton = ({ selected = false, value, onClick, children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const selectedStyle = selected ? { backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#1c2580', fontWeight: 700 } : {};
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
        selected ? 'shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
      } ${className}`}
      style={{ ...selectedStyle, ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </button>
  );
};

export const Slider = ({ value = 0, onChange, min = 0, max = 100, step = 1, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange && onChange(e, Number(e.target.value))}
      className={`w-full accent-[#1c2580] ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    />
  );
};

// ==================== DRAWER & TRANSITIONS ====================
export const Drawer = ({ open = false, onClose, anchor = 'left', children, PaperProps, ...props }) => {
  if (!open) return null;
  const isRight = anchor === 'right';
  const isBottom = anchor === 'bottom';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div
        className={`relative bg-white shadow-2xl z-10 overflow-y-auto ${
          isBottom
            ? 'w-full max-h-[80vh] rounded-t-2xl self-end'
            : isRight
            ? 'w-80 max-w-[85vw] h-full ml-auto'
            : 'w-80 max-w-[85vw] h-full mr-auto'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
export const SwipeableDrawer = Drawer;

export const Collapse = ({ in: inProp = true, children }) => (inProp ? <div>{children}</div> : null);
export const Fade = ({ in: inProp = true, children }) => (inProp ? <div>{children}</div> : null);
export const Zoom = ({ in: inProp = true, children }) => (inProp ? <div>{children}</div> : null);

// ==================== SKELETON & PROGRESS ====================
export const Skeleton = ({ variant = 'text', width, height, className = '', ...props }) => (
  <div
    style={{ width, height }}
    className={`animate-pulse bg-slate-200/80 ${variant === 'circular' ? 'rounded-full' : 'rounded-md'} ${className}`}
    {...props}
  />
);

export const CircularProgress = ({ size = 20, className = '', ...props }) => (
  <svg
    className={`animate-spin text-current inline-block ${className}`}
    style={{ width: size, height: size }}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const LinearProgress = ({ value, variant = 'indeterminate', className = '', ...props }) => (
  <div className={`w-full bg-slate-100 rounded-full h-1.5 overflow-hidden ${className}`} {...props}>
    <div
      className={`bg-[#1c2580] h-full rounded-full ${variant === 'indeterminate' ? 'animate-pulse w-1/2' : ''}`}
      style={variant === 'determinate' ? { width: `${value || 0}%` } : undefined}
    />
  </div>
);

// ==================== MENUS ====================
export const Menu = ({ open = false, onClose, anchorEl, children, className = '', slotProps, ...props }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[180px] ${className}`}
        style={
          anchorEl
            ? {
                top: anchorEl.getBoundingClientRect().bottom + window.scrollY,
                left: Math.max(10, anchorEl.getBoundingClientRect().left),
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};

// ==================== TABS ====================
export const Tabs = ({
  value = 0,
  onChange,
  children,
  className = '',
  sx,
  scrollButtons,
  allowScrollButtonsMobile,
  indicatorColor,
  textColor,
  variant,
  orientation,
  visibleScrollbar,
  TabIndicatorProps,
  ...props
}) => (
  <div className={`flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none ${className}`} {...props}>
    {React.Children.map(children, (child, idx) => {
      if (!React.isValidElement(child)) return child;
      const isSelected = value === idx || value === child.props.value;
      return React.cloneElement(child, {
        selected: isSelected,
        onClick: (e) => onChange && onChange(e, child.props.value !== undefined ? child.props.value : idx),
      });
    })}
  </div>
);

export const Tab = ({
  label,
  icon,
  iconPosition = 'start',
  selected = false,
  onClick,
  className = '',
  sx,
  wrapped,
  disableRipple,
  disableFocusRipple,
  ...props
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all select-none whitespace-nowrap ${
      selected
        ? 'border-[#1c2580] text-[#1c2580] font-bold'
        : 'border-transparent text-slate-500 hover:text-slate-800'
    } ${className}`}
    {...props}
  >
    {icon}
    {label && <span>{label}</span>}
  </button>
);

// ==================== DATE PICKER ====================
export const DatePicker = ({ label, value, onChange, slotProps, ...props }) => {
  const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : value || '';
  return (
    <TextField
      label={label}
      type="date"
      value={dateValue}
      onChange={(e) => onChange && onChange(e.target.value ? new Date(e.target.value) : null)}
      slotProps={slotProps}
      {...props}
    />
  );
};

export const LocalizationProvider = ({ children }) => <>{children}</>;
export const AdapterDateFns = class {};

// ==================== REMAINING SHELL HELPERS ====================
export const AppBar = ({ children, className = '', ...props }) => (
  <header className={`w-full z-40 ${className}`} {...props}>
    {children}
  </header>
);
export const Toolbar = ({ children, className = '', ...props }) => (
  <div className={`flex items-center px-4 min-h-[56px] ${className}`} {...props}>
    {children}
  </div>
);
export const Avatar = ({ children, src, alt = '', variant = 'circular', className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  const isRounded = variant === 'rounded';
  const isSquare = variant === 'square';
  const radiusClass = isSquare ? 'rounded-none' : isRounded ? 'rounded-xl' : 'rounded-full';
  
  if (src) {
    return (
      <div 
        className={`overflow-hidden flex items-center justify-center flex-shrink-0 ${radiusClass} ${className}`}
        style={{ width: 36, height: 36, ...parsedSx, ...style }}
        {...props}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div 
      className={`w-9 h-9 ${radiusClass} bg-[#1c2580] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 ${className}`} 
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
export const SpeedDial = ({ children, ...props }) => <div {...props}>{children}</div>;
export const SpeedDialAction = ({ ...props }) => null;
export const BottomNavigation = ({ children, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <div className={`flex items-center justify-around w-full h-14 bg-white border-t border-slate-200 ${className}`} style={{ ...parsedSx, ...style }} {...props}>
      {children}
    </div>
  );
};

export const BottomNavigationAction = ({ label, icon, onClick, showLabel = true, className = '', sx, style = {}, ...props }) => {
  const parsedSx = parseSx(sx);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 py-1 text-slate-600 hover:text-emerald-600 transition-colors focus:outline-none ${className}`}
      style={{ ...parsedSx, ...style }}
      {...props}
    >
      <div className="text-current flex items-center justify-center">{icon}</div>
      {showLabel && label && <span className="text-[11px] font-medium mt-0.5">{label}</span>}
    </button>
  );
};
export const Pagination = ({ count = 1, page = 1, onChange, ...props }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: count }, (_, i) => i + 1).map((p) => (
      <button
        key={p}
        type="button"
        onClick={(e) => onChange && onChange(e, p)}
        className={`w-7 h-7 rounded-lg text-xs font-semibold ${
          page === p ? 'bg-[#1c2580] text-white' : 'bg-white border border-slate-200 text-slate-700'
        }`}
      >
        {p}
      </button>
    ))}
  </div>
);

export const Accordion = ({ children, className = '', sx, ...props }) => (
  <div className={`rounded-xl border border-slate-200/80 overflow-hidden mb-2 bg-white ${className}`} {...props}>
    {children}
  </div>
);

export const AccordionSummary = ({ children, expandIcon, className = '', sx, ...props }) => (
  <div className={`p-3.5 bg-slate-50 flex items-center justify-between cursor-pointer font-semibold text-xs text-slate-800 ${className}`} {...props}>
    <div>{children}</div>
    {expandIcon && <div>{expandIcon}</div>}
  </div>
);

export const AccordionDetails = ({ children, className = '', sx, ...props }) => (
  <div className={`p-4 text-xs text-slate-700 ${className}`} {...props}>
    {children}
  </div>
);

export const CardActionArea = ({ children, onClick, className = '', sx, ...props }) => (
  <div onClick={onClick} className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${className}`} {...props}>
    {children}
  </div>
);

export const TablePagination = ({ count = 0, page = 0, rowsPerPage = 10, onPageChange, onRowsPerPageChange, rowsPerPageOptions = [5, 10, 25], className = '', ...props }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 border-t border-slate-200 text-xs text-slate-600 bg-slate-50/60 ${className}`} {...props}>
    <span>Total {count} items</span>
    <div className="flex items-center gap-2">
      <span>Page {page + 1}</span>
      <button
        type="button"
        disabled={page === 0}
        onClick={(e) => onPageChange && onPageChange(e, page - 1)}
        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-xs disabled:opacity-40"
      >
        Prev
      </button>
      <button
        type="button"
        disabled={(page + 1) * rowsPerPage >= count}
        onClick={(e) => onPageChange && onPageChange(e, page + 1)}
        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-xs disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </div>
);

export const Backdrop = ({ open = false, children, onClick, className = '', ...props }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClick}
      className={`fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const Popover = ({ open = false, anchorEl, onClose, children, className = '', ...props }) => {
  if (!open) return null;
  return (
    <div className={`absolute z-50 bg-white shadow-xl rounded-xl border border-slate-200 p-2 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const ListSubheader = ({ children, className = '', ...props }) => (
  <div className={`px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 ${className}`} {...props}>
    {children}
  </div>
);

export const FormGroup = ({ children, className = '', row = false, ...props }) => (
  <div className={`flex ${row ? 'flex-row flex-wrap gap-4' : 'flex-col gap-2'} ${className}`} {...props}>
    {children}
  </div>
);

export const CardActions = ({ children, className = '', ...props }) => (
  <div className={`p-4 pt-0 flex items-center gap-2 ${className}`} {...props}>
    {children}
  </div>
);

export const Popper = Popover;


