import React from 'react';

export function Table({ children, className = '', containerClassName = '', ...props }) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white ${containerClassName}`}>
      <table className={`w-full text-left text-sm text-slate-700 border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={`bg-[#1c2580] text-white text-sm uppercase font-bold tracking-wider border-b border-indigo-950 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return <tbody className={`divide-y divide-slate-100 ${className}`} {...props}>{children}</tbody>;
}

export function TableFooter({ children, className = '', ...props }) {
  return (
    <tfoot className={`bg-slate-50 font-medium text-slate-700 border-t border-slate-200 ${className}`} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({ children, className = '', hover = true, ...props }) {
  return (
    <tr
      className={`transition-colors ${hover ? 'hover:bg-slate-50/80' : ''} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', align = 'left', ...props }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th scope="col" className={`px-4 py-3.5 text-sm font-bold tracking-wider text-white select-none ${alignClass} ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', align = 'left', colSpan, ...props }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td colSpan={colSpan} className={`px-4 py-3.5 text-sm text-slate-800 font-medium ${alignClass} ${className}`} {...props}>
      {children}
    </td>
  );
}

export default Table;
