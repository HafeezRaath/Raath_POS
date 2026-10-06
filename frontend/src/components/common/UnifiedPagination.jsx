import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * UnifiedPagination
 * Standard pagination component used across all tables in Raath POS.
 * Built with Tailwind CSS and Lucide icons (pure React, no external MUI dependency).
 * Consistent layout:
 * - Left: "Showing X - Y of Z" + optional Rows per page dropdown
 * - Right: Brand navy (#1c2580) selected state, rounded pills, first/prev/next/last buttons
 */
export default function UnifiedPagination({
  count = 0,
  page = 1,
  rowsPerPage = 10,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50, 100],
  isZeroBased = false,
  sx = {},
}) {
  const safeCount = Math.max(0, Number(count) || 0);
  const safeRowsPerPage = Math.max(1, Number(rowsPerPage) || 10);
  const totalPages = Math.max(1, Math.ceil(safeCount / safeRowsPerPage));

  // Current 1-based page
  const displayPage = isZeroBased ? (Number(page) || 0) + 1 : Number(page) || 1;
  const clampedPage = Math.min(Math.max(1, displayPage), totalPages);

  const from = safeCount === 0 ? 0 : (clampedPage - 1) * safeRowsPerPage + 1;
  const to = Math.min(clampedPage * safeRowsPerPage, safeCount);

  const handlePageChange = (event, newPage) => {
    if (!onPageChange) return;
    if (newPage < 1 || newPage > totalPages) return;
    if (isZeroBased) {
      onPageChange(event, newPage - 1);
    } else {
      onPageChange(newPage);
    }
  };

  const handleRowsChange = (event) => {
    if (!onRowsPerPageChange) return;
    const val = Number(event.target.value);
    onRowsPerPageChange(val);
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);

    if (clampedPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, clampedPage - 1);
    const end = Math.min(totalPages - 1, clampedPage + 1);

    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    if (clampedPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      style={sx}
      className="py-3 px-4 flex justify-between items-center flex-wrap gap-3 bg-white border-t border-slate-200 rounded-b-lg text-sm select-none"
    >
      {/* Left side: Showing X-Y of Z + Rows Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-slate-600 font-medium text-xs sm:text-sm">
          {safeCount === 0 ? 'No records to display' : `Showing ${from} - ${to} of ${safeCount}`}
        </span>

        {onRowsPerPageChange && rowsPerPageOptions && rowsPerPageOptions.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Rows:</span>
            <select
              value={rowsPerPage}
              onChange={handleRowsChange}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 cursor-pointer"
            >
              {rowsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Pagination buttons */}
      <div className="flex items-center gap-1">
        {/* First Button */}
        <button
          type="button"
          disabled={clampedPage <= 1}
          onClick={(e) => handlePageChange(e, 1)}
          className="p-1 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev Button */}
        <button
          type="button"
          disabled={clampedPage <= 1}
          onClick={(e) => handlePageChange(e, clampedPage - 1)}
          className="p-1 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page items */}
        {getPageNumbers().map((item, index) => {
          if (item === '...') {
            return (
              <span key={`dots-${index}`} className="px-1.5 text-xs text-slate-400 font-semibold select-none">
                …
              </span>
            );
          }
          const isActive = item === clampedPage;
          return (
            <button
              key={item}
              type="button"
              onClick={(e) => handlePageChange(e, item)}
              className={`min-w-[28px] h-7 px-1.5 text-xs font-semibold rounded-md transition-colors ${
                isActive
                  ? 'bg-[#1c2580] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-[#e8eaf6] hover:text-[#1c2580]'
              }`}
            >
              {item}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          disabled={clampedPage >= totalPages}
          onClick={(e) => handlePageChange(e, clampedPage + 1)}
          className="p-1 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Button */}
        <button
          type="button"
          disabled={clampedPage >= totalPages}
          onClick={(e) => handlePageChange(e, totalPages)}
          className="p-1 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
