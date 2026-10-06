import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Chip, Stack,
  Card, CardContent, Divider, InputAdornment, Tooltip, Fade,
  Tabs, Tab, List, ListItem, ListItemText, Avatar, Badge,
  Accordion, AccordionSummary, AccordionDetails,
  Pagination, MenuItem, useTheme, useMediaQuery, SwipeableDrawer,
  CardActionArea, Collapse,
  FormControl, InputLabel, Select, Alert
} from '../components/ui/tailwind-mui';
import {
  Add, Edit, Delete, Search, Person, Business, Phone,
  Email, LocationOn, AccountBalance, Save, Close, History,
  AttachMoney, LocalShipping, Warning, CheckCircle, Block,
  ExpandMore, Receipt, Payment, TrendingUp, TrendingDown,
  CalendarToday, Note, AccountBalanceWallet, Menu as MenuIcon,
  ArrowBack, MoreVert, Download, PictureAsPdf, FilterList, Refresh,
  Today, DateRange
} from '../components/ui/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../database/db';
import useSyncListener from '../hooks/useSyncListener';
import UnifiedPagination from '../components/common/UnifiedPagination';

// Formatting functions
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

export default function SuppliersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentPurchaseId, setPaymentPurchaseId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Detail view dialogs for Activity Log
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState(0);
  const [detailTab, setDetailTab] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(1);
  const rowsPerPage = isMobile ? 5 : 10;

  // Activity Log Filter States
  const [activityPeriod, setActivityPeriod] = useState('today_yesterday'); // 'today_yesterday' | 'today' | 'yesterday' | '7days' | 'all' | 'custom'
  const [activitySupplierFilter, setActivitySupplierFilter] = useState('all');
  const [activityStartDate, setActivityStartDate] = useState('');
  const [activityEndDate, setActivityEndDate] = useState('');

  // Mobile drawer states
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  // ==================== LOAD DATA ====================
  const loadData = async () => {
    setLoading(true);
    try {
      let sups = [], purchs = [], pays = [], ledg = [];

      try {
        sups = await db.getSuppliers();
        console.log('[SuppliersPage] Loaded suppliers:', sups?.length || 0);
      } catch (err) {
        console.error('[SuppliersPage] getSuppliers error:', err);
      }

      try {
        purchs = await db.getPurchases();
      } catch (err) {
        console.error('[SuppliersPage] getPurchases error:', err);
      }

      try {
        pays = db.getPayments ? await db.getPayments() : [];
      } catch (err) {
        console.error('[SuppliersPage] getPayments error:', err);
      }

      try {
        ledg = db.getLedger ? await db.getLedger() : [];
      } catch (err) {
        console.error('[SuppliersPage] getLedger error:', err);
      }

      setSuppliers(sups || []);
      setPurchases(purchs || []);
      setPayments(pays || []);
      setLedger(ledg || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  useSyncListener(loadData);

  // ==================== LOAD ACCOUNTS ====================
  const loadAccounts = async () => {
    try {
      const accs = db.getAccounts ? await db.getAccounts({ status: 'active' }) : [];
      setAccounts(accs || []);
      // Auto-select first matching account for current payment mode
      const defaultAcc = accs.find(a => a.type === paymentMode) || accs[0] || null;
      setSelectedAccount(defaultAcc);
    } catch (err) {
      console.error('Load accounts error:', err);
    }
  };

  useEffect(() => {
    if (paymentDialog) {
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentMode('cash');
      setPaymentPurchaseId('');
      setSelectedAccount(null);
      loadAccounts();
    }
  }, [paymentDialog]);

  // Auto-select account when payment mode changes
  useEffect(() => {
    const acc = accounts.find(a => a.type === paymentMode);
    setSelectedAccount(acc || null);
  }, [accounts, paymentMode]);

  // ==================== FILTERS ====================
  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const term = search.toLowerCase();
      return (
        s.name?.toLowerCase().includes(term) ||
        s.company_name?.toLowerCase().includes(term) ||
        s.phone?.includes(term) ||
        s.vat_ntn_number?.toLowerCase().includes(term)
      );
    });
  }, [suppliers, search]);
  
  // Pagination
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);
  
  // Stats
  const totalPayable = useMemo(() => suppliers.reduce((sum, s) => sum + (Number(s.current_balance) || 0), 0), [suppliers]);
  const activeCount = useMemo(() => suppliers.filter(s => s.status === 'active').length, [suppliers]);
  const totalPurchases = purchases.length;
  
  // ==================== SUPPLIER CRUD ====================
  const handleOpen = (supplier = null) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
    if (isMobile) setMobileDrawerOpen(false);
  };
  
  const handleSave = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const openingBal = Number(form.opening_balance.value) || 0;
    const data = {
      name: form.name.value,
      company_name: form.company_name.value,
      phone: form.phone.value,
      email: form.email.value,
      vat_ntn_number: form.vat_ntn_number.value,
      address: form.address.value,
      opening_balance: openingBal,
      current_balance: editingSupplier 
        ? editingSupplier.current_balance 
        : openingBal,
      status: form.status.value
    };
    
    try {
      if (editingSupplier) {
        await db.updateSupplier(editingSupplier.id, data);
      } else {
        await db.createSupplier(data);
      }
      await loadData();
      setDialogOpen(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Delete this supplier? All history will be preserved but hidden.')) {
      try {
        await db.deleteSupplier(id);
        await loadData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  };

  // ==================== PAYMENT HANDLER ====================
  const handlePayment = async (e) => {
    e.preventDefault();
    if (!viewSupplier || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      alert('Enter valid amount');
      return;
    }
    
    // Check if amount exceeds balance
    const balance = Number(viewSupplier.current_balance) || 0;
    if (amount > balance) {
      alert(`Amount exceeds balance! Max allowed: Rs. ${balance.toLocaleString()}`);
      return;
    }
    
    // Account balance check (only for non-credit payments)
    if (paymentMode !== 'credit') {
      const acc = accounts.find(a => a.type === paymentMode);
      if (!acc) {
        alert(`No active account found for ${paymentMode.toUpperCase()}`);
        return;
      }
      if (Number(acc.current_balance) < amount) {
        alert(`Insufficient balance in ${acc.name}. Available: Rs. ${Number(acc.current_balance).toLocaleString()}`);
        return;
      }
    }
    
    try {
      // addSupplierPayment handles everything:
      // 1. Payment record (addPayment)
      // 2. Supplier balance update (updateSupplierBalance)
      // 3. Ledger entry (addLedgerEntry)
      // 4. Account deduction (deductFromAccount)
      await db.addSupplierPayment(viewSupplier.id, {
        supplier_id: viewSupplier.id,
        purchase_id: paymentPurchaseId || null,
        amount: amount,
        payment_mode: paymentMode,
        account_id: selectedAccount?.id || null,  // PASS ACCOUNT ID
        note: paymentNote || `Payment to ${viewSupplier.name}`,
        date: new Date().toISOString().split('T')[0]
      });
      
      await loadData();
      setPaymentDialog(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentMode('cash');
      setPaymentPurchaseId('');
      setSelectedAccount(null);
      
      const updated = await db.getSupplierById(viewSupplier.id);
      setViewSupplier(updated);
    } catch (err) {
      alert('Payment failed: ' + err.message);
    }
  };
  
  // ==================== HELPER FUNCTIONS ====================
  const getSupplierPurchases = (supplierId) => purchases.filter(p => p.supplier_id === supplierId && !p.is_deleted);
  const getSupplierPayments = (supplierId) => payments.filter(p => p.supplier_id === supplierId);
  const getSupplierLedger = (supplierId) => ledger.filter(l => l.supplier_id === supplierId);
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'S';

  // ==================== DATE & ACTIVITY FILTER HELPERS ====================
  const getDateOnly = (val) => {
    if (!val) return '';
    try {
      if (typeof val === 'string' && val.length >= 10 && val[4] === '-' && val[7] === '-') {
        return val.substring(0, 10);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (p.is_deleted) return false;
      if (activitySupplierFilter !== 'all' && String(p.supplier_id) !== String(activitySupplierFilter)) {
        return false;
      }
      const pDate = getDateOnly(p.purchase_date || p.created_at);
      if (!pDate) return true;

      if (activityPeriod === 'today') return pDate === todayStr;
      if (activityPeriod === 'yesterday') return pDate === yesterdayStr;
      if (activityPeriod === 'today_yesterday') return pDate === todayStr || pDate === yesterdayStr;
      if (activityPeriod === '7days') return pDate >= sevenDaysAgoStr && pDate <= todayStr;
      if (activityPeriod === 'custom') {
        if (activityStartDate && pDate < activityStartDate) return false;
        if (activityEndDate && pDate > activityEndDate) return false;
        return true;
      }
      return true; // 'all'
    });
  }, [purchases, activitySupplierFilter, activityPeriod, todayStr, yesterdayStr, sevenDaysAgoStr, activityStartDate, activityEndDate]);

  const filteredPayments = useMemo(() => {
    return payments.filter(pay => {
      if (pay.is_deleted) return false;
      if (activitySupplierFilter !== 'all' && String(pay.supplier_id) !== String(activitySupplierFilter)) {
        return false;
      }
      const payDate = getDateOnly(pay.date || pay.created_at);
      if (!payDate) return true;

      if (activityPeriod === 'today') return payDate === todayStr;
      if (activityPeriod === 'yesterday') return payDate === yesterdayStr;
      if (activityPeriod === 'today_yesterday') return payDate === todayStr || payDate === yesterdayStr;
      if (activityPeriod === '7days') return payDate >= sevenDaysAgoStr && payDate <= todayStr;
      if (activityPeriod === 'custom') {
        if (activityStartDate && payDate < activityStartDate) return false;
        if (activityEndDate && payDate > activityEndDate) return false;
        return true;
      }
      return true; // 'all'
    });
  }, [payments, activitySupplierFilter, activityPeriod, todayStr, yesterdayStr, sevenDaysAgoStr, activityStartDate, activityEndDate]);

  const getActivityDateBadge = (dateVal) => {
    const d = getDateOnly(dateVal);
    if (!d) return null;
    if (d === todayStr) {
      return <Chip size="small" label="TODAY" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 'bold', fontSize: '0.65rem', height: 20 }} />;
    }
    if (d === yesterdayStr) {
      return <Chip size="small" label="YESTERDAY" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 'bold', fontSize: '0.65rem', height: 20 }} />;
    }
    return <Chip size="small" label={formatDate(dateVal)} sx={{ bgcolor: '#f1f5f9', color: '#475569', fontSize: '0.65rem', height: 20 }} />;
  };

  const handlePurgeOldActivities = async () => {
    const days = 60;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const oldPayments = payments.filter(p => {
      const d = getDateOnly(p.date || p.created_at);
      return d && d < cutoffStr && !p.is_deleted;
    });

    if (oldPayments.length === 0) {
      alert(`No payment activities found older than ${days} days (${cutoffStr}).`);
      return;
    }

    if (!window.confirm(`Found ${oldPayments.length} payment records older than ${days} days (${cutoffStr}). Clean up these records from activity history? (Supplier balances and ledger statements will remain completely intact).`)) {
      return;
    }

    try {
      let deletedCount = 0;
      for (const p of oldPayments) {
        if (p.id && db.deletePayment) {
          await db.deletePayment(p.id);
          deletedCount++;
        }
      }
      await loadData();
      alert(`Successfully purged ${deletedCount} old payment records.`);
    } catch (err) {
      console.error('Error purging old payments:', err);
      alert('Error purging records: ' + err.message);
    }
  };

  // ==================== SUPPLIER LEDGER PDF EXPORT ====================
  const exportSupplierLedgerPDF = (supplier) => {
    if (!supplier) return;
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Header Band in Royal Navy (#1c2580 = [28, 37, 128])
      doc.setFillColor(28, 37, 128);
      doc.rect(0, 0, pageWidth, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(shop.name || 'RAATH POS', pageWidth / 2, 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('SUPPLIER ACCOUNT LEDGER STATEMENT', pageWidth / 2, 22, { align: 'center' });
      if (shop.phone || shop.address) {
        doc.setFontSize(8);
        doc.text(`${shop.phone || ''} ${shop.address ? '| ' + shop.address : ''}`, pageWidth / 2, 28, { align: 'center' });
      }

      // Metadata Info Cards
      doc.setTextColor(30, 41, 59);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(12, 38, 92, 34, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SUPPLIER DETAILS', 16, 45);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Name: ${supplier.name || '-'}`, 16, 51);
      doc.text(`Company: ${supplier.company_name || '-'}`, 16, 57);
      doc.text(`Phone: ${supplier.phone || '-'} | NTN: ${supplier.vat_ntn_number || 'N/A'}`, 16, 63);
      if (supplier.address) {
        doc.text(`Address: ${String(supplier.address).substring(0, 40)}`, 16, 69);
      }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(108, 38, 90, 34, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ACCOUNT SUMMARY', 112, 45);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Opening Balance: Rs. ${Number(supplier.opening_balance || 0).toLocaleString()}`, 112, 51);
      doc.text(`Net Outstanding: Rs. ${Number(supplier.current_balance || 0).toLocaleString()}`, 112, 57);
      doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 112, 63);
      doc.text(`Account Status: ${(supplier.status || 'active').toUpperCase()}`, 112, 69);

      // Build Ledger Rows: Chronological merge of Purchases and Payments
      const supPurchases = getSupplierPurchases(supplier.id);
      const supPayments = getSupplierPayments(supplier.id);

      const allEvents = [];

      // Opening balance row
      allEvents.push({
        date: supplier.created_at || '2000-01-01',
        displayDate: 'Opening',
        type: 'OPENING',
        ref: '-',
        description: 'Opening Balance Recorded',
        debit: 0,
        credit: Number(supplier.opening_balance || 0),
        rawTime: new Date(supplier.created_at || 0).getTime() || 0
      });

      // Purchases (add to supplier payable/debt)
      supPurchases.forEach(p => {
        allEvents.push({
          date: p.purchase_date || p.created_at,
          displayDate: formatDate(p.purchase_date || p.created_at),
          type: 'PURCHASE',
          ref: p.purchase_no || '-',
          description: `Purchase Invoice (${(p.payment_status || 'due').toUpperCase()})`,
          debit: Number(p.grand_total || 0),
          credit: 0,
          rawTime: new Date(p.purchase_date || p.created_at || 0).getTime()
        });
      });

      // Payments (clear supplier payable/debt)
      supPayments.forEach(pay => {
        allEvents.push({
          date: pay.date || pay.created_at,
          displayDate: formatDate(pay.date || pay.created_at),
          type: 'PAYMENT',
          ref: pay.payment_mode ? pay.payment_mode.toUpperCase() : 'CASH',
          description: pay.note || 'Vendor Remittance',
          debit: 0,
          credit: Number(pay.amount || 0),
          rawTime: new Date(pay.date || pay.created_at || 0).getTime()
        });
      });

      // Sort events chronologically (Opening always first)
      allEvents.sort((a, b) => {
        if (a.type === 'OPENING') return -1;
        if (b.type === 'OPENING') return 1;
        return a.rawTime - b.rawTime;
      });

      let currentBal = 0;
      let totalDebits = 0; // Total Purchases
      let totalCredits = 0; // Total Payments

      const tableRows = allEvents.map((evt) => {
        if (evt.type === 'OPENING') {
          currentBal = evt.credit;
        } else {
          currentBal = currentBal + evt.debit - evt.credit;
          totalDebits += evt.debit;
          totalCredits += evt.credit;
        }

        return [
          evt.displayDate,
          evt.type,
          evt.ref,
          evt.description,
          evt.debit > 0 ? `Rs. ${evt.debit.toLocaleString()}` : '-',
          evt.credit > 0 ? `Rs. ${evt.credit.toLocaleString()}` : '-',
          `Rs. ${Math.max(0, currentBal).toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [['Date', 'Type', 'Voucher #', 'Description', 'Purchase (Dr)', 'Payment (Cr)', 'Balance']],
        body: tableRows,
        startY: 78,
        theme: 'striped',
        headStyles: {
          fillColor: [28, 37, 128],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 20 },
          2: { cellWidth: 24 },
          3: { cellWidth: 50 },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.row.raw[1] === 'PURCHASE') {
              if (data.column.index === 1) data.cell.styles.textColor = [220, 38, 38];
            } else if (data.row.raw[1] === 'PAYMENT') {
              if (data.column.index === 1) data.cell.styles.textColor = [16, 185, 129];
            }
          }
        }
      });

      // Total summary at bottom
      const finalY = (doc.lastAutoTable?.finalY || 78) + 8;
      const rightX = pageWidth - 92;

      // Summary Card
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(rightX - 5, finalY, 85, 30, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Invoiced: Rs. ${totalDebits.toLocaleString()}`, rightX, finalY + 7);
      doc.text(`Total Paid: Rs. ${totalCredits.toLocaleString()}`, rightX, finalY + 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(28, 37, 128);
      doc.text(`Net Outstanding: Rs. ${Number(supplier.current_balance || 0).toLocaleString()}`, rightX, finalY + 23);

      // Signatures
      const signY = Math.max(finalY + 45, 260);
      if (signY < 280) {
        doc.setDrawColor(203, 213, 225);
        doc.line(16, signY, 70, signY);
        doc.line(pageWidth - 70, signY, pageWidth - 16, signY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Authorized Signature', 24, signY + 5);
        doc.text('Supplier Signature / Stamp', pageWidth - 66, signY + 5);
      }

      const sanitizedName = (supplier.name || 'supplier').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Ledger_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating ledger PDF:', err);
      alert('Error exporting PDF: ' + err.message);
    }
  };

  // ==================== ALL SUPPLIERS SUMMARY PDF EXPORT ====================
  const exportAllSuppliersSummaryPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(28, 37, 128);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(shop.name || 'RAATH POS', pageWidth / 2, 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('ALL SUPPLIERS LEDGER SUMMARY REPORT', pageWidth / 2, 22, { align: 'center' });

      const rows = suppliers.map((s, idx) => {
        const supsPurch = getSupplierPurchases(s.id);
        const supsPay = getSupplierPayments(s.id);
        const totalPurchAmount = supsPurch.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
        const totalPayAmount = supsPay.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
        return [
          idx + 1,
          s.name,
          s.company_name || '-',
          s.phone || '-',
          `Rs. ${Number(s.opening_balance || 0).toLocaleString()}`,
          `Rs. ${totalPurchAmount.toLocaleString()}`,
          `Rs. ${totalPayAmount.toLocaleString()}`,
          `Rs. ${Number(s.current_balance || 0).toLocaleString()}`
        ];
      });

      const totalBalance = suppliers.reduce((sum, s) => sum + Number(s.current_balance || 0), 0);

      autoTable(doc, {
        head: [['#', 'Supplier', 'Company', 'Phone', 'Opening (Rs.)', 'Purchases (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)']],
        body: rows,
        startY: 38,
        theme: 'striped',
        headStyles: { fillColor: [28, 37, 128], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 30 },
          3: { cellWidth: 24 },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        },
        foot: [['', 'Total Outstanding', '', '', '', '', '', `Rs. ${totalBalance.toLocaleString()}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [28, 37, 128], fontStyle: 'bold' }
      });

      doc.save(`All_Suppliers_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error exporting all suppliers PDF:', err);
      alert('Error exporting PDF: ' + err.message);
    }
  };

  // ==================== MOBILE SUPPLIER CARD ====================
  const SupplierCard = ({ supplier }) => {
    const balance = Number(supplier.current_balance) || 0;
    const isDue = balance > 0;
    const [expanded, setExpanded] = useState(false);

    return (
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardActionArea onClick={() => setExpanded(!expanded)}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar sx={{ width: 40, height: 40, fontSize: 14, bgcolor: isDue ? 'warning.main' : 'success.main' }}>
                {getInitials(supplier.name)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600} noWrap>{supplier.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {supplier.company_name || 'No Company'}
                </Typography>
              </Box>
              <Chip 
                size="small" 
                color={supplier.status === 'active' ? 'success' : 'default'} 
                label={supplier.status?.toUpperCase()}
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            </Stack>
          </CardContent>
        </CardActionArea>
        
        <Collapse in={expanded}>
          <Divider />
          <CardContent sx={{ pt: 1 }}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Phone</Typography>
                <Typography variant="body2">{supplier.phone}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2" noWrap>{supplier.email || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">VAT/NTN</Typography>
                <Typography variant="body2">{supplier.vat_ntn_number || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Opening Balance</Typography>
                <Typography variant="body2">Rs. {Number(supplier.opening_balance).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                <Typography variant="h6" fontWeight="bold" color={isDue ? 'error' : 'success'}>
                  Rs. {balance.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {isDue && (
                    <Button 
                      size="small" 
                      variant="contained" 
                      color="success" 
                      startIcon={<Payment />}
                      onClick={(e) => { e.stopPropagation(); setViewSupplier(supplier); setPaymentDialog(true); }}
                      fullWidth
                    >
                      Pay
                    </Button>
                  )}
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="info" 
                    startIcon={<History />}
                    onClick={(e) => { e.stopPropagation(); setViewSupplier(supplier); }}
                    fullWidth
                  >
                    History
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="primary" 
                    startIcon={<Edit />}
                    onClick={(e) => { e.stopPropagation(); handleOpen(supplier); }}
                    fullWidth
                  >
                    Edit
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="error" 
                    startIcon={<Delete />}
                    onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id); }}
                    fullWidth
                  >
                    Delete
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Collapse>
      </Card>
    );
  };

  // ==================== STATS CARDS ====================
  const StatsCards = () => (
    <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
      {[
        { title: 'Total Suppliers', value: suppliers.length, label: 'All records' },
        { title: 'Payable Due', value: `Rs. ${totalPayable.toLocaleString()}`, label: 'Outstanding balance' },
        { title: 'Active', value: activeCount, label: 'Active vendors' },
        { title: 'Purchases', value: totalPurchases, label: 'Recorded orders' },
      ].map((stat, idx) => (
        <Grid item xs={6} sm={3} key={idx}>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                {stat.title}
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
                {stat.label}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 }, 
      maxWidth: 1400, 
      mx: 'auto',
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      {/* HEADER */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
          Suppliers & Vendors
        </Typography>
        {isMobile && (
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => handleOpen()}
            fullWidth
            size="medium"
          >
            Add Supplier
          </Button>
        )}
      </Stack>
      
      {/* STATS CARDS */}
      <StatsCards />
      
      {/* TABS MENU */}
      <Paper sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'standard'}
          centered={!isMobile}
          sx={{
            '& .MuiTab-root': {
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              px: isMobile ? 1 : 2,
              minHeight: isMobile ? 48 : 64,
            }
          }}
        >
          <Tab icon={<Business fontSize={isMobile ? 'small' : 'medium'} />} label={isMobile ? 'Suppliers' : 'Suppliers'} iconPosition="start" />
          <Tab icon={<AccountBalance fontSize={isMobile ? 'small' : 'medium'} />} label={isMobile ? 'Ledger' : 'Ledger'} iconPosition="start" />
          <Tab icon={<History fontSize={isMobile ? 'small' : 'medium'} />} label={isMobile ? 'Activity' : 'Activity Log'} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* ==================== TAB 0: SUPPLIERS ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2 }}>
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                spacing={2} 
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <TextField 
                  fullWidth 
                  size="small" 
                  placeholder="Search by name, company, phone or VAT..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  InputProps={{ 
                    startAdornment: <Search color="action" sx={{ mr: 1 }} />,
                    sx: { borderRadius: 2 }
                  }} 
                />
                {!isMobile && (
                  <Button 
                    variant="contained" 
                    startIcon={<Add />} 
                    onClick={() => handleOpen()}
                    sx={{ minWidth: 150 }}
                  >
                    Add Supplier
                  </Button>
                )}
              </Stack>
            </Paper>
            
            {/* DESKTOP TABLE VIEW */}
            {!isMobile ? (
              <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Supplier</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Contact</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>VAT/NTN</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Opening Balance</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Current Balance</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSuppliers.map(supplier => {
                      const balance = Number(supplier.current_balance) || 0;
                      const isDue = balance > 0;
                      return (
                        <TableRow key={supplier.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: isDue ? 'warning.main' : 'success.main' }}>
                                {getInitials(supplier.name)}
                              </Avatar>
                              <Box>
                                <Typography fontWeight={600}>{supplier.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {supplier.company_name || 'No Company'}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{supplier.phone}</Typography>
                            <Typography variant="caption" color="text.secondary">{supplier.email}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={supplier.vat_ntn_number || 'N/A'} variant="outlined" />
                          </TableCell>
                          <TableCell align="right">Rs. {Number(supplier.opening_balance).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" color={isDue ? 'error' : 'success'}>
                              Rs. {balance.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={supplier.status === 'active' ? 'success' : 'default'} 
                              label={supplier.status?.toUpperCase()} 
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {isDue && (
                                <Tooltip title="Make Payment">
                                  <IconButton 
                                    size="small" 
                                    color="success" 
                                    onClick={() => { setViewSupplier(supplier); setPaymentDialog(true); }}
                                  >
                                    <Payment fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="History">
                                <IconButton size="small" color="info" onClick={() => setViewSupplier(supplier)}>
                                  <History fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" color="primary" onClick={() => handleOpen(supplier)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDelete(supplier.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              /* MOBILE CARD VIEW */
              <Box>
                {paginatedSuppliers.map(supplier => (
                  <SupplierCard key={supplier.id} supplier={supplier} />
                ))}
                {paginatedSuppliers.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                    <Typography color="text.secondary">No suppliers found</Typography>
                  </Paper>
                )}
              </Box>
            )}
            
            <UnifiedPagination
              count={filtered.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(newR) => {
                setRowsPerPage(newR);
                setPage(1);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Box>
        </Fade>
      )}
      
      {/* ==================== TAB 1: LEDGER ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 'bold' }}>
                  <AccountBalance sx={{ mr: 1, verticalAlign: 'middle', color: '#1c2580' }} />
                  Supplier Ledger
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Real-time outstanding accounting balances & printable statements
                </Typography>
              </Box>
              <Button
                variant="contained"
                size={isMobile ? 'small' : 'medium'}
                startIcon={<PictureAsPdf />}
                onClick={exportAllSuppliersSummaryPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#131b60' }, textTransform: 'none', fontWeight: 'bold' }}
              >
                Export All Ledgers (PDF)
              </Button>
            </Paper>
            {suppliers.map(supplier => (
              <Accordion key={supplier.id} sx={{ mb: 1, borderRadius: 2, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: { xs: 1.5, sm: 2 } }}>
                  <Stack 
                    direction="row" 
                    alignItems="center" 
                    spacing={{ xs: 1, sm: 2 }} 
                    sx={{ width: '100%', flexWrap: 'wrap' }}
                  >
                    <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 }, fontSize: { xs: 10, sm: 12 } }}>
                      {getInitials(supplier.name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight="bold" fontSize={{ xs: '0.875rem', sm: '1rem' }} noWrap>
                        {supplier.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display={{ xs: 'none', sm: 'block' }}>
                        {getSupplierPurchases(supplier.id).length} purchases • {getSupplierPayments(supplier.id).length} payments
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={(e) => {
                        e.stopPropagation();
                        exportSupplierLedgerPDF(supplier);
                      }}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        py: 0.25,
                        px: 1,
                        borderRadius: 1.5,
                        borderColor: '#1c2580',
                        color: '#1c2580',
                        '&:hover': { bgcolor: '#f0f4ff', borderColor: '#1c2580' }
                      }}
                    >
                      Export PDF
                    </Button>
                    <Typography 
                      fontWeight="bold" 
                      color={Number(supplier.current_balance) > 0 ? 'error' : 'success'}
                      fontSize={{ xs: '0.75rem', sm: '0.875rem' }}
                    >
                      Rs. {Number(supplier.current_balance).toLocaleString()}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 0.5, sm: 2 }, pb: 2 }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#1c2580' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Date</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Type</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Description</TableCell>
                          <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Debit</TableCell>
                          <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Credit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={3} sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            Opening Balance
                          </TableCell>
                          <TableCell align="right">-</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            Rs. {Number(supplier.opening_balance).toLocaleString()}
                          </TableCell>
                        </TableRow>
                        {getSupplierPurchases(supplier.id).map(p => (
                          <TableRow key={p.id} hover onClick={() => setSelectedPurchase(p)} style={{ cursor: 'pointer' }}>
                            <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              {formatDate(p.purchase_date)}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" color="error" label="PURCHASE" sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{p.purchase_no}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              Rs. {Number(p.grand_total).toLocaleString()}
                            </TableCell>
                            <TableCell align="right">-</TableCell>
                          </TableRow>
                        ))}
                        {getSupplierPayments(supplier.id).map(pay => (
                          <TableRow key={pay.id} hover onClick={() => setSelectedPayment(pay)} style={{ cursor: 'pointer' }}>
                            <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              {formatDate(pay.date)}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" color="success" label="PAYMENT" sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              {pay.note || 'Cash Settlement'}
                            </TableCell>
                            <TableCell align="right">-</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              Rs. {Number(pay.amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
            {suppliers.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">No suppliers found</Typography>
              </Paper>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 2: ACTIVITY LOG ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            {/* ACTIVITY FILTER BAR */}
            <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2.5, borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 'bold' }}>
                    <History sx={{ mr: 1, verticalAlign: 'middle', color: '#1c2580' }} />
                    Supplier Activity Monitor
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activityPeriod === 'today_yesterday'
                      ? 'Displaying Today & Yesterday activities by default (Clean Mode)'
                      : activityPeriod === 'today'
                      ? 'Displaying Today’s activities'
                      : activityPeriod === 'yesterday'
                      ? 'Displaying Yesterday’s activities'
                      : activityPeriod === '7days'
                      ? 'Displaying Last 7 Days activities'
                      : activityPeriod === 'custom'
                      ? `Custom Date Range: ${activityStartDate || 'Any'} to ${activityEndDate || 'Any'}`
                      : 'Displaying All Time activities'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<Delete />}
                  onClick={handlePurgeOldActivities}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Purge Old Records (&gt;60 Days)
                </Button>
              </Stack>

              {/* Quick Filter Period Chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2, gap: 0.75 }}>
                <Chip
                  label="Today & Yesterday (Default)"
                  color={activityPeriod === 'today_yesterday' ? 'primary' : 'default'}
                  variant={activityPeriod === 'today_yesterday' ? 'filled' : 'outlined'}
                  onClick={() => setActivityPeriod('today_yesterday')}
                  sx={{ fontWeight: activityPeriod === 'today_yesterday' ? 'bold' : 'normal', cursor: 'pointer' }}
                />
                <Chip
                  label="Today Only"
                  color={activityPeriod === 'today' ? 'primary' : 'default'}
                  variant={activityPeriod === 'today' ? 'filled' : 'outlined'}
                  onClick={() => setActivityPeriod('today')}
                  sx={{ fontWeight: activityPeriod === 'today' ? 'bold' : 'normal', cursor: 'pointer' }}
                />
                <Chip
                  label="Yesterday Only"
                  color={activityPeriod === 'yesterday' ? 'primary' : 'default'}
                  variant={activityPeriod === 'yesterday' ? 'filled' : 'outlined'}
                  onClick={() => setActivityPeriod('yesterday')}
                  sx={{ fontWeight: activityPeriod === 'yesterday' ? 'bold' : 'normal', cursor: 'pointer' }}
                />
                <Chip
                  label="Last 7 Days"
                  color={activityPeriod === '7days' ? 'primary' : 'default'}
                  variant={activityPeriod === '7days' ? 'filled' : 'outlined'}
                  onClick={() => setActivityPeriod('7days')}
                  sx={{ fontWeight: activityPeriod === '7days' ? 'bold' : 'normal', cursor: 'pointer' }}
                />
                <Chip
                  label="All Time"
                  color={activityPeriod === 'all' ? 'primary' : 'default'}
                  variant={activityPeriod === 'all' ? 'filled' : 'outlined'}
                  onClick={() => setActivityPeriod('all')}
                  sx={{ fontWeight: activityPeriod === 'all' ? 'bold' : 'normal', cursor: 'pointer' }}
                />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              {/* Detailed Filter Controls */}
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Supplier</InputLabel>
                    <Select
                      value={activitySupplierFilter}
                      onChange={(e) => setActivitySupplierFilter(e.target.value)}
                      label="Filter by Supplier"
                    >
                      <MenuItem value="all">All Suppliers ({suppliers.length})</MenuItem>
                      {suppliers.map(s => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name} {s.company_name ? `(${s.company_name})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={activityStartDate}
                    onChange={(e) => {
                      setActivityStartDate(e.target.value);
                      setActivityPeriod('custom');
                    }}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ style: { fontSize: '0.85rem' } }}
                  />
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    fullWidth
                    value={activityEndDate}
                    onChange={(e) => {
                      setActivityEndDate(e.target.value);
                      setActivityPeriod('custom');
                    }}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ style: { fontSize: '0.85rem' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={12} md={3} sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  {(activityPeriod !== 'today_yesterday' || activitySupplierFilter !== 'all' || activityStartDate || activityEndDate) && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<Refresh />}
                      onClick={() => {
                        setActivityPeriod('today_yesterday');
                        setActivitySupplierFilter('all');
                        setActivityStartDate('');
                        setActivityEndDate('');
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      Reset Filter
                    </Button>
                  )}
                  <Chip
                    label={`${filteredPurchases.length} Purchases • ${filteredPayments.length} Payments`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* ACTIVITY LISTS */}
            <Grid container spacing={2}>
              {/* Purchases List */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%', borderTop: '4px solid #1c2580', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, fontWeight: 'bold' }}>
                        <LocalShipping color="primary" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Purchases Activity
                      </Typography>
                      <Chip size="small" label={`${filteredPurchases.length} entries`} sx={{ fontSize: '0.75rem' }} />
                    </Stack>
                    <Divider sx={{ mb: 2 }} />

                    {filteredPurchases.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center' }}>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
                          No purchases found for selected period ({activityPeriod.replace('_', ' & ').toUpperCase()})
                        </Typography>
                        {activityPeriod !== 'all' && (
                          <Button size="small" variant="outlined" onClick={() => setActivityPeriod('all')} sx={{ textTransform: 'none' }}>
                            Show All Purchases
                          </Button>
                        )}
                      </Box>
                    ) : (
                      <List dense>
                        {filteredPurchases.slice(0, 30).map(p => {
                          const supName = suppliers.find(s => s.id === p.supplier_id)?.name || p.supplier_name || 'Vendor';
                          return (
                            <ListItem 
                              key={p.id} 
                              divider 
                              onClick={() => setSelectedPurchase(p)} 
                              sx={{ 
                                cursor: 'pointer', 
                                '&:hover': { bgcolor: 'action.hover' }, 
                                mb: 0.5,
                                borderRadius: 1,
                                px: { xs: 1, sm: 2 }
                              }}
                            >
                              <ListItemText 
                                primary={
                                  <Stack 
                                    direction={{ xs: 'column', sm: 'row' }} 
                                    justifyContent="space-between" 
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                    spacing={0.5}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography fontWeight="bold" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                                        {p.purchase_no}
                                      </Typography>
                                      {getActivityDateBadge(p.purchase_date || p.created_at)}
                                    </Box>
                                    <Chip 
                                      size="small" 
                                      color={p.payment_status === 'paid' ? 'success' : p.payment_status === 'partial' ? 'warning' : 'error'} 
                                      label={p.payment_status?.toUpperCase() || 'DUE'}
                                      sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                                    />
                                  </Stack>
                                } 
                                secondary={`Supplier: ${supName} | Total: Rs. ${Number(p.grand_total).toLocaleString()} | ${formatDate(p.purchase_date)}`}
                                secondaryTypographyProps={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Payments List */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%', borderTop: '4px solid #1c2580', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, fontWeight: 'bold' }}>
                        <Payment color="success" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Payments Activity
                      </Typography>
                      <Chip size="small" label={`${filteredPayments.length} entries`} sx={{ fontSize: '0.75rem' }} />
                    </Stack>
                    <Divider sx={{ mb: 2 }} />

                    {filteredPayments.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center' }}>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
                          No payments recorded for selected period ({activityPeriod.replace('_', ' & ').toUpperCase()})
                        </Typography>
                        {activityPeriod !== 'all' && (
                          <Button size="small" variant="outlined" onClick={() => setActivityPeriod('all')} sx={{ textTransform: 'none' }}>
                            Show All Payments
                          </Button>
                        )}
                      </Box>
                    ) : (
                      <List dense>
                        {filteredPayments.slice(0, 30).map(pay => {
                          const supName = suppliers.find(s => s.id === pay.supplier_id)?.name || pay.supplier_name || 'Vendor';
                          return (
                            <ListItem 
                              key={pay.id} 
                              divider 
                              onClick={() => setSelectedPayment(pay)} 
                              sx={{ 
                                cursor: 'pointer', 
                                '&:hover': { bgcolor: 'action.hover' }, 
                                mb: 0.5,
                                borderRadius: 1,
                                px: { xs: 1, sm: 2 }
                              }}
                            >
                              <ListItemText 
                                primary={
                                  <Stack 
                                    direction={{ xs: 'column', sm: 'row' }} 
                                    justifyContent="space-between" 
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                    spacing={0.5}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography color="success.main" fontWeight="bold" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                                        Rs. {Number(pay.amount).toLocaleString()}
                                      </Typography>
                                      {getActivityDateBadge(pay.date || pay.created_at)}
                                    </Box>
                                    <Chip 
                                      size="small" 
                                      label={pay.payment_mode?.toUpperCase() || 'CASH'} 
                                      sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, height: 20, bgcolor: 'grey.100' }}
                                    />
                                  </Stack>
                                } 
                                secondary={`Supplier: ${supName} | Note: ${pay.note || 'Vendor Remittance'} | ${formatDate(pay.date)}`}
                                secondaryTypographyProps={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== SUPPLIER FORM DIALOG ==================== */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : 2,
            maxHeight: isMobile ? '100vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DialogTitle sx={{ 
            bgcolor: 'primary.main', 
            color: 'white',
            py: isMobile ? 1.5 : 2,
            fontSize: { xs: '1rem', sm: '1.25rem' },
            flexShrink: 0
          }}>
            {isMobile && (
              <IconButton 
                onClick={() => setDialogOpen(false)} 
                sx={{ color: 'white', mr: 1, float: 'left' }}
              >
                <ArrowBack />
              </IconButton>
            )}
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </DialogTitle>
          <DialogContent dividers sx={{ flex: 1, overflowY: 'auto', pt: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField 
                  name="name" 
                  label="Supplier Name *" 
                  fullWidth 
                  required 
                  defaultValue={editingSupplier?.name}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  name="company_name" 
                  label="Company Name" 
                  fullWidth 
                  defaultValue={editingSupplier?.company_name}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField 
                  name="phone" 
                  label="Phone *" 
                  fullWidth 
                  required 
                  defaultValue={editingSupplier?.phone}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField 
                  name="email" 
                  label="Email" 
                  fullWidth 
                  defaultValue={editingSupplier?.email}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField 
                  name="vat_ntn_number" 
                  label="VAT / NTN" 
                  fullWidth 
                  defaultValue={editingSupplier?.vat_ntn_number}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  name="address" 
                  label="Address" 
                  fullWidth 
                  multiline 
                  rows={isMobile ? 2 : 3} 
                  defaultValue={editingSupplier?.address}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  name="opening_balance" 
                  label="Opening Balance" 
                  type="number" 
                  fullWidth 
                  defaultValue={editingSupplier?.opening_balance || 0} 
                  disabled={!!editingSupplier}
                  size={isMobile ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  name="status" 
                  label="Status" 
                  select 
                  fullWidth 
                  defaultValue={editingSupplier?.status || 'active'}
                  size={isMobile ? 'small' : 'medium'}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Button onClick={() => setDialogOpen(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" fullWidth={isMobile}>
              Save Vendor
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== SUPPLIER DETAILS DIALOG ==================== */}
      <Dialog 
        open={!!viewSupplier} 
        onClose={() => setViewSupplier(null)} 
        maxWidth="lg" 
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : 2,
          }
        }}
      >
        {viewSupplier && (
          <>
            <DialogTitle sx={{ 
              bgcolor: 'primary.main', 
              color: 'white',
              py: isMobile ? 1.5 : 2,
              fontSize: { xs: '0.9rem', sm: '1.25rem' }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {isMobile && (
                    <IconButton 
                      onClick={() => setViewSupplier(null)} 
                      sx={{ color: 'white', mr: 1, p: 0 }}
                    >
                      <ArrowBack />
                    </IconButton>
                  )}
                  <Typography variant="inherit" fontWeight="bold" noWrap>
                    {viewSupplier.name} — Statement
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button 
                    variant="contained" 
                    size="small"
                    startIcon={<PictureAsPdf />}
                    onClick={() => exportSupplierLedgerPDF(viewSupplier)}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Export PDF
                  </Button>
                  {Number(viewSupplier.current_balance) > 0 && (
                    <Button 
                      variant="contained" 
                      color="success" 
                      size="small"
                      onClick={() => setPaymentDialog(true)}
                    >
                      <Payment sx={{ mr: 0.5 }} /> Pay
                    </Button>
                  )}
                </Stack>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
              <Tabs 
                value={detailTab} 
                onChange={(e, v) => setDetailTab(v)} 
                sx={{ mb: 2 }}
                variant={isMobile ? 'fullWidth' : 'standard'}
                centered={!isMobile}
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab label="Profile" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }} />
                <Tab label="Purchases" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }} />
                <Tab label="Payments" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }} />
                <Tab label="Ledger" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }} />
              </Tabs>
              {detailTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">Contact Information</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2"><strong>Phone:</strong> {viewSupplier.phone}</Typography>
                      <Typography variant="body2"><strong>Email:</strong> {viewSupplier.email || 'N/A'}</Typography>
                      <Typography variant="body2"><strong>Address:</strong> {viewSupplier.address || 'N/A'}</Typography>
                      <Typography variant="body2"><strong>VAT/NTN:</strong> {viewSupplier.vat_ntn_number || 'N/A'}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">Financial Summary</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2"><strong>Opening Balance:</strong> Rs. {Number(viewSupplier.opening_balance).toLocaleString()}</Typography>
                      <Typography variant="h6" fontWeight="bold" color={Number(viewSupplier.current_balance) > 0 ? 'error' : 'success'}>
                        Net Outstanding: Rs. {Number(viewSupplier.current_balance).toLocaleString()}
                      </Typography>
                      {Number(viewSupplier.current_balance) > 0 && (
                        <Button 
                          variant="contained" 
                          color="success" 
                          onClick={() => setPaymentDialog(true)} 
                          sx={{ mt: 2 }}
                          fullWidth={isMobile}
                        >
                          Clear Balance
                        </Button>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              )}
              {detailTab === 1 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#1c2580' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Invoice</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Mode</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Status</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Total</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Paid</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getSupplierPurchases(viewSupplier.id).map(p => {
                        const due = Number(p.grand_total || 0) - Number(p.paid_amount || 0);
                        return (
                        <TableRow key={p.id}>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{p.purchase_no}</TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{formatDate(p.purchase_date)}</TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            <Chip size="small" label={p.payment_mode?.toUpperCase() || 'CASH'} sx={{ fontSize: '0.6rem', height: 20 }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            <Chip size="small" color={p.payment_status === 'paid' ? 'success' : p.payment_status === 'partial' ? 'warning' : 'error'} label={p.payment_status?.toUpperCase() || 'DUE'} sx={{ fontSize: '0.6rem', height: 20 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            Rs. {Number(p.grand_total).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            Rs. {Number(p.paid_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: due > 0 ? 'error.main' : 'success.main', fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            Rs. {due.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {detailTab === 2 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#1c2580' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Mode</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Note</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getSupplierPayments(viewSupplier.id).map(p => (
                        <TableRow key={p.id}>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{formatDate(p.date)}</TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            <Chip size="small" label={p.payment_mode?.toUpperCase() || 'CASH'} sx={{ fontSize: '0.6rem', height: 20 }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{p.note || 'N/A'}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            Rs. {Number(p.amount).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {detailTab === 3 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell colSpan={2} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          <strong>Ledger Summary</strong>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Total Purchases</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          {getSupplierPurchases(viewSupplier.id).length}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Total Payments</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          {getSupplierPayments(viewSupplier.id).length}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Net Balance</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: Number(viewSupplier.current_balance) > 0 ? 'error' : 'success', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          Rs. {Number(viewSupplier.current_balance).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="contained"
                      startIcon={<PictureAsPdf />}
                      onClick={() => exportSupplierLedgerPDF(viewSupplier)}
                      sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#131b60' }, textTransform: 'none', fontWeight: 'bold' }}
                    >
                      Download Full Ledger (PDF)
                    </Button>
                  </Box>
                </TableContainer>
              )}
            </DialogContent>
            <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Button 
                startIcon={<PictureAsPdf />}
                onClick={() => exportSupplierLedgerPDF(viewSupplier)}
                variant="contained"
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#131b60' }, textTransform: 'none', fontWeight: 'bold' }}
              >
                Download Statement (PDF)
              </Button>
              <Button onClick={() => setViewSupplier(null)} variant="outlined" fullWidth={isMobile}>
                Close Statement
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ==================== PAYMENT DIALOG ==================== */}
      <Dialog 
        open={paymentDialog} 
        onClose={() => setPaymentDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : 2,
            maxHeight: isMobile ? '100vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }}
      >
        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DialogTitle sx={{ 
            bgcolor: 'success.main', 
            color: 'white',
            py: isMobile ? 1.5 : 2,
            fontSize: { xs: '1rem', sm: '1.25rem' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isMobile && (
                <IconButton 
                  onClick={() => setPaymentDialog(false)} 
                  sx={{ color: 'white', mr: 1, p: 0 }}
                >
                  <ArrowBack />
                </IconButton>
              )}
              <Typography variant="inherit" fontWeight="bold" noWrap>
                Record Payment
              </Typography>
            </Box>
            <Chip 
              label={viewSupplier?.name || 'Supplier'} 
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', maxWidth: isMobile ? 120 : 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />
          </DialogTitle>
          <DialogContent dividers sx={{ flex: 1, overflowY: 'auto', py: 2.5, px: { xs: 1.5, sm: 3 } }}>
            
            {/* SUPPLIER BALANCE SUMMARY CARD */}
            {viewSupplier && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: { xs: 1.5, sm: 2 }, 
                  mb: 2, 
                  borderRadius: 2, 
                  bgcolor: Number(viewSupplier.current_balance) > 0 ? 'error.light' : 'success.light',
                  border: '1px solid',
                  borderColor: Number(viewSupplier.current_balance) > 0 ? 'error.main' : 'success.main'
                }}
              >
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Total Balance</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      Rs. {Number(viewSupplier.current_balance).toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Amount Entered</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary.main">
                      Rs. {Number(paymentAmount || 0).toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">
                        Remaining After Payment:
                      </Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold" 
                        color={
                          Number(viewSupplier.current_balance) - Number(paymentAmount || 0) > 0 ? 'error.main' : 'success.main'
                        }
                      >
                        Rs. {Math.max(0, Number(viewSupplier.current_balance) - Number(paymentAmount || 0)).toLocaleString()}
                      </Typography>
                    </Stack>
                    {Number(viewSupplier.current_balance) - Number(paymentAmount || 0) === 0 && (
                      <Chip 
                        size="small" 
                        color="success" 
                        label="Balance will be cleared!" 
                        sx={{ mt: 0.5, width: '100%', fontWeight: 'bold' }}
                      />
                    )}
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* PAYMENT MODE SELECTOR */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Payment Mode *</InputLabel>
              <Select 
                value={paymentMode} 
                onChange={(e) => {
                  const mode = e.target.value;
                  setPaymentMode(mode);
                  const acc = accounts.find(a => a.type === mode);
                  setSelectedAccount(acc || null);
                }} 
                label="Payment Mode *"
                size={isMobile ? 'small' : 'medium'}
              >
                <MenuItem value="cash">Cash in Hand</MenuItem>
                <MenuItem value="bank">Bank Account</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                <MenuItem value="jazzcash">JazzCash</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
                <MenuItem value="credit">Credit</MenuItem>
              </Select>
            </FormControl>

            {/* ACCOUNT BALANCE DISPLAY */}
            {selectedAccount && paymentMode !== 'credit' && (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Stack 
                  direction={{ xs: 'column', sm: 'row' }} 
                  justifyContent="space-between" 
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{selectedAccount.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedAccount.type?.toUpperCase()} ACCOUNT</Typography>
                  </Box>
                  <Box textAlign={{ xs: 'left', sm: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Available Balance</Typography>
                    <Typography variant="body1" fontWeight="bold" color={Number(selectedAccount.current_balance) >= Number(paymentAmount || 0) ? 'success.main' : 'error.main'}>
                      Rs. {Number(selectedAccount.current_balance).toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
            {!selectedAccount && paymentMode !== 'credit' && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                No active account found for {paymentMode.toUpperCase()}. Please create one in Accounts page.
              </Alert>
            )}

            {/* PURCHASE SELECTOR */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Pay Against Purchase (Optional)</InputLabel>
              <Select 
                value={paymentPurchaseId} 
                onChange={(e) => setPaymentPurchaseId(e.target.value)} 
                label="Pay Against Purchase (Optional)"
                size={isMobile ? 'small' : 'medium'}
              >
                <MenuItem value=""><em>General Payment (No specific purchase)</em></MenuItem>
                {viewSupplier && getSupplierPurchases(viewSupplier.id)
                  .filter(p => p.payment_status !== 'paid')
                  .map(p => {
                    const due = (p.grand_total || 0) - (p.paid_amount || 0);
                    return (
                      <MenuItem key={p.id} value={p.id}>
                        {p.purchase_no} — Due: Rs. {Number(due).toLocaleString()}
                      </MenuItem>
                    );
                  })}
              </Select>
            </FormControl>

            {/* AMOUNT */}
            <TextField 
              autoFocus 
              fullWidth 
              label="Amount (Rs.) *" 
              type="number" 
              value={paymentAmount} 
              onChange={(e) => setPaymentAmount(e.target.value)} 
              required 
              sx={{ mt: 1 }}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                endAdornment: viewSupplier && (
                  <InputAdornment position="end">
                    <Button 
                      size="small" 
                      variant="text" 
                      onClick={() => setPaymentAmount(String(Number(viewSupplier.current_balance)))}
                      sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                    >
                      Max
                    </Button>
                  </InputAdornment>
                )
              }}
              helperText={
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Max allowed: Rs. {viewSupplier ? Number(viewSupplier.current_balance).toLocaleString() : '0'}
                  </Typography>
                  {Number(paymentAmount) > Number(viewSupplier?.current_balance || 0) && (
                    <Typography variant="caption" color="error.main" fontWeight="bold">
                      Amount exceeds balance!
                    </Typography>
                  )}
                </Stack>
              }
            />

            {/* NOTE */}
            <TextField 
              fullWidth 
              label="Reference Note" 
              value={paymentNote} 
              onChange={(e) => setPaymentNote(e.target.value)} 
              sx={{ mt: 2 }}
              size={isMobile ? 'small' : 'medium'}
              multiline
              rows={2}
              placeholder="Payment description..."
            />
          </DialogContent>
          <DialogActions sx={{ 
            p: { xs: 1.5, sm: 2 }, 
            flexDirection: { xs: 'column', sm: 'row' }, 
            gap: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0
          }}>
            <Button onClick={() => setPaymentDialog(false)} fullWidth={isMobile} size={isMobile ? 'medium' : 'medium'}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="success" 
              fullWidth={isMobile}
              disabled={
                !paymentAmount || 
                Number(paymentAmount) <= 0 || 
                Number(paymentAmount) > Number(viewSupplier?.current_balance || 0) ||
                (paymentMode !== 'credit' && selectedAccount && Number(selectedAccount.current_balance) < Number(paymentAmount))
              }
              size={isMobile ? 'medium' : 'medium'}
              startIcon={<Payment />}
            >
              Process Payment
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== VIEW PURCHASE DETAILS DIALOG ==================== */}
      <Dialog 
        open={!!selectedPurchase} 
        onClose={() => setSelectedPurchase(null)} 
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? '16px 16px 0 0' : 2,
            margin: isMobile ? 'auto 0 0 0' : 'auto',
            maxHeight: isMobile ? '60vh' : 'auto',
          }
        }}
      >
        {selectedPurchase && (
          <>
            <DialogTitle sx={{ 
              fontSize: { xs: '1rem', sm: '1.25rem' },
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              Purchase Details
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Invoice Number</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedPurchase.purchase_no}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">{formatDate(selectedPurchase.purchase_date)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error">
                    Rs. {Number(selectedPurchase.grand_total || 0).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                  <Chip 
                    size="small" 
                    color={selectedPurchase.payment_status === 'paid' ? 'success' : 'warning'} 
                    label={selectedPurchase.payment_status?.toUpperCase()} 
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPurchase(null)} variant="outlined" fullWidth>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* ==================== VIEW PAYMENT DETAILS DIALOG ==================== */}
      <Dialog 
        open={!!selectedPayment} 
        onClose={() => setSelectedPayment(null)} 
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? '16px 16px 0 0' : 2,
            margin: isMobile ? 'auto 0 0 0' : 'auto',
            maxHeight: isMobile ? '60vh' : 'auto',
          }
        }}
      >
        {selectedPayment && (
          <>
            <DialogTitle sx={{ 
              fontSize: { xs: '1rem', sm: '1.25rem' },
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              Payment Details
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Amount</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    Rs. {Number(selectedPayment.amount).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">{formatDate(selectedPayment.date)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Reference</Typography>
                  <Typography variant="body1">{selectedPayment.note || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPayment(null)} variant="outlined" fullWidth>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}