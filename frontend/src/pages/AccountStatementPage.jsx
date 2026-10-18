import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Grid, Chip, MenuItem,
  FormControl, InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Tooltip, Snackbar, Alert, LinearProgress, TablePagination,
  useTheme, useMediaQuery
} from '../components/ui/tailwind-mui';
import {
  Search, Visibility, Print, Refresh, AccountBalance, TrendingUp,
  ArrowBack, Download, History, PictureAsPdf
} from '../components/ui/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../database/db';

// ==================== CURRENCY & DATE FORMATTERS ====================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const getToday = () => new Date().toISOString().split('T')[0];

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const getAccountTypeLabel = (type) => {
  const map = {
    cash: 'Cash in Hand',
    bank: 'Bank Account',
    easypaisa: 'EasyPaisa',
    jazzcash: 'JazzCash',
    cheque: 'Cheque',
    other: 'Other'
  };
  return map[type] || type;
};

export default function AccountStatementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Primary State
  const [activeTab, setActiveTab] = useState(0); // 0: Single Account Statement, 1: All Accounts Daily Summary
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(id || '');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Tab 0 State
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [quickFilter, setQuickFilter] = useState('today');
  const [statementData, setStatementData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Tab 1 State
  const [summaryDate, setSummaryDate] = useState(getToday());
  const [dailySummary, setDailySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Safe Load Accounts List
  const loadAccounts = useCallback(async () => {
    try {
      let accList = [];
      if (typeof db.getAccounts === 'function') {
        accList = await db.getAccounts();
      } else if (typeof db.getAllAccounts === 'function') {
        accList = await db.getAllAccounts();
      }
      const validAccounts = (accList || []).filter(a => !a.is_deleted);
      setAccounts(validAccounts);

      if (id && validAccounts.some(a => String(a.id) === String(id))) {
        setSelectedAccountId(id);
      } else if (validAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(validAccounts[0].id);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load accounts: ' + err.message, severity: 'error' });
    }
  }, [id, selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Sync selectedAccountId with URL param
  useEffect(() => {
    if (id && String(id) !== String(selectedAccountId)) {
      setSelectedAccountId(id);
    }
  }, [id, selectedAccountId]);

  // Load Statement Data
  const loadStatement = useCallback(async (accId, from, to) => {
    if (!accId) return;
    setLoading(true);
    try {
      const data = await db.getAccountStatement(accId, from, to);
      setStatementData(data);
      setPage(0);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error loading statement: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountId && activeTab === 0) {
      loadStatement(selectedAccountId, startDate, endDate);
    }
  }, [selectedAccountId, startDate, endDate, activeTab, loadStatement]);

  // Load All Accounts Daily Summary
  const loadDailySummary = useCallback(async (date) => {
    setSummaryLoading(true);
    try {
      const res = await db.getDailyAccountsSummary(date);
      setDailySummary(res);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error loading daily summary: ' + err.message, severity: 'error' });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      loadDailySummary(summaryDate);
    }
  }, [summaryDate, activeTab, loadDailySummary]);

  // Quick Date Preset Handler
  const handleQuickFilter = (preset) => {
    setQuickFilter(preset);
    let from = getToday();
    let to = getToday();

    if (preset === 'today') {
      from = getToday();
      to = getToday();
    } else if (preset === 'yesterday') {
      from = getYesterday();
      to = getYesterday();
    } else if (preset === 'week') {
      from = getStartOfWeek();
      to = getToday();
    } else if (preset === 'month') {
      from = getStartOfMonth();
      to = getToday();
    }
    setStartDate(from);
    setEndDate(to);
  };

  const currentAccount = useMemo(() => {
    return accounts.find(a => String(a.id) === String(selectedAccountId)) || null;
  }, [accounts, selectedAccountId]);

  // Filtered Statement Transactions
  const filteredTransactions = useMemo(() => {
    if (!statementData || !statementData.transactions) return [];
    let list = statementData.transactions;

    if (typeFilter !== 'all') {
      list = list.filter(t => (t.transaction_type || t.type) === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        String(t.id).includes(q) ||
        (t.reference_no && t.reference_no.toLowerCase().includes(q)) ||
        (t.reference_type && t.reference_type.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      );
    }

    return list;
  }, [statementData, typeFilter, searchQuery]);

  // Pagination for Transactions
  const paginatedTransactions = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredTransactions.slice(start, start + rowsPerPage);
  }, [filteredTransactions, page, rowsPerPage]);

  // ==================== BULLETPROOF CSV BLOB DOWNLOADER ====================
  // Uses Blob + URL.createObjectURL to prevent data URI truncation by '#' characters
  const downloadCSV = (filename, rows) => {
    const escapeCell = (v) => {
      if (v === null || v === undefined) return '""';
      const s = String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const csvLines = rows.map(r => r.map(escapeCell).join(','));
    const csvContent = '\ufeff' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ==================== CSV EXPORT (EXACT TABLE ROWS & END PAR TOTAL) ====================
  const handleExportCSV = () => {
    if (!statementData) {
      setSnackbar({ open: true, message: 'No data to export', severity: 'warning' });
      return;
    }

    const headers = ['#', 'TXN ID', 'Date & Time', 'Type / Reference', 'Description', 'In (Credit)', 'Out (Debit)', 'Running Balance'];

    // 1. Opening Row (matching table opening row)
    const openingRow = [
      '-',
      'OPENING',
      startDate,
      '-',
      `Opening Balance as of ${startDate}`,
      '-',
      '-',
      Number(statementData.opening_balance || 0).toFixed(2)
    ];

    // 2. Exact Table Rows (matching active table filter/search)
    const transactionRows = filteredTransactions.map((tx, idx) => {
      const isCredit = (tx.transaction_type || tx.type) === 'credit';
      const inAmt = isCredit ? Number(tx.amount || 0).toFixed(2) : '-';
      const outAmt = !isCredit ? Number(tx.amount || 0).toFixed(2) : '-';
      const bal = Number(tx.running_balance !== undefined ? tx.running_balance : tx.balance_after || 0).toFixed(2);
      const refText = `${tx.reference_type || tx.raw_type || ''}${tx.reference_no ? ' (' + tx.reference_no + ')' : ''}`;

      return [
        idx + 1,
        `#${tx.id}`,
        formatDate(tx.date || tx.created_at),
        refText || '-',
        tx.description || '-',
        inAmt,
        outAmt,
        bal
      ];
    });

    // 3. Closing Totals Row (End Par Total)
    const filteredCredits = filteredTransactions
      .filter(t => (t.transaction_type || t.type) === 'credit')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const filteredDebits = filteredTransactions
      .filter(t => (t.transaction_type || t.type) === 'debit')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const totalRow = [
      '-',
      'TOTAL',
      endDate,
      '-',
      `Total Transactions (${filteredTransactions.length}) & Closing Balance`,
      filteredCredits.toFixed(2),
      filteredDebits.toFixed(2),
      Number(statementData.closing_balance || 0).toFixed(2)
    ];

    // Only table rows + end total row
    const allRows = [
      headers,
      openingRow,
      ...transactionRows,
      totalRow
    ];

    const safeName = (currentAccount?.name || 'Account').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCSV(`Statement_${safeName}_${startDate}_to_${endDate}.csv`, allRows);
    setSnackbar({ open: true, message: 'CSV exported successfully with end totals!', severity: 'success' });
  };

  // Export Daily Summary to CSV (with End Totals)
  const handleExportDailyCSV = () => {
    if (!dailySummary || !dailySummary.accounts || !dailySummary.accounts.length) {
      setSnackbar({ open: true, message: 'No summary data to export', severity: 'warning' });
      return;
    }

    const headers = ['Account Name', 'Type', 'Opening Balance', 'Today In (+)', 'Today Out (-)', 'Net Change', 'Closing Balance'];
    const rows = dailySummary.accounts.map(acc => [
      acc.name,
      getAccountTypeLabel(acc.type),
      Number(acc.opening_balance || 0).toFixed(2),
      Number(acc.today_credits || 0).toFixed(2),
      Number(acc.today_debits || 0).toFixed(2),
      Number(acc.net_change || 0).toFixed(2),
      Number(acc.closing_balance || 0).toFixed(2)
    ]);

    // End par total row
    const totalsRow = [
      'TOTAL ACROSS ALL ACCOUNTS',
      'ALL',
      Number(dailySummary.totals?.total_opening || 0).toFixed(2),
      Number(dailySummary.totals?.total_credits || 0).toFixed(2),
      Number(dailySummary.totals?.total_debits || 0).toFixed(2),
      Number(dailySummary.totals?.net_change || 0).toFixed(2),
      Number(dailySummary.totals?.total_closing || 0).toFixed(2)
    ];

    const allRows = [headers, ...rows, totalsRow];
    downloadCSV(`Daily_Accounts_Summary_${summaryDate}.csv`, allRows);
    setSnackbar({ open: true, message: 'Daily summary CSV exported with totals!', severity: 'success' });
  };

  // ==================== TRUE VECTOR PDF EXPORT (ORIGINAL PDF FILE) ====================
  const handleExportPDF = () => {
    if (!statementData) {
      setSnackbar({ open: true, message: 'No statement data to export', severity: 'warning' });
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');

      // 1. Top Navy Header Banner (#1c2580)
      doc.setFillColor(28, 37, 128);
      doc.rect(0, 0, pageWidth, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shop.name || 'RAATH POS', 14, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(
        shop.phone || shop.address
          ? `${shop.phone || ''} ${shop.address ? ' | ' + shop.address : ''}`
          : 'ACCOUNT STATEMENT & TRANSACTION LEDGER',
        14,
        18
      );

      // 2. Document Title & Account Info
      doc.setTextColor(28, 37, 128);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`ACCOUNT STATEMENT: ${currentAccount?.name || 'Account'}`, 14, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Account Type: ${getAccountTypeLabel(currentAccount?.type)} | Statement Period: ${startDate} to ${endDate}`, 14, 39);
      doc.text(`Generated On: ${new Date().toLocaleString('en-GB')}`, 14, 44);

      // 3. Compact KPI Summary Box (Rounded)
      const kpiY = 48;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, kpiY, pageWidth - 28, 14, 2, 2, 'FD');

      const colW = (pageWidth - 28) / 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('OPENING BALANCE', 14 + 3, kpiY + 4.5);
      doc.text('TOTAL IN (CR)', 14 + colW + 3, kpiY + 4.5);
      doc.text('TOTAL OUT (DR)', 14 + colW * 2 + 3, kpiY + 4.5);
      doc.text('NET CHANGE', 14 + colW * 3 + 3, kpiY + 4.5);
      doc.text('CLOSING BALANCE', 14 + colW * 4 + 3, kpiY + 4.5);

      doc.setFontSize(8.5);
      doc.setTextColor(28, 37, 128);
      doc.text(`Rs. ${Number(statementData.opening_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + 3, kpiY + 10.5);

      doc.setTextColor(5, 150, 105);
      doc.text(`+Rs. ${Number(statementData.total_credits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW + 3, kpiY + 10.5);

      doc.setTextColor(220, 38, 38);
      doc.text(`-Rs. ${Number(statementData.total_debits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW * 2 + 3, kpiY + 10.5);

      if (statementData.net_change >= 0) {
        doc.setTextColor(2, 132, 199);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(`${statementData.net_change >= 0 ? '+' : ''}Rs. ${Number(statementData.net_change || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW * 3 + 3, kpiY + 10.5);

      doc.setTextColor(28, 37, 128);
      doc.text(`Rs. ${Number(statementData.closing_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW * 4 + 3, kpiY + 10.5);

      // 4. Vector Table with autoTable
      const tableHeaders = [['#', 'TXN ID', 'Date & Time', 'Type / Ref', 'Description', 'In (CR)', 'Out (DR)', 'Balance']];

      const pdfFilteredCredits = filteredTransactions
        .filter(t => (t.transaction_type || t.type) === 'credit')
        .reduce((s, t) => s + Number(t.amount || 0), 0);

      const pdfFilteredDebits = filteredTransactions
        .filter(t => (t.transaction_type || t.type) === 'debit')
        .reduce((s, t) => s + Number(t.amount || 0), 0);

      const tableRows = [
        // Opening balance row
        [
          '-',
          'OPENING',
          startDate,
          '-',
          `Opening Balance as of ${startDate}`,
          '-',
          '-',
          `Rs. ${Number(statementData.opening_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
        ],
        // Transaction rows
        ...filteredTransactions.map((tx, idx) => {
          const isCredit = (tx.transaction_type || tx.type) === 'credit';
          const inAmt = isCredit ? `+Rs. ${Number(tx.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '-';
          const outAmt = !isCredit ? `-Rs. ${Number(tx.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '-';
          const balAmt = `Rs. ${Number(tx.running_balance !== undefined ? tx.running_balance : tx.balance_after || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
          const refText = `${tx.reference_type || tx.raw_type || ''}${tx.reference_no ? ' (' + tx.reference_no + ')' : ''}`;

          return [
            idx + 1,
            `#${tx.id}`,
            formatDate(tx.date || tx.created_at),
            refText || '-',
            tx.description || '-',
            inAmt,
            outAmt,
            balAmt
          ];
        }),
        // Closing totals row (End par total)
        [
          '-',
          'TOTAL',
          endDate,
          '-',
          `Total Transactions (${filteredTransactions.length}) & Closing Balance`,
          `+Rs. ${Number(pdfFilteredCredits).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `-Rs. ${Number(pdfFilteredDebits).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `Rs. ${Number(statementData.closing_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
        ]
      ];

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: kpiY + 18,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
        headStyles: { fillColor: [28, 37, 128], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 26 },
          3: { cellWidth: 26 },
          4: { cellWidth: 46 },
          5: { cellWidth: 20, halign: 'right', textColor: [5, 150, 105] },
          6: { cellWidth: 20, halign: 'right', textColor: [220, 38, 38] },
          7: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [28, 37, 128] }
        },
        didParseCell: function (data) {
          if (data.row.index === 0) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [28, 37, 128];
          }
        },
        margin: { left: 14, right: 14, bottom: 16 }
      });

      // 5. Page Numbering Footer on every page
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages}  |  Raath POS  |  Confidential Financial Statement`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      doc.save(`Statement_${(currentAccount?.name || 'Account').replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
      setSnackbar({ open: true, message: 'Original PDF file generated and saved!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate PDF: ' + err.message, severity: 'error' });
    }
  };

  // Original PDF for Daily Summary
  const handleExportDailyPDF = () => {
    if (!dailySummary || !dailySummary.accounts || !dailySummary.accounts.length) {
      setSnackbar({ open: true, message: 'No summary data to export', severity: 'warning' });
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');

      // Header Banner
      doc.setFillColor(28, 37, 128);
      doc.rect(0, 0, pageWidth, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shop.name || 'RAATH POS', 14, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(
        shop.phone || shop.address
          ? `${shop.phone || ''} ${shop.address ? ' | ' + shop.address : ''}`
          : 'DAILY ACCOUNTS OPENING & CLOSING AUDIT',
        14,
        18
      );

      // Title & Info
      doc.setTextColor(28, 37, 128);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('DAILY ACCOUNTS OPENING & CLOSING SUMMARY', 14, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Audit Date: ${summaryDate} | Generated On: ${new Date().toLocaleString('en-GB')}`, 14, 40);

      // Summary Box
      const kpiY = 46;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, kpiY, pageWidth - 28, 14, 2, 2, 'FD');

      const colW = (pageWidth - 28) / 4;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL OPENING', 14 + 3, kpiY + 4.5);
      doc.text("TODAY'S INFLOW", 14 + colW + 3, kpiY + 4.5);
      doc.text("TODAY'S OUTFLOW", 14 + colW * 2 + 3, kpiY + 4.5);
      doc.text('TOTAL CLOSING', 14 + colW * 3 + 3, kpiY + 4.5);

      doc.setFontSize(8.5);
      doc.setTextColor(28, 37, 128);
      doc.text(`Rs. ${Number(dailySummary.totals?.total_opening || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + 3, kpiY + 10.5);

      doc.setTextColor(5, 150, 105);
      doc.text(`+Rs. ${Number(dailySummary.totals?.total_credits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW + 3, kpiY + 10.5);

      doc.setTextColor(220, 38, 38);
      doc.text(`-Rs. ${Number(dailySummary.totals?.total_debits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW * 2 + 3, kpiY + 10.5);

      doc.setTextColor(28, 37, 128);
      doc.text(`Rs. ${Number(dailySummary.totals?.total_closing || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 14 + colW * 3 + 3, kpiY + 10.5);

      // Table
      const tableHeaders = [['Account Name', 'Type', 'Opening Balance', 'Today In (+)', 'Today Out (-)', 'Net Change', 'Closing Balance']];
      const tableRows = [
        ...dailySummary.accounts.map(acc => [
          acc.name,
          getAccountTypeLabel(acc.type),
          `Rs. ${Number(acc.opening_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          acc.today_credits > 0 ? `+Rs. ${Number(acc.today_credits).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '-',
          acc.today_debits > 0 ? `-Rs. ${Number(acc.today_debits).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '-',
          `${acc.net_change >= 0 ? '+' : ''}Rs. ${Number(acc.net_change || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `Rs. ${Number(acc.closing_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
        ]),
        // Totals row (End par total)
        [
          'TOTAL ACROSS ALL ACCOUNTS',
          'ALL',
          `Rs. ${Number(dailySummary.totals?.total_opening || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `+Rs. ${Number(dailySummary.totals?.total_credits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `-Rs. ${Number(dailySummary.totals?.total_debits || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `${dailySummary.totals?.net_change >= 0 ? '+' : ''}Rs. ${Number(dailySummary.totals?.net_change || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
          `Rs. ${Number(dailySummary.totals?.total_closing || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
        ]
      ];

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: kpiY + 18,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
        headStyles: { fillColor: [28, 37, 128], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold' },
          1: { cellWidth: 24 },
          2: { cellWidth: 24, halign: 'right' },
          3: { cellWidth: 24, halign: 'right', textColor: [5, 150, 105] },
          4: { cellWidth: 24, halign: 'right', textColor: [220, 38, 38] },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [28, 37, 128] }
        },
        didParseCell: function (data) {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [28, 37, 128];
          }
        },
        margin: { left: 14, right: 14, bottom: 16 }
      });

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages}  |  Raath POS  |  Confidential Financial Document`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      doc.save(`Daily_Accounts_Summary_${summaryDate}.pdf`);
      setSnackbar({ open: true, message: 'Daily summary PDF generated and saved!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate PDF: ' + err.message, severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2, maxWidth: 1600, mx: 'auto' }}>
      {/* ==================== PAGE HEADER ==================== */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <IconButton onClick={() => navigate('/accounts')} size="small" sx={{ mr: 1, bgcolor: '#f1f5f9' }}>
            <ArrowBack fontSize="small" />
          </IconButton>
          Account Statement & Ledger
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {currentAccount && (
            <Chip
              label={`Current Balance: ${formatCurrency(currentAccount.current_balance)}`}
              sx={{ bgcolor: '#f1f5f9', color: '#1c2580', fontWeight: 'bold', fontSize: '0.85rem' }}
            />
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<Refresh />}
            onClick={() => {
              if (activeTab === 0) loadStatement(selectedAccountId, startDate, endDate);
              else loadDailySummary(summaryDate);
            }}
            sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151c60' } }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* ==================== TOP STATS CARDS (EXACT MATCHING DESIGN) ==================== */}
      {statementData && activeTab === 0 && (
        <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
          {[
            {
              title: "Opening Balance",
              value: statementData.opening_balance,
              label: "Start of Period"
            },
            {
              title: "Period Total In",
              value: statementData.total_credits,
              label: `${statementData.transactions.filter(t => (t.transaction_type || t.type) === 'credit').length} incoming bills`
            },
            {
              title: "Period Total Out",
              value: statementData.total_debits,
              label: `${statementData.transactions.filter(t => (t.transaction_type || t.type) === 'debit').length} payments & refunds`
            },
            {
              title: "Net Change",
              value: statementData.net_change,
              label: "Inflow vs Outflow"
            },
            {
              title: "Closing Balance",
              value: statementData.closing_balance,
              label: "End of Period"
            }
          ].map((stat, idx) => (
            <Grid item xs={6} sm={4} md={2.4} key={idx}>
              <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                  <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                    {stat.title}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                    {formatCurrency(stat.value)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* STAT CARDS FOR TAB 1 (ALL ACCOUNTS DAILY SUMMARY) */}
      {dailySummary && dailySummary.totals && activeTab === 1 && (
        <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
          {[
            {
              title: "Total Opening",
              value: dailySummary.totals.total_opening,
              label: "All accounts at open"
            },
            {
              title: "Today's Inflow",
              value: dailySummary.totals.total_credits,
              label: "Total received today"
            },
            {
              title: "Today's Outflow",
              value: dailySummary.totals.total_debits,
              label: "Total paid today"
            },
            {
              title: "Net Day Change",
              value: dailySummary.totals.net_change,
              label: "Day performance"
            },
            {
              title: "Total Closing",
              value: dailySummary.totals.total_closing,
              label: "All accounts at close"
            }
          ].map((stat, idx) => (
            <Grid item xs={6} sm={4} md={2.4} key={idx}>
              <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                  <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                    {stat.title}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                    {formatCurrency(stat.value)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ==================== TABS ==================== */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab
            icon={<History fontSize="small" />}
            iconPosition="start"
            label="Account Statement"
            sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', py: isMobile ? 0.5 : 1, textTransform: 'none', fontWeight: 'bold' }}
          />
          <Tab
            icon={<TrendingUp fontSize="small" />}
            iconPosition="start"
            label="All Accounts Daily Summary"
            sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', py: isMobile ? 0.5 : 1, textTransform: 'none', fontWeight: 'bold' }}
          />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: ACCOUNT STATEMENT ==================== */}
      {activeTab === 0 && (
        <Box>
          {/* FILTER CONTROL BAR */}
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6} md={3.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="account-select-label">Select Account</InputLabel>
                  <Select
                    labelId="account-select-label"
                    value={selectedAccountId}
                    label="Select Account"
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      navigate(`/accounts/${e.target.value}/statement`, { replace: true });
                    }}
                  >
                    {accounts.map(acc => (
                      <MenuItem key={acc.id} value={acc.id}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                          <Typography variant="body2" fontWeight={600}>{acc.name}</Typography>
                          <Typography variant="caption" fontWeight={700} color={Number(acc.current_balance) >= 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(acc.current_balance)}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Quick Date Presets */}
              <Grid item xs={12} sm={6} md={4.5}>
                <Stack direction="row" spacing={0.5} sx={{ bgcolor: '#f1f5f9', p: 0.5, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'week', label: 'This Week' },
                    { id: 'month', label: 'This Month' }
                  ].map(p => (
                    <Button
                      key={p.id}
                      size="small"
                      onClick={() => handleQuickFilter(p.id)}
                      sx={{
                        flex: 1,
                        py: 0.5,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 1,
                        bgcolor: quickFilter === p.id ? '#1c2580' : 'transparent',
                        color: quickFilter === p.id ? '#ffffff' : '#475569',
                        '&:hover': {
                          bgcolor: quickFilter === p.id ? '#151c60' : '#e2e8f0'
                        }
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </Stack>
              </Grid>

              {/* Custom Date Pickers */}
              <Grid item xs={6} sm={3} md={1.75}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="From"
                  value={startDate}
                  onChange={(e) => {
                    setQuickFilter('custom');
                    setStartDate(e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={1.75}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="To"
                  value={endDate}
                  onChange={(e) => {
                    setQuickFilter('custom');
                    setEndDate(e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={0.5}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => loadStatement(selectedAccountId, startDate, endDate)}
                  sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151c60' }, height: 38, minWidth: 40, p: 0 }}
                >
                  <Refresh fontSize="small" />
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {loading && <LinearProgress sx={{ mb: 2, height: 4, borderRadius: 2 }} />}

          {/* ==================== TABLE TOOLBAR (CSV & ORIGINAL VECTOR PDF) ==================== */}
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' }, flex: 1 }}>
                <TextField
                  size="small"
                  placeholder="Filter by Txn ID, reference, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 320 } }}
                  InputProps={{
                    startAdornment: <Search fontSize="small" sx={{ mr: 1, color: '#94a3b8' }} />
                  }}
                />

                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip
                    label="All"
                    clickable
                    color={typeFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setTypeFilter('all')}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Chip
                    label="Credits (In)"
                    clickable
                    color={typeFilter === 'credit' ? 'success' : 'default'}
                    onClick={() => setTypeFilter('credit')}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Chip
                    label="Debits (Out)"
                    clickable
                    color={typeFilter === 'debit' ? 'error' : 'default'}
                    onClick={() => setTypeFilter('debit')}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Stack>
              </Stack>

              {/* TABLE ACTIONS: CSV & TRUE ORIGINAL PDF */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExportCSV}
                  disabled={!statementData || !filteredTransactions.length}
                  sx={{ borderColor: '#1c2580', color: '#1c2580', fontWeight: 'bold', textTransform: 'none' }}
                >
                  Export CSV
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PictureAsPdf />}
                  onClick={handleExportPDF}
                  disabled={!statementData}
                  sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151c60' }, fontWeight: 'bold', textTransform: 'none' }}
                >
                  Export PDF
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* ==================== STATEMENT TABLE (EXACT MATCHING DESIGN) ==================== */}
          {statementData && (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>TXN ID</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>DATE</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>TYPE / REF</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>DESCRIPTION</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">IN (CR)</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">OUT (DR)</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">BALANCE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* OPENING ROW */}
                    <TableRow sx={{ bgcolor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      <TableCell colSpan={7} sx={{ py: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label="OPENING" size="small" sx={{ bgcolor: '#1c2580', color: '#ffffff', fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
                          <Typography variant="body2" fontWeight="bold" color="#1c2580">
                            Opening Balance as of {startDate}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1c2580' }}>
                        {formatCurrency(statementData.opening_balance)}
                      </TableCell>
                    </TableRow>

                    {/* TRANSACTIONS ROWS */}
                    {paginatedTransactions.map((tx, idx) => {
                      const isCredit = (tx.transaction_type || tx.type) === 'credit';
                      const seq = page * rowsPerPage + idx + 1;

                      return (
                        <TableRow key={tx.id || idx} hover>
                          <TableCell>{seq}</TableCell>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold" color="primary">
                              #{tx.id}
                            </Typography>
                            <Typography variant="caption" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {tx.reference_type || tx.raw_type || 'transaction'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {formatDate(tx.date || tx.created_at)}
                          </TableCell>
                          <TableCell>
                            {tx.reference_no ? (
                              <Chip
                                label={tx.reference_no}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontFamily: 'monospace', fontWeight: 600 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{tx.description || '-'}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: isCredit ? 'bold' : 'normal' }}>
                            {isCredit ? formatCurrency(tx.amount) : '-'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: !isCredit ? 'bold' : 'normal' }}>
                            {!isCredit ? formatCurrency(tx.amount) : '-'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(tx.running_balance !== undefined ? tx.running_balance : tx.balance_after)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {paginatedTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                          <Typography color="text.secondary">No records found</Typography>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* CLOSING TOTALS ROW (END PAR TOTAL) */}
                    <TableRow sx={{ bgcolor: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                      <TableCell colSpan={5} sx={{ fontWeight: 'bold', py: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label="CLOSING" size="small" sx={{ bgcolor: '#1c2580', color: '#ffffff', fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
                          <Typography variant="body2" fontWeight="bold">
                            Closing Balance as of {endDate}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        +{formatCurrency(statementData.total_credits)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        -{formatCurrency(statementData.total_debits)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: '#1c2580' }}>
                        {formatCurrency(statementData.closing_balance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[25, 50, 100, 250]}
                component="div"
                count={filteredTransactions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </Paper>
          )}

          {!statementData && !loading && (
            <Paper sx={{ p: 8, textAlign: 'center' }}>
              <Typography color="text.secondary">Select an account and click Refresh to view statement</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* ==================== TAB 1: ALL ACCOUNTS DAILY SUMMARY ==================== */}
      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" color="primary">
                  Daily Accounts Opening & Closing Summary
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Summary of opening and closing balances across all accounts for the selected day.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  type="date"
                  size="small"
                  label="Date"
                  value={summaryDate}
                  onChange={(e) => setSummaryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  size="small"
                  variant={summaryDate === getToday() ? 'contained' : 'outlined'}
                  onClick={() => setSummaryDate(getToday())}
                  sx={{
                    bgcolor: summaryDate === getToday() ? '#1c2580' : 'transparent',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    height: 38
                  }}
                >
                  Today
                </Button>
                <Button
                  size="small"
                  variant={summaryDate === getYesterday() ? 'contained' : 'outlined'}
                  onClick={() => setSummaryDate(getYesterday())}
                  sx={{
                    bgcolor: summaryDate === getYesterday() ? '#1c2580' : 'transparent',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    height: 38
                  }}
                >
                  Yesterday
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {summaryLoading && <LinearProgress sx={{ mb: 2, height: 4, borderRadius: 2 }} />}

          {/* TABLE ACTIONS FOR SUMMARY */}
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportDailyCSV}
                disabled={!dailySummary || !dailySummary.accounts || !dailySummary.accounts.length}
                sx={{ borderColor: '#1c2580', color: '#1c2580', fontWeight: 'bold', textTransform: 'none' }}
              >
                Export CSV
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={handleExportDailyPDF}
                disabled={!dailySummary}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151c60' }, fontWeight: 'bold', textTransform: 'none' }}
              >
                Export PDF
              </Button>
            </Stack>
          </Paper>

          {/* SUMMARY TABLE */}
          {dailySummary && (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Account</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Type</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Opening Balance</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Today In (+)</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Today Out (-)</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Net Change</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Closing Balance</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(dailySummary.accounts || []).map((acc) => (
                      <TableRow key={acc.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">{acc.name}</Typography>
                          {acc.account_number && (
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              {acc.account_number}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={getAccountTypeLabel(acc.type)} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(acc.opening_balance)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                          {acc.today_credits > 0 ? `+${formatCurrency(acc.today_credits)}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                          {acc.today_debits > 0 ? `-${formatCurrency(acc.today_debits)}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: acc.net_change >= 0 ? '#0284c7' : '#e11d48' }}>
                          {acc.net_change >= 0 ? '+' : ''}{formatCurrency(acc.net_change)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1c2580' }}>
                          {formatCurrency(acc.closing_balance)}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Statement">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setActiveTab(0);
                                setStartDate(summaryDate);
                                setEndDate(summaryDate);
                                setQuickFilter('today');
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* TOTALS ROW (END PAR TOTAL) */}
                    {dailySummary.totals && (
                      <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                        <TableCell colSpan={2} sx={{ fontWeight: 'bold', py: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            TOTAL ACROSS ALL ACCOUNTS
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(dailySummary.totals.total_opening)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          +{formatCurrency(dailySummary.totals.total_credits)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          -{formatCurrency(dailySummary.totals.total_debits)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: dailySummary.totals.net_change >= 0 ? '#0284c7' : '#e11d48' }}>
                          {dailySummary.totals.net_change >= 0 ? '+' : ''}{formatCurrency(dailySummary.totals.net_change)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: '#1c2580' }}>
                          {formatCurrency(dailySummary.totals.total_closing)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
