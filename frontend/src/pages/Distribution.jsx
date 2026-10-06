import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Fade, Alert, Snackbar,
  Stack, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme,
  Divider, Tooltip, Switch, Avatar, CardActions, FormControlLabel, Collapse,
  Badge, ButtonGroup, LinearProgress, Checkbox
} from '../components/ui/tailwind-mui';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error as ErrorIcon, TrendingUp,
  AccountBalanceWallet, Visibility, Close, ArrowUpward, ArrowDownward,
  Receipt, AttachMoney, MonetizationOn, CreditCard, LocalAtm, Print,
  CalendarToday, Delete, Edit, ReceiptLong, QrCode, VerifiedUser,
  DoneAll, PowerSettingsNew, VisibilityOff, ShoppingCart, Inventory,
  Restore, AssignmentInd, BarChart, AttachFile, Save, Add,
  AdminPanelSettings, Group, Remove, ExpandMore, ExpandLess,
  Category, PersonAdd, Description, FileDownload, PictureAsPdf,
  Calculate, MoneyOff, Redeem, PointOfSale, ShoppingBag, ArrowBack,
  MoreVert, Download, Storage, Build
} from '../components/ui/icons';
import db from '../database/db';
import UnifiedPagination from '../components/common/UnifiedPagination';
import { formatCleanId } from '../utils/receiptGenerator';

// ==================== HELPERS ====================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

/** Normalize date to YYYY-MM-DD for inputs and comparisons (matches DB logic) */
const toDateStr = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ==================== EXPORT HELPERS ====================
const exportToCSV = (data, filename, headers) => {
  if (!data || data.length === 0) return;
  const csvHeaders = headers || Object.keys(data[0]);
  const csvRows = [csvHeaders.join(',')];
  data.forEach(row => {
    const values = csvHeaders.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csvRows.push(values.join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
};

const exportToPDF = (title, headers, data) => {
  const printWindow = window.open('', '_blank');
  const rowsHtml = data.map(row =>
    `<tr>${headers.map(h => `<td>${row[h.key] ?? '-'}</td>`).join('')}</tr>`
  ).join('');
  const html = `<html><head><title>${title}</title>
  <style>
    @media print { @page { size: landscape; margin: 10mm; } }
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h2 { color: #6C63FF; margin-bottom: 5px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #6C63FF; color: white; padding: 10px; text-align: left; border: 1px solid #5a52d5; }
    td { padding: 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 30px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  </style></head><body>
  <h2>${title}</h2>
  <div class="meta">Generated: ${new Date().toLocaleString('en-GB')} | Records: ${data.length}</div>
  <table><thead><tr>${headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead>
  <tbody>${rowsHtml}</tbody></table>
  <div class="footer">Salesman & Distributor Management System</div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
  </body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
};

// ==================== MAIN COMPONENT ====================
export default function SalesmanDistributorModule() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Data States
  const [salesmen, setSalesmen] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [distributorOrdersList, setDistributorOrdersList] = useState([]);
  const [distributorPaymentsList, setDistributorPaymentsList] = useState([]);
  const [distributorReturnsList, setDistributorReturnsList] = useState([]);
  const [salesmanLedgerEntries, setSalesmanLedgerEntries] = useState([]);
  const [distributorLedgerEntries, setDistributorLedgerEntries] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [commissionPayouts, setCommissionPayouts] = useState([]);
  const [advancesList, setAdvancesList] = useState([]);
  const [pendingCommissions, setPendingCommissions] = useState([]);
  const [salesmanBalance, setSalesmanBalance] = useState({ balance: 0, total_debit: 0, total_credit: 0 });
  const [distributorBalance, setDistributorBalance] = useState({ balance: 0, total_debit: 0, total_credit: 0 });

  // FIXED: Return item selection states (was completely missing)
  const [returnSaleItems, setReturnSaleItems] = useState([]);
  const [returnOrderItems, setReturnOrderItems] = useState([]);

  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  // Form States
  const [salesmanDialog, setSalesmanDialog] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState(null);
  const [salesmanForm, setSalesmanForm] = useState({
    name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0],
    base_salary: 0, target_amount: 0, commission_percent: 0, status: 'active'
  });

  const [distributorDialog, setDistributorDialog] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState(null);
  const [distributorForm, setDistributorForm] = useState({
    name: '', company_name: '', phone: '', email: '', cnic: '', address: '', district: '', province: '', territory: '',
    opening_balance: 0, credit_limit: 0, payment_terms: 'cash', commission_percent: 0, status: 'active', notes: '',
    reference_name: '', reference_phone: ''
  });

  const [saleForm, setSaleForm] = useState({
    salesman_id: '', customer_id: '', customer_name: '', location: 'Main Branch',
    sale_date: new Date().toISOString().split('T')[0], status: 'Pending',
    payment_term: 0, payment_term_type: 'Days', discount_type: 'Fixed Amount',
    discount_value: 0, order_tax: 0, shipping_charges: 0, note: '', payment_mode: 'Cash'
  });
  const [cartItems, setCartItems] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});

  const [returnDialog, setReturnDialog] = useState(false);
  const [returnForm, setReturnForm] = useState({
    sale_id: '', refund_amount: 0, payment_mode: 'cash', notes: '', items: [],
    return_date: new Date().toISOString().split('T')[0]
  });

  const [salaryDialog, setSalaryDialog] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    salesman_id: '', month_year: '', base_salary: 0, bonus: 0, deduction: 0, advance_deducted: 0,
    paid_amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash', note: '', status: 'pending'
  });

  const [commissionDialog, setCommissionDialog] = useState(false);
  const [commissionForm, setCommissionForm] = useState({
    salesman_id: '', sale_id: '', commission_amount: 0, payout_amount: 0,
    payout_date: new Date().toISOString().split('T')[0], payment_mode: 'cash', note: '', status: 'pending'
  });

  const [advanceDialog, setAdvanceDialog] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    salesman_id: '', amount: 0, advance_type: 'salary', reason: '',
    given_date: new Date().toISOString().split('T')[0]
  });

  const [distributorOrderDialog, setDistributorOrderDialog] = useState(false);
  const [distOrderForm, setDistOrderForm] = useState({
    distributor_id: '', order_date: new Date().toISOString().split('T')[0], due_date: '',
    status: 'pending', total_amount: 0, discount_amount: 0, tax_amount: 0, shipping_charges: 0,
    grand_total: 0, paid_amount: 0, due_amount: 0, payment_status: 'due', payment_mode: 'cash', notes: '', items: []
  });
  const [distCartItems, setDistCartItems] = useState([]);

  const [distributorPaymentDialog, setDistributorPaymentDialog] = useState(false);
  const [distPaymentForm, setDistPaymentForm] = useState({
    distributor_id: '', order_id: '', amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash', cheque_no: '', cheque_date: '', cheque_status: 'pending',
    bank_name: '', note: '', receipt_no: ''
  });

  const [distributorReturnDialog, setDistributorReturnDialog] = useState(false);
  const [distReturnForm, setDistReturnForm] = useState({
    order_id: '', distributor_id: '', return_date: new Date().toISOString().split('T')[0],
    total_amount: 0, discount_amount: 0, tax_amount: 0, grand_total: 0, notes: '', items: []
  });

  // View Dialogs
  const [customerDialog, setCustomerDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);

  const [statsDialog, setStatsDialog] = useState(false);
  const [selectedStats, setSelectedStats] = useState(null);
  const [statsEntity, setStatsEntity] = useState(null);
  const [statsType, setStatsType] = useState('salesman');

  const [ledgerDialog, setLedgerDialog] = useState(false);
  const [ledgerTitle, setLedgerTitle] = useState('');

  const [saleDetailDialog, setSaleDetailDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const [distOrderDetailDialog, setDistOrderDetailDialog] = useState(false);
  const [selectedDistOrder, setSelectedDistOrder] = useState(null);

  // Filters
  const [reportFilter, setReportFilter] = useState({
    salesman_id: '', start_date: '', end_date: '', status: ''
  });
  const [distOrderFilter, setDistOrderFilter] = useState({
    distributor_id: '', status: '', payment_status: ''
  });
  const [distReturnFilter, setDistReturnFilter] = useState({
    distributor_id: '', order_id: ''
  });
  const [ledgerFilter, setLedgerFilter] = useState({ type: '', start_date: '', end_date: '' });
  const [selectedSalesmanForLedger, setSelectedSalesmanForLedger] = useState('');
  const [selectedDistributorForLedger, setSelectedDistributorForLedger] = useState('');
  const [payrollTab, setPayrollTab] = useState(0);
  const [salesReportPage, setSalesReportPage] = useState(1);
  const [salesReportRowsPerPage, setSalesReportRowsPerPage] = useState(25);
  const [distOrderPage, setDistOrderPage] = useState(1);
  const [distOrderRowsPerPage, setDistOrderRowsPerPage] = useState(25);
  const [distReturnPage, setDistReturnPage] = useState(1);
  const [distReturnRowsPerPage, setDistReturnRowsPerPage] = useState(25);

  // Snackbar helpers
  const showSuccess = (msg) => setSnackbar({ open: true, message: msg, severity: 'success' });
  const showError = (msg) => setSnackbar({ open: true, message: msg, severity: 'error' });
  const showInfo = (msg) => setSnackbar({ open: true, message: msg, severity: 'info' });

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const [salesmenData, salesData, productsWithCat, customersData, distributorsData] = await Promise.all([
        db.getAllSalesmen ? db.getAllSalesmen() : [],
        db.getSalesmanSales ? db.getSalesmanSales() : [],
        db.getProductsWithCategories ? db.getProductsWithCategories() : [],
        db.getCustomers ? db.getCustomers() : [],
        db.getAllDistributors ? db.getAllDistributors() : []
      ]);
      if (isMounted.current) {
        setSalesmen(salesmenData || []);
        setSalesList(salesData || []);
        setCustomers(customersData || []);
        setDistributors(distributorsData || []);
        if (productsWithCat && productsWithCat.length > 0) {
          setProductsData(productsWithCat);
          const expanded = {};
          productsWithCat.forEach(cat => { expanded[cat.category_id || 'uncategorized'] = true; });
          setExpandedCategories(expanded);
        }
      }
    } catch (err) {
      console.error('Load error:', err);
      if (isMounted.current) showError('Error loading data: ' + err.message);
    } finally {
      if (isMounted.current) setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // FIXED: Load distributor orders & returns on mount (was missing entirely)
  const loadDistributorData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const [orders, returns] = await Promise.all([
        db.getDistributorOrders ? db.getDistributorOrders() : [],
        db.getDistributorReturns ? db.getDistributorReturns() : []
      ]);
      if (isMounted.current) {
        setDistributorOrdersList(orders || []);
        setDistributorReturnsList(returns || []);
      }
    } catch (err) {
      console.error('Load distributor data error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    loadDistributorData();
    return () => { isMounted.current = false; };
  }, [loadData, loadDistributorData]);

  // FIXED: Reload distributor data when Tab 5 becomes active and empty
  useEffect(() => {
    if (activeTab === 5 && distributorOrdersList.length === 0) {
      loadDistributorData();
    }
  }, [activeTab, distributorOrdersList.length, loadDistributorData]);

  // ==================== SALESMAN CRUD ====================
  const handleSaveSalesman = async () => {
    if (!salesmanForm.name.trim()) { showError('Salesman Name is required!'); return; }
    setLoading(true);
    try {
      if (editingSalesman) {
        await db.updateSalesman(editingSalesman.id, salesmanForm);
        showSuccess('Salesman Updated Successfully!');
      } else {
        await db.addSalesman(salesmanForm);
        showSuccess('New Salesman Added!');
      }
      setSalesmanDialog(false);
      setEditingSalesman(null);
      setSalesmanForm({ name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0], base_salary: 0, target_amount: 0, commission_percent: 0, status: 'active' });
      await loadData();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteSalesman = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salesman?')) return;
    try { await db.deleteSalesman(id); showInfo('Salesman deleted.'); await loadData(); }
    catch (err) { showError(err.message); }
  };

  // ==================== SALE OPERATIONS ====================
  const handleAddToCart = useCallback((product) => {
    const price = parseFloat(product.retail_price || product.price || 0);
    const productName = product.product_name || product.name || 'Product';
    setCartItems(prev => {
      const existing = prev.find(p => p.variant_id === product.variant_id);
      if (existing) {
        return prev.map(p => p.variant_id === product.variant_id
          ? { ...p, qty: p.qty + 1, total: (p.qty + 1) * p.price } : p);
      }
      return [...prev, { variant_id: product.variant_id, product_id: product.id, product_name: productName, sku: product.sku || '', qty: 1, price, total: price }];
    });
  }, []);

  const updateCartQty = useCallback((variantId, newQty) => {
    if (newQty <= 0) { setCartItems(prev => prev.filter(p => p.variant_id !== variantId)); return; }
    setCartItems(prev => prev.map(p => p.variant_id === variantId ? { ...p, qty: newQty, total: newQty * p.price } : p));
  }, []);

  const resetSaleForm = useCallback(() => {
    setCartItems([]);
    setSaleForm({ salesman_id: '', customer_id: '', customer_name: '', location: 'Main Branch', sale_date: new Date().toISOString().split('T')[0], status: 'Pending', payment_term: 0, payment_term_type: 'Days', discount_type: 'Fixed Amount', discount_value: 0, order_tax: 0, shipping_charges: 0, note: '', payment_mode: 'Cash' });
  }, []);

  const handleSaveSale = async () => {
    if (cartItems.length === 0) { showError('Please add at least one product!'); return; }
    if (!saleForm.salesman_id) { showError('Please assign a Salesman!'); return; }
    setLoading(true);
    try {
      const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
      const discount = saleForm.discount_type === 'Fixed Amount'
        ? parseFloat(saleForm.discount_value || 0)
        : (subtotal * (parseFloat(saleForm.discount_value || 0) / 100));
      const afterDisc = Math.max(0, subtotal - discount);
      const tax = afterDisc * (parseFloat(saleForm.order_tax || 0) / 100);
      const shipping = parseFloat(saleForm.shipping_charges || 0);
      const grandTotal = afterDisc + tax + shipping;
      const salesman = salesmen.find(s => String(s.id) === String(saleForm.salesman_id));
      const commissionRate = salesman?.commission_percent || 0;
      // FIXED: Match DB calcCommission logic exactly — commission on (subtotal - discount), NOT grandTotal
      const commissionAmount = Math.max(0, afterDisc) * (commissionRate / 100);

      const saleData = {
        salesman_id: saleForm.salesman_id, customer_id: saleForm.customer_id || null,
        customer_name: saleForm.customer_name || '', location: saleForm.location,
        sale_date: saleForm.sale_date, status: saleForm.status,
        subtotal, discount, tax, shipping, grand_total: grandTotal,
        payment_mode: saleForm.payment_mode, payment_term: saleForm.payment_term,
        payment_term_type: saleForm.payment_term_type,
        paid_amount: 0, due_amount: grandTotal, note: saleForm.note,
        commission_amount: commissionAmount,
        items: cartItems.map(item => ({
          product_variant_id: item.variant_id, product_id: item.product_id,
          product_name: item.product_name, sku: item.sku,
          quantity: item.qty, price: item.price, total: item.total
        }))
      };
      await db.addSalesmanSale(saleData);

      // FIXED: Guard stock deduction — db.updateVariantStock does not exist in db-salesman-bulletproof.js
      if (db.updateVariantStock) {
        for (const item of cartItems) {
          try {
            await db.updateVariantStock(item.variant_id, -item.qty);
          } catch (err) {
            console.error('Stock deduction failed:', err);
            showError(`Stock error for ${item.product_name}: ${err.message}`);
          }
        }
      }

      showSuccess(`Sale Saved! Total: ${formatCurrency(grandTotal)} | Commission: ${formatCurrency(commissionAmount)}`);
      resetSaleForm();
      await loadData();
    } catch (err) { showError('Error saving sale: ' + err.message); }
    finally { setLoading(false); }
  };


  // ==================== RETURNS (FIXED: item-level returns) ====================
  const handleOpenReturn = async (sale) => {
    setReturnForm({
      sale_id: sale.id,
      refund_amount: sale.grand_total || 0,
      payment_mode: 'cash',
      notes: '',
      items: [],
      return_date: new Date().toISOString().split('T')[0]
    });
    // FIXED: Load sale items so user can select which items to return
    try {
      const detail = await db.getSalesmanSaleById(sale.id);
      if (detail && detail.items) {
        setReturnSaleItems(detail.items.map(it => ({
          ...it,
          return_qty: 0,
          return_price: it.price || 0,
          reason: '',
          selected: false
        })));
      } else {
        setReturnSaleItems([]);
      }
    } catch (e) {
      console.error('Failed to load sale items for return:', e);
      setReturnSaleItems([]);
    }
    setReturnDialog(true);
  };

  const handleSaveReturn = async () => {
    if (!returnForm.sale_id) return;
    // FIXED: Build items array from selected return items
    const selectedItems = returnSaleItems
      .filter(it => it.selected && it.return_qty > 0)
      .map(it => ({
        product_variant_id: it.product_variant_id,
        quantity: it.return_qty,
        price: it.return_price,
        sub_total: it.return_qty * it.return_price,
        reason: it.reason
      }));

    // Auto-calculate refund from items if user hasn't overridden
    const itemsTotal = selectedItems.reduce((s, it) => s + it.sub_total, 0);
    const refundAmt = parseFloat(returnForm.refund_amount) || itemsTotal;

    setLoading(true);
    try {
      await db.addSalesmanSaleReturn({
        ...returnForm,
        refund_amount: refundAmt,
        items: selectedItems
      });
      showSuccess('Return processed successfully!');
      setReturnDialog(false);
      setReturnSaleItems([]);
      await loadData();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== SALARY ====================
  const handleSaveSalary = async () => {
    if (!salaryForm.salesman_id || !salaryForm.month_year) { showError('Salesman and Month-Year are required!'); return; }
    setLoading(true);
    try {
      await db.addSalesmanSalaryPayment(salaryForm);
      showSuccess('Salary payment recorded!');
      setSalaryDialog(false);
      setSalaryForm({ salesman_id: '', month_year: '', base_salary: 0, bonus: 0, deduction: 0, advance_deducted: 0, paid_amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash', note: '', status: 'pending' });
      if (selectedSalesmanForLedger) await loadSalesmanLedgerData(selectedSalesmanForLedger);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== COMMISSION ====================
  const handleSaveCommission = async () => {
    if (!commissionForm.salesman_id) { showError('Salesman is required!'); return; }
    setLoading(true);
    try {
      await db.addCommissionPayout(commissionForm);
      showSuccess('Commission payout recorded!');
      setCommissionDialog(false);
      setCommissionForm({ salesman_id: '', sale_id: '', commission_amount: 0, payout_amount: 0, payout_date: new Date().toISOString().split('T')[0], payment_mode: 'cash', note: '', status: 'pending' });
      if (selectedSalesmanForLedger) await loadSalesmanLedgerData(selectedSalesmanForLedger);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== ADVANCES ====================
  const handleSaveAdvance = async () => {
    if (!advanceForm.salesman_id || !advanceForm.amount) { showError('Salesman and Amount are required!'); return; }
    setLoading(true);
    try {
      await db.addSalesmanAdvance(advanceForm);
      showSuccess('Advance recorded!');
      setAdvanceDialog(false);
      setAdvanceForm({ salesman_id: '', amount: 0, advance_type: 'salary', reason: '', given_date: new Date().toISOString().split('T')[0] });
      if (selectedSalesmanForLedger) await loadSalesmanLedgerData(selectedSalesmanForLedger);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  const handleRepayAdvance = async (advanceId, amount) => {
    if (!amount || amount <= 0) { showError('Enter valid repayment amount'); return; }
    try {
      await db.repayAdvance(advanceId, amount);
      showSuccess('Advance repayment recorded!');
      if (selectedSalesmanForLedger) await loadSalesmanLedgerData(selectedSalesmanForLedger);
    } catch (err) { showError(err.message); }
  };

  // ==================== LEDGER ====================
  const loadSalesmanLedgerData = async (salesmanId, filters = {}) => {
    if (!salesmanId) return;
    setLoading(true);
    try {
      const [entries, balance, salaries, commissions, advances, pending] = await Promise.all([
        db.getSalesmanLedger ? db.getSalesmanLedger(salesmanId, filters) : [],
        db.getSalesmanBalance ? db.getSalesmanBalance(salesmanId) : { balance: 0, total_debit: 0, total_credit: 0 },
        db.getSalesmanSalaryPayments ? db.getSalesmanSalaryPayments(salesmanId) : [],
        db.getCommissionPayouts ? db.getCommissionPayouts(salesmanId) : [],
        db.getSalesmanAdvances ? db.getSalesmanAdvances(salesmanId) : [],
        db.getPendingCommissions ? db.getPendingCommissions(salesmanId) : []
      ]);
      if (isMounted.current) {
        setSalesmanLedgerEntries(entries || []);
        setSalesmanBalance(balance || { balance: 0, total_debit: 0, total_credit: 0 });
        setSalaryPayments(salaries || []);
        setCommissionPayouts(commissions || []);
        setAdvancesList(advances || []);
        setPendingCommissions(pending || []);
      }
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  const loadDistributorLedgerData = async (distributorId, filters = {}) => {
    if (!distributorId) return;
    setLoading(true);
    try {
      const [entries, balance] = await Promise.all([
        db.getDistributorLedger ? db.getDistributorLedger(distributorId, filters) : [],
        db.getDistributorBalance ? db.getDistributorBalance(distributorId) : { balance: 0, total_debit: 0, total_credit: 0 }
      ]);
      if (isMounted.current) {
        setDistributorLedgerEntries(entries || []);
        setDistributorBalance(balance || { balance: 0, total_debit: 0, total_credit: 0 });
      }
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== CUSTOMER ====================
  const handleViewCustomer = async (customerId) => {
    setLoading(true);
    try {
      const [history, stats] = await Promise.all([
        db.getCustomerSalesHistory ? db.getCustomerSalesHistory(customerId) : [],
        db.getCustomerTotalStats ? db.getCustomerTotalStats(customerId) : null
      ]);
      if (isMounted.current) {
        setCustomerHistory(history || []);
        setCustomerStats(stats || null);
        const customer = customers.find(c => String(c.id) === String(customerId));
        setSelectedCustomer(customer || null);
        setCustomerDialog(true);
      }
    } catch (err) { showError(err.message); }
    finally { if (isMounted.current) setLoading(false); }
  };

  // ==================== DISTRIBUTOR CRUD ====================
  const handleSaveDistributor = async () => {
    if (!distributorForm.name.trim()) { showError('Distributor Name is required!'); return; }
    setLoading(true);
    try {
      if (editingDistributor) {
        await db.updateDistributor(editingDistributor.id, distributorForm);
        showSuccess('Distributor Updated!');
      } else {
        await db.addDistributor(distributorForm);
        showSuccess('Distributor Added!');
      }
      setDistributorDialog(false);
      setEditingDistributor(null);
      setDistributorForm({ name: '', company_name: '', phone: '', email: '', cnic: '', address: '', district: '', province: '', territory: '', opening_balance: 0, credit_limit: 0, payment_terms: 'cash', commission_percent: 0, status: 'active', notes: '', reference_name: '', reference_phone: '' });
      await loadData();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteDistributor = async (id) => {
    if (!window.confirm('Delete this distributor?')) return;
    try { await db.deleteDistributor(id); showInfo('Distributor deleted.'); await loadData(); }
    catch (err) { showError(err.message); }
  };


  // ==================== DISTRIBUTOR ORDERS (FIXED: tax amount) ====================
  const handleAddDistProductToCart = useCallback((product) => {
    const price = parseFloat(product.retail_price || product.price || 0);
    const name = product.product_name || product.name || 'Product';
    setDistCartItems(prev => {
      const existing = prev.find(p => p.variant_id === product.variant_id);
      if (existing) {
        return prev.map(p => p.variant_id === product.variant_id
          ? { ...p, qty: p.qty + 1, total: (p.qty + 1) * p.price } : p);
      }
      return [...prev, { variant_id: product.variant_id, product_id: product.id, product_name: name, sku: product.sku || '', qty: 1, price, total: price }];
    });
  }, []);

  const updateDistCartQty = useCallback((variantId, newQty) => {
    if (newQty <= 0) { setDistCartItems(prev => prev.filter(p => p.variant_id !== variantId)); return; }
    setDistCartItems(prev => prev.map(p => p.variant_id === variantId ? { ...p, qty: newQty, total: newQty * p.price } : p));
  }, []);

  const distOrderCalculations = useMemo(() => {
    const subtotal = distCartItems.reduce((s, i) => s + i.total, 0);
    const discount = parseFloat(distOrderForm.discount_amount || 0);
    const tax = (subtotal - discount) * (parseFloat(distOrderForm.tax_amount || 0) / 100);
    const shipping = parseFloat(distOrderForm.shipping_charges || 0);
    const grandTotal = Math.max(0, subtotal - discount + tax + shipping);
    return { subtotal, discount, tax, shipping, grandTotal };
  }, [distCartItems, distOrderForm.discount_amount, distOrderForm.tax_amount, distOrderForm.shipping_charges]);

  const handleSaveDistributorOrder = async () => {
    if (distCartItems.length === 0) { showError('Add at least one product!'); return; }
    if (!distOrderForm.distributor_id) { showError('Select a distributor!'); return; }
    setLoading(true);
    try {
      const { grandTotal, subtotal, tax } = distOrderCalculations;
      const orderData = {
        ...distOrderForm,
        total_amount: subtotal,
        grand_total: grandTotal,
        due_amount: grandTotal,
        // FIXED: Send calculated tax amount, not raw percentage
        tax_amount: tax,
        items: distCartItems.map(item => ({
          product_variant_id: item.variant_id, product_name: item.product_name,
          sku: item.sku, quantity: item.qty, price: item.price, discount: 0, total: item.total
        }))
      };
      await db.addDistributorOrder(orderData);
      showSuccess(`Distributor Order Saved! Total: ${formatCurrency(grandTotal)}`);
      setDistributorOrderDialog(false);
      setDistCartItems([]);
      setDistOrderForm({ distributor_id: '', order_date: new Date().toISOString().split('T')[0], due_date: '', status: 'pending', total_amount: 0, discount_amount: 0, tax_amount: 0, shipping_charges: 0, grand_total: 0, paid_amount: 0, due_amount: 0, payment_status: 'due', payment_mode: 'cash', notes: '', items: [] });
      const orders = await db.getDistributorOrders ? db.getDistributorOrders() : [];
      setDistributorOrdersList(orders || []);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== DISTRIBUTOR PAYMENTS (FIXED: reset before load bug) ====================
  const handleSaveDistributorPayment = async () => {
    if (!distPaymentForm.distributor_id || !distPaymentForm.amount) { showError('Distributor and Amount required!'); return; }
    setLoading(true);
    try {
      // FIXED: Save distributor ID before resetting form
      const distId = distPaymentForm.distributor_id;
      await db.addDistributorPayment(distPaymentForm);
      showSuccess('Payment recorded successfully!');
      setDistributorPaymentDialog(false);
      setDistPaymentForm({ distributor_id: '', order_id: '', amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash', cheque_no: '', cheque_date: '', cheque_status: 'pending', bank_name: '', note: '', receipt_no: '' });
      // FIXED: Use saved distId instead of reset form state
      const payments = await db.getDistributorPayments ? db.getDistributorPayments(distId) : [];
      setDistributorPaymentsList(payments || []);
      await loadData();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== DISTRIBUTOR RETURNS (FIXED: item-level returns) ====================
  const handleSaveDistributorReturn = async () => {
    if (!distReturnForm.order_id) { showError('Order ID is required!'); return; }
    // FIXED: Build items from selected return order items
    const selectedItems = returnOrderItems
      .filter(it => it.selected && it.return_qty > 0)
      .map(it => ({
        product_variant_id: it.product_variant_id,
        quantity: it.return_qty,
        return_price: it.return_price,
        sub_total: it.return_qty * it.return_price,
        reason: it.reason
      }));

    setLoading(true);
    try {
      await db.addDistributorReturn({
        ...distReturnForm,
        items: selectedItems
      });
      showSuccess('Distributor return processed!');
      setDistributorReturnDialog(false);
      setDistReturnForm({ order_id: '', distributor_id: '', return_date: new Date().toISOString().split('T')[0], total_amount: 0, discount_amount: 0, tax_amount: 0, grand_total: 0, notes: '', items: [] });
      setReturnOrderItems([]);
      const returns = await db.getDistributorReturns ? db.getDistributorReturns() : [];
      setDistributorReturnsList(returns || []);
      await loadData();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ==================== STATS ====================
  const handleViewSalesmanStats = async (salesmanId) => {
    setLoading(true);
    try {
      const stats = await db.getSalesmanStats(salesmanId);
      const salesman = salesmen.find(s => String(s.id) === String(salesmanId));
      if (isMounted.current) {
        setSelectedStats(stats || { stats: {}, monthly: [], target: {} });
        setStatsEntity(salesman || null);
        setStatsType('salesman');
        setStatsDialog(true);
      }
    } catch (err) { showError(err.message); }
    finally { if (isMounted.current) setLoading(false); }
  };

  const handleViewDistributorStats = async (distributorId) => {
    setLoading(true);
    try {
      const stats = await db.getDistributorStats(distributorId);
      const distributor = distributors.find(d => String(d.id) === String(distributorId));
      if (isMounted.current) {
        setSelectedStats(stats || {});
        setStatsEntity(distributor || null);
        setStatsType('distributor');
        setStatsDialog(true);
      }
    } catch (err) { showError(err.message); }
    finally { if (isMounted.current) setLoading(false); }
  };

  // ==================== SALE DETAIL ====================
  const handleViewSaleDetail = async (sale) => {
    try {
      const detail = await db.getSalesmanSaleById ? db.getSalesmanSaleById(sale.id) : sale;
      setSelectedSale(detail || sale);
      setSaleDetailDialog(true);
    } catch (err) { showError(err.message); }
  };

  // ==================== CALCULATIONS (FIXED: commission matches DB) ====================
  const saleCalculations = useMemo(() => {
    const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
    const discount = saleForm.discount_type === 'Fixed Amount'
      ? parseFloat(saleForm.discount_value || 0)
      : (subtotal * (parseFloat(saleForm.discount_value || 0) / 100));
    const afterDisc = Math.max(0, subtotal - discount);
    const tax = afterDisc * (parseFloat(saleForm.order_tax || 0) / 100);
    const shipping = parseFloat(saleForm.shipping_charges || 0);
    const grandTotal = afterDisc + tax + shipping;
    const salesman = salesmen.find(s => String(s.id) === String(saleForm.salesman_id));
    const commissionRate = salesman?.commission_percent || 0;
    // FIXED: DB calcCommission uses (subtotal - discount) only, excluding tax & shipping
    const commissionAmount = Math.max(0, afterDisc) * (commissionRate / 100);
    return { subtotal, discount, tax, shipping, grandTotal, commissionRate, commissionAmount };
  }, [cartItems, saleForm.discount_type, saleForm.discount_value, saleForm.order_tax, saleForm.shipping_charges, saleForm.salesman_id, salesmen]);

  // ==================== FILTERED DATA (FIXED: date string comparison + is_deleted) ====================
  const filteredSales = useMemo(() => {
    let data = salesList.filter(x => !x.is_deleted);
    if (reportFilter.salesman_id) data = data.filter(s => String(s.salesman_id) === String(reportFilter.salesman_id));
    // FIXED: Use string comparison instead of new Date() timestamp to avoid timezone off-by-one
    if (reportFilter.start_date) data = data.filter(s => (s.sale_date || '') >= reportFilter.start_date);
    if (reportFilter.end_date) data = data.filter(s => (s.sale_date || '') <= reportFilter.end_date);
    if (reportFilter.status) data = data.filter(s => s.status === reportFilter.status);
    return data;
  }, [salesList, reportFilter]);

  const filteredDistOrders = useMemo(() => {
    let data = distributorOrdersList.filter(x => !x.is_deleted);
    if (distOrderFilter.distributor_id) data = data.filter(o => String(o.distributor_id) === String(distOrderFilter.distributor_id));
    if (distOrderFilter.status) data = data.filter(o => o.status === distOrderFilter.status);
    if (distOrderFilter.payment_status) data = data.filter(o => o.payment_status === distOrderFilter.payment_status);
    return data;
  }, [distributorOrdersList, distOrderFilter]);

  const filteredDistReturns = useMemo(() => {
    let data = distributorReturnsList.filter(x => !x.is_deleted);
    if (distReturnFilter.distributor_id) data = data.filter(r => String(r.distributor_id) === String(distReturnFilter.distributor_id));
    if (distReturnFilter.order_id) data = data.filter(r => String(r.order_id) === String(distReturnFilter.order_id));
    return data;
  }, [distributorReturnsList, distReturnFilter]);

  const paginatedReportSales = useMemo(() => {
    const start = (salesReportPage - 1) * salesReportRowsPerPage;
    return filteredSales.slice(start, start + salesReportRowsPerPage);
  }, [filteredSales, salesReportPage, salesReportRowsPerPage]);

  const paginatedDistOrders = useMemo(() => {
    const start = (distOrderPage - 1) * distOrderRowsPerPage;
    return filteredDistOrders.slice(start, start + distOrderRowsPerPage);
  }, [filteredDistOrders, distOrderPage, distOrderRowsPerPage]);

  const paginatedDistReturns = useMemo(() => {
    const start = (distReturnPage - 1) * distReturnRowsPerPage;
    return filteredDistReturns.slice(start, start + distReturnRowsPerPage);
  }, [filteredDistReturns, distReturnPage, distReturnRowsPerPage]);

  // ==================== TOGGLE CATEGORY ====================
  const toggleCategory = useCallback((catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  // ==================== TAB LABELS ====================
  const tabs = [
    { icon: <Group />, label: isMobile ? 'Team' : 'Salesmen' },
    { icon: <ShoppingCart />, label: isMobile ? 'Sale' : 'New Sale' },
    { icon: <BarChart />, label: isMobile ? 'Report' : 'Sales Report' },
    { icon: <AccountBalanceWallet />, label: isMobile ? 'Ledger' : 'Ledger & Payroll' },
    { icon: <Store />, label: isMobile ? 'Dist' : 'Distributors' },
    { icon: <Inventory />, label: isMobile ? 'Orders' : 'Dist. Orders' }
  ];


  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3, bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      {/* HEADER */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: '#6C63FF', width: 40, height: 40 }}><AssignmentInd /></Avatar>
            <Box>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="#1a1a1a">Salesman & Distributor Module</Typography>
              <Typography variant="caption" color="text.secondary">Manage field team, track sales, generate payroll & distributor insights.</Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingSalesman(null); setSalesmanForm({ name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0], base_salary: 0, target_amount: 0, commission_percent: 0, status: 'active' }); setSalesmanDialog(true); }} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }}>
              Add Salesman
            </Button>
            <Button variant="outlined" startIcon={<Store />} onClick={() => { setEditingDistributor(null); setDistributorForm({ name: '', company_name: '', phone: '', email: '', cnic: '', address: '', district: '', province: '', territory: '', opening_balance: 0, credit_limit: 0, payment_terms: 'cash', commission_percent: 0, status: 'active', notes: '', reference_name: '', reference_phone: '' }); setDistributorDialog(true); }} sx={{ borderColor: '#6C63FF', color: '#6C63FF' }}>
              Add Distributor
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* TABS */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto" centered={!isMobile}
          sx={{ bgcolor: 'white', '& .MuiTab-root': { fontWeight: 600, fontSize: isMobile ? '0.7rem' : '0.85rem', py: 1.5, minHeight: 48 }, '& .Mui-selected': { color: '#6C63FF' }, '& .MuiTabs-indicator': { bgcolor: '#6C63FF' } }}>
          {tabs.map((t, i) => <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />)}
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: SALESMEN ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Grid container spacing={2}>
              {salesmen.filter(sm => !sm.is_deleted).map((sm) => (
                <Grid item xs={12} sm={6} md={4} key={sm.id}>
                  <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: sm.status === 'active' ? '#10b981' : '#9ca3af', width: 45, height: 45 }}>{sm.name?.charAt(0)}</Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">{sm.name}</Typography>
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}><Phone sx={{ fontSize: 14 }} /> {sm.phone || 'N/A'}</Typography>
                            <Chip size="small" label={sm.status === 'active' ? 'Active' : 'Inactive'} color={sm.status === 'active' ? 'success' : 'default'} sx={{ height: 18, fontSize: '0.5rem', mt: 0.5 }} />
                          </Box>
                        </Box>
                        <Tooltip title="View Stats"><IconButton size="small" color="primary" onClick={() => handleViewSalesmanStats(sm.id)}><BarChart fontSize="small" /></IconButton></Tooltip>
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">CNIC</Typography>
                        <Typography variant="caption" fontWeight={500}>{sm.cnic || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Joining</Typography>
                        <Typography variant="caption" fontWeight={500}>{formatDate(sm.joining_date)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Base Salary</Typography>
                        <Typography variant="caption" fontWeight="bold">{formatCurrency(sm.base_salary)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Target</Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary">{formatCurrency(sm.target_amount)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Commission</Typography>
                        <Typography variant="caption" fontWeight="bold" color="success.main">{sm.commission_percent || 0}%</Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
                      <Tooltip title="View Ledger"><IconButton size="small" color="info" onClick={() => { setSelectedSalesmanForLedger(sm.id); loadSalesmanLedgerData(sm.id); setActiveTab(3); }}><AccountBalanceWallet fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" color="primary" onClick={() => {
                        // FIXED: Normalize date to YYYY-MM-DD for input type="date"
                        setEditingSalesman(sm);
                        setSalesmanForm({
                          ...sm,
                          joining_date: toDateStr(sm.joining_date) || new Date().toISOString().split('T')[0],
                          base_salary: sm.base_salary || 0,
                          target_amount: sm.target_amount || 0,
                          commission_percent: sm.commission_percent || 0
                        });
                        setSalesmanDialog(true);
                      }}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteSalesman(sm.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              {salesmen.filter(sm => !sm.is_deleted).length === 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '2px dashed #e5e7eb' }}>
                    <Group sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>No salesmen added yet. Click "Add Salesman" to get started.</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: ADD NEW SALE ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Paper sx={{ p: isMobile ? 2 : 4, borderRadius: 2, bgcolor: 'white' }}>
            <Typography variant="h6" fontWeight="bold" color="#1a1a1a" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt sx={{ color: '#6C63FF' }} /> Add New Sale
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Salesman *</InputLabel>
                  <Select value={saleForm.salesman_id} onChange={(e) => setSaleForm({...saleForm, salesman_id: e.target.value})} label="Select Salesman *">
                    <MenuItem value="">Select...</MenuItem>
                    {salesmen.filter(s => s.status === 'active').map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Customer</InputLabel>
                  <Select value={saleForm.customer_id} onChange={(e) => { const c = customers.find(x => String(x.id) === String(e.target.value)); setSaleForm({...saleForm, customer_id: e.target.value, customer_name: c?.name || ''}); }} label="Customer">
                    <MenuItem value="">Walk-in Customer</MenuItem>
                    {customers.filter(c => !c.is_deleted).map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Customer Name" value={saleForm.customer_name} onChange={(e) => setSaleForm({...saleForm, customer_name: e.target.value})} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Location" value={saleForm.location} onChange={(e) => setSaleForm({...saleForm, location: e.target.value})} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="date" label="Sale Date" value={saleForm.sale_date} onChange={(e) => setSaleForm({...saleForm, sale_date: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
                  <Select value={saleForm.status} onChange={(e) => setSaleForm({...saleForm, status: e.target.value})} label="Status">
                    <MenuItem value="Pending">Pending</MenuItem><MenuItem value="Completed">Completed</MenuItem><MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel>
                  <Select value={saleForm.payment_mode} onChange={(e) => setSaleForm({...saleForm, payment_mode: e.target.value})} label="Payment Mode">
                    <MenuItem value="Cash">Cash</MenuItem><MenuItem value="Bank">Bank Transfer</MenuItem><MenuItem value="Credit">Credit</MenuItem><MenuItem value="Cheque">Cheque</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Payment Term (Days)" value={saleForm.payment_term} onChange={(e) => setSaleForm({...saleForm, payment_term: e.target.value})} /></Grid>

              {/* Product Categories */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Category sx={{ color: '#6C63FF' }} /> Select Products by Category
                </Typography>
                {productsData.map((category) => (
                  <Card key={category.category_id || 'uncategorized'} variant="outlined" sx={{ mb: 1, borderColor: '#e5e7eb' }}>
                    <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: expandedCategories[category.category_id || 'uncategorized'] ? '#f0f0ff' : 'white', '&:hover': { bgcolor: '#f5f5ff' } }} onClick={() => toggleCategory(category.category_id || 'uncategorized')}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Category sx={{ color: '#6C63FF' }} />
                        <Typography variant="subtitle2" fontWeight="bold">{category.category_name}</Typography>
                        <Chip size="small" label={`${category.products?.length || 0} products`} color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
                      </Box>
                      {expandedCategories[category.category_id || 'uncategorized'] ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                    <Collapse in={expandedCategories[category.category_id || 'uncategorized']}>
                      <Divider />
                      <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {category.products?.map((product) => (
                          <Chip key={product.variant_id || product.id} label={`${product.product_name || product.name} ${product.sku ? `(${product.sku})` : ''} - ${formatCurrency(product.retail_price || product.price || 0)}`} onClick={() => handleAddToCart(product)} icon={<Add fontSize="small" />} color="primary" variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#6C63FF', color: 'white' }, transition: 'all 0.2s' }} />
                        ))}
                        {(!category.products || category.products.length === 0) && <Typography variant="caption" color="text.secondary">No products in this category</Typography>}
                      </Box>
                    </Collapse>
                  </Card>
                ))}
                {productsData.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No products found. Please add products first.</Typography>}
              </Grid>

              {/* Cart Table */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingCart sx={{ color: '#6C63FF' }} /> Cart ({cartItems.length} items)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #e5e7eb' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Qty</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Price</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cartItems.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{item.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => updateCartQty(item.variant_id, item.qty - 1)}><Remove fontSize="small" /></IconButton>
                            <Typography component="span" sx={{ mx: 1, fontWeight: 'bold', minWidth: 20, display: 'inline-block', textAlign: 'center' }}>{item.qty}</Typography>
                            <IconButton size="small" onClick={() => updateCartQty(item.variant_id, item.qty + 1)}><Add fontSize="small" /></IconButton>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                          <TableCell align="right" fontWeight="bold">{formatCurrency(item.total)}</TableCell>
                          <TableCell align="center"><IconButton size="small" color="error" onClick={() => updateCartQty(item.variant_id, 0)}><Delete fontSize="small" /></IconButton></TableCell>
                        </TableRow>
                      ))}
                      {cartItems.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>Click on products above to add to cart.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Discounts & Charges */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small"><InputLabel>Discount Type</InputLabel>
                  <Select value={saleForm.discount_type} onChange={(e) => setSaleForm({...saleForm, discount_type: e.target.value})} label="Discount Type">
                    <MenuItem value="Fixed Amount">Fixed Amount</MenuItem><MenuItem value="Percentage">Percentage</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Discount Value" value={saleForm.discount_value} onChange={(e) => setSaleForm({...saleForm, discount_value: e.target.value})} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Tax (%)" value={saleForm.order_tax} onChange={(e) => setSaleForm({...saleForm, order_tax: e.target.value})} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" type="number" label="Shipping Charges" value={saleForm.shipping_charges} onChange={(e) => setSaleForm({...saleForm, shipping_charges: e.target.value})} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" multiline rows={2} label="Additional Notes" value={saleForm.note} onChange={(e) => setSaleForm({...saleForm, note: e.target.value})} /></Grid>

              {/* Order Summary */}
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ bgcolor: '#f8f9fa', borderColor: '#e5e7eb' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BarChart sx={{ color: '#6C63FF' }} /> Order Summary
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                        <Typography variant="h6" fontWeight="bold">{formatCurrency(saleCalculations.subtotal)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Discount</Typography>
                        <Typography variant="h6" fontWeight="bold" color="error.main">- {formatCurrency(saleCalculations.discount)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Tax</Typography>
                        <Typography variant="h6" fontWeight="bold">+ {formatCurrency(saleCalculations.tax)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Shipping</Typography>
                        <Typography variant="h6" fontWeight="bold">+ {formatCurrency(saleCalculations.shipping)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120, borderTop: '2px solid #6C63FF', pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">Commission ({saleCalculations.commissionRate}%)</Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(saleCalculations.commissionAmount)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 150, borderTop: '2px solid #6C63FF', pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">Total Payable</Typography>
                        <Typography variant="h5" fontWeight="bold" color="#6C63FF">{formatCurrency(saleCalculations.grandTotal)}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                  <Button variant="outlined" color="error" onClick={resetSaleForm}>Cancel</Button>
                  <Button variant="contained" onClick={handleSaveSale} disabled={loading || cartItems.length === 0} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }}>
                    {loading ? 'Saving...' : 'Save Sale'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Fade>
      )}

      {/* ==================== TAB 2: SALES REPORT ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small"><InputLabel>Filter by Salesman</InputLabel>
                    <Select value={reportFilter.salesman_id} onChange={(e) => setReportFilter({...reportFilter, salesman_id: e.target.value})} label="Filter by Salesman">
                      <MenuItem value="">All Salesmen</MenuItem>
                      {salesmen.filter(s => !s.is_deleted).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={2}><TextField fullWidth size="small" type="date" label="From" value={reportFilter.start_date} onChange={(e) => setReportFilter({...reportFilter, start_date: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={6} sm={3} md={2}><TextField fullWidth size="small" type="date" label="To" value={reportFilter.end_date} onChange={(e) => setReportFilter({...reportFilter, end_date: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
                    <Select value={reportFilter.status} onChange={(e) => setReportFilter({...reportFilter, status: e.target.value})} label="Status">
                      <MenuItem value="">All Statuses</MenuItem><MenuItem value="Pending">Pending</MenuItem><MenuItem value="Completed">Completed</MenuItem><MenuItem value="Cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={9} md={3} sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  <Button variant="outlined" size="small" onClick={() => setReportFilter({ salesman_id: '', start_date: '', end_date: '', status: '' })} startIcon={<Refresh />} sx={{ height: 40, px: 2 }}>Clear</Button>
                  <Tooltip title="Export CSV"><IconButton size="small" color="primary" onClick={() => exportToCSV(filteredSales, 'sales_report.csv')}><FileDownload /></IconButton></Tooltip>
                  <Tooltip title="Export PDF"><IconButton size="small" color="error" onClick={() => exportToPDF('Sales Report', [{key:'invoice_no',label:'Invoice'},{key:'sale_date',label:'Date'},{key:'salesman_name',label:'Salesman'},{key:'customer_name',label:'Customer'},{key:'status',label:'Status'},{key:'payment_mode',label:'Payment'},{key:'grand_total',label:'Total'},{key:'commission_amount',label:'Commission'}], filteredSales)}><PictureAsPdf /></IconButton></Tooltip>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Salesman</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Subtotal</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Commission</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales found for the selected filters.</TableCell></TableRow>
                    ) : (
                      paginatedReportSales.map((sale) => {
                        const salesman = salesmen.find(s => String(s.id) === String(sale.salesman_id));
                        return (
                          <TableRow key={sale.id} hover>
                            <TableCell fontWeight="bold">{sale.invoice_no || `#${sale.id}`}</TableCell>
                            <TableCell>{formatDate(sale.sale_date)}</TableCell>
                            <TableCell>{salesman?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {sale.customer_name || sale.customer_name_full || 'Walk-in'}
                                {sale.customer_id && <IconButton size="small" onClick={() => handleViewCustomer(sale.customer_id)}><Visibility fontSize="small" /></IconButton>}
                              </Box>
                            </TableCell>
                            <TableCell><Chip size="small" label={sale.status} color={sale.status === 'Completed' ? 'success' : sale.status === 'Pending' ? 'warning' : 'error'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                            <TableCell><Chip size="small" label={sale.payment_mode || 'Cash'} variant="outlined" sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                            <TableCell align="right">{formatCurrency(sale.subtotal)}</TableCell>
                            <TableCell align="right" fontWeight="bold">{formatCurrency(sale.grand_total)}</TableCell>
                            <TableCell align="right" color="success.main">{formatCurrency(sale.commission_amount)}</TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Details"><IconButton size="small" color="primary" onClick={() => handleViewSaleDetail(sale)}><Visibility fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Process Return"><IconButton size="small" color="warning" onClick={() => handleOpenReturn(sale)}><Restore fontSize="small" /></IconButton></Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={filteredSales.length}
                page={salesReportPage}
                rowsPerPage={salesReportRowsPerPage}
                onPageChange={setSalesReportPage}
                onRowsPerPageChange={(r) => {
                  setSalesReportRowsPerPage(r);
                  setSalesReportPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
              <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">Total Sales: {formatCurrency(filteredSales.reduce((s, i) => s + (i.grand_total || 0), 0))} ({filteredSales.length} Invoices)</Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main">Total Commission: {formatCurrency(filteredSales.reduce((s, i) => s + (i.commission_amount || 0), 0))}</Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="error.main">Total Due: {formatCurrency(filteredSales.reduce((s, i) => s + (i.due_amount || 0), 0))}</Typography>
              </Box>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 3: LEDGER & PAYROLL ==================== */}
      {activeTab === 3 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small"><InputLabel>Select Salesman</InputLabel>
                    <Select value={selectedSalesmanForLedger} onChange={(e) => { setSelectedSalesmanForLedger(e.target.value); if (e.target.value) loadSalesmanLedgerData(e.target.value); }} label="Select Salesman">
                      <MenuItem value="">Choose Salesman...</MenuItem>
                      {salesmen.filter(s => !s.is_deleted).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                {selectedSalesmanForLedger && (
                  <>
                    <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" label="From" value={ledgerFilter.start_date} onChange={(e) => { setLedgerFilter({...ledgerFilter, start_date: e.target.value}); loadSalesmanLedgerData(selectedSalesmanForLedger, {...ledgerFilter, start_date: e.target.value}); }} InputLabelProps={{ shrink: true }} /></Grid>
                    <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" label="To" value={ledgerFilter.end_date} onChange={(e) => { setLedgerFilter({...ledgerFilter, end_date: e.target.value}); loadSalesmanLedgerData(selectedSalesmanForLedger, {...ledgerFilter, end_date: e.target.value}); }} InputLabelProps={{ shrink: true }} /></Grid>
                    <Grid item xs={6} md={2}>
                      <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
                        <Select value={ledgerFilter.type} onChange={(e) => { setLedgerFilter({...ledgerFilter, type: e.target.value}); loadSalesmanLedgerData(selectedSalesmanForLedger, {...ledgerFilter, type: e.target.value}); }} label="Type">
                          <MenuItem value="">All</MenuItem><MenuItem value="sale_credit">Sale Credit</MenuItem><MenuItem value="salary">Salary</MenuItem><MenuItem value="commission">Commission</MenuItem><MenuItem value="advance">Advance</MenuItem><MenuItem value="advance_repayment">Advance Repay</MenuItem><MenuItem value="deduction">Deduction</MenuItem><MenuItem value="bonus">Bonus</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Stack direction="row" spacing={0.5}>
                        <Button variant="outlined" size="small" onClick={() => { setLedgerFilter({ type: '', start_date: '', end_date: '' }); loadSalesmanLedgerData(selectedSalesmanForLedger, {}); }} startIcon={<Refresh />}>Reset</Button>
                        <Tooltip title="Export CSV"><IconButton size="small" color="primary" onClick={() => exportToCSV(salesmanLedgerEntries, 'salesman_ledger.csv')}><FileDownload /></IconButton></Tooltip>
                      </Stack>
                    </Grid>
                  </>
                )}
              </Grid>
            </Paper>

            {selectedSalesmanForLedger && (
              <>
                {/* Balance Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Total Debit</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(salesmanBalance.total_debit)}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Total Credit</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(salesmanBalance.total_credit)}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Net Balance</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(salesmanBalance.balance)}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Salesman</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#1c2580">{salesmen.find(s => String(s.id) === String(selectedSalesmanForLedger))?.name || ''}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Payroll Sub-Tabs */}
                <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
                  <Tabs value={payrollTab} onChange={(e, v) => setPayrollTab(v)} variant="fullWidth" sx={{ bgcolor: 'white', '& .MuiTab-root': { fontWeight: 600, fontSize: '0.8rem' }, '& .Mui-selected': { color: '#6C63FF' }, '& .MuiTabs-indicator': { bgcolor: '#6C63FF' } }}>
                    <Tab icon={<AccountBalanceWallet />} iconPosition="start" label="Ledger" />
                    <Tab icon={<Payment />} iconPosition="start" label="Salary" />
                    <Tab icon={<MonetizationOn />} iconPosition="start" label="Commission" />
                    <Tab icon={<MoneyOff />} iconPosition="start" label="Advances" />
                  </Tabs>

                  {/* LEDGER SUB-TAB */}
                  {payrollTab === 0 && (
                    <Box sx={{ p: 2 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#1c2580' }}>
                            <TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Description</TableCell><TableCell align="right">Amount</TableCell><TableCell>Reference</TableCell></TableRow>
                          </TableHead>
                          <TableBody>
                            {salesmanLedgerEntries.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No ledger entries found.</TableCell></TableRow> :
                              salesmanLedgerEntries.map((entry) => (
                                <TableRow key={entry.id} hover>
                                  <TableCell>{formatDateTime(entry.date)}</TableCell>
                                  <TableCell><Chip size="small" label={entry.type} color={entry.type === 'sale_credit' ? 'success' : entry.type === 'salary' ? 'primary' : entry.type === 'commission' ? 'warning' : 'default'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                                  <TableCell>{entry.description}</TableCell>
                                  <TableCell align="right" fontWeight="bold">{formatCurrency(entry.amount)}</TableCell>
                                  <TableCell><Typography variant="caption" color="text.secondary">{entry.reference_type} #{entry.reference_id}</Typography></TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* SALARY SUB-TAB */}
                  {payrollTab === 1 && (
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setSalaryForm({ ...salaryForm, salesman_id: selectedSalesmanForLedger }); setSalaryDialog(true); }} sx={{ bgcolor: '#6C63FF' }}>Record Salary</Button>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#1c2580' }}>
                            <TableRow>
                              <TableCell>Month</TableCell><TableCell align="right">Base</TableCell><TableCell align="right">Bonus</TableCell><TableCell align="right">Deduction</TableCell><TableCell align="right">Advance Ded.</TableCell><TableCell align="right">Net Payable</TableCell><TableCell align="right">Paid</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {salaryPayments.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3 }}>No salary records found.</TableCell></TableRow> :
                              salaryPayments.map((p) => (
                                <TableRow key={p.id} hover>
                                  <TableCell fontWeight="bold">{p.month_year}</TableCell>
                                  <TableCell align="right">{formatCurrency(p.base_salary)}</TableCell>
                                  <TableCell align="right" color="success.main">+{formatCurrency(p.bonus)}</TableCell>
                                  <TableCell align="right" color="error.main">-{formatCurrency(p.deduction)}</TableCell>
                                  <TableCell align="right" color="error.main">-{formatCurrency(p.advance_deducted)}</TableCell>
                                  <TableCell align="right" fontWeight="bold">{formatCurrency(p.net_payable)}</TableCell>
                                  <TableCell align="right">{formatCurrency(p.paid_amount)}</TableCell>
                                  <TableCell><Chip size="small" label={p.status} color={p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'default'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                                  <TableCell>{formatDate(p.payment_date)}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* COMMISSION SUB-TAB */}
                  {payrollTab === 2 && (
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setCommissionForm({ ...commissionForm, salesman_id: selectedSalesmanForLedger }); setCommissionDialog(true); }} sx={{ bgcolor: '#6C63FF' }}>Record Commission</Button>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#1c2580' }}>
                            <TableRow><TableCell>Date</TableCell><TableCell>Sale</TableCell><TableCell align="right">Commission</TableCell><TableCell align="right">Payout</TableCell><TableCell>Mode</TableCell><TableCell>Status</TableCell></TableRow>
                          </TableHead>
                          <TableBody>
                            {commissionPayouts.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No commission records found.</TableCell></TableRow> :
                              commissionPayouts.map((c) => (
                                <TableRow key={c.id} hover>
                                  <TableCell>{formatDate(c.payout_date)}</TableCell>
                                  <TableCell><Typography variant="caption">Sale #{c.sale_id}</Typography></TableCell>
                                  <TableCell align="right">{formatCurrency(c.commission_amount)}</TableCell>
                                  <TableCell align="right" fontWeight="bold">{formatCurrency(c.payout_amount)}</TableCell>
                                  <TableCell>{c.payment_mode}</TableCell>
                                  <TableCell><Chip size="small" label={c.status} color={c.status === 'paid' ? 'success' : 'warning'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* ADVANCES SUB-TAB */}
                  {payrollTab === 3 && (
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setAdvanceForm({ ...advanceForm, salesman_id: selectedSalesmanForLedger }); setAdvanceDialog(true); }} sx={{ bgcolor: '#6C63FF' }}>Give Advance</Button>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#1c2580' }}>
                            <TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Reason</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Repaid</TableCell><TableCell align="right">Remaining</TableCell><TableCell>Status</TableCell><TableCell align="center">Action</TableCell></TableRow>
                          </TableHead>
                          <TableBody>
                            {advancesList.length === 0 ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3 }}>No advance records found.</TableCell></TableRow> :
                              advancesList.map((a) => (
                                <TableRow key={a.id} hover>
                                  <TableCell>{formatDate(a.given_date)}</TableCell>
                                  <TableCell><Chip size="small" label={a.advance_type} variant="outlined" sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                                  <TableCell>{a.reason || '-'}</TableCell>
                                  <TableCell align="right" fontWeight="bold">{formatCurrency(a.amount)}</TableCell>
                                  <TableCell align="right">{formatCurrency(a.repayment_amount)}</TableCell>
                                  <TableCell align="right" color={a.remaining_amount > 0 ? 'error.main' : 'success.main'}>{formatCurrency(a.remaining_amount)}</TableCell>
                                  <TableCell><Chip size="small" label={a.status} color={a.status === 'repaid' ? 'success' : 'warning'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                                  <TableCell align="center">
                                    {a.status !== 'repaid' && (
                                      <Button size="small" variant="outlined" onClick={() => { const amt = prompt('Enter repayment amount:'); if (amt) handleRepayAdvance(a.id, parseFloat(amt)); }}>Repay</Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Paper>
              </>
            )}
            {!selectedSalesmanForLedger && (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '2px dashed #e5e7eb' }}>
                <AccountBalanceWallet sx={{ fontSize: 48, color: '#d1d5db' }} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>Select a salesman above to view ledger, salary, commission, and advance records.</Typography>
              </Paper>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 4: DISTRIBUTORS ==================== */}
      {activeTab === 4 && (
        <Fade in>
          <Box>
            <Grid container spacing={2}>
              {distributors.filter(d => !d.is_deleted).map((dist) => (
                <Grid item xs={12} sm={6} md={4} key={dist.id}>
                  <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: dist.status === 'active' ? '#8b5cf6' : '#9ca3af', width: 45, height: 45 }}><Store /></Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">{dist.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{dist.company_name || 'No Company'}</Typography>
                            <Box sx={{ mt: 0.5 }}>
                              <Chip size="small" label={dist.status === 'active' ? 'Active' : 'Inactive'} color={dist.status === 'active' ? 'success' : 'default'} sx={{ height: 18, fontSize: '0.5rem', mr: 0.5 }} />
                              <Chip size="small" label={dist.payment_terms || 'Cash'} variant="outlined" sx={{ height: 18, fontSize: '0.5rem' }} />
                            </Box>
                          </Box>
                        </Box>
                        <Tooltip title="View Stats"><IconButton size="small" color="primary" onClick={() => handleViewDistributorStats(dist.id)}><BarChart fontSize="small" /></IconButton></Tooltip>
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Phone</Typography>
                        <Typography variant="caption" fontWeight={500}>{dist.phone || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Territory</Typography>
                        <Typography variant="caption" fontWeight={500}>{dist.territory || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary">{formatCurrency(dist.credit_limit)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                        <Typography variant="caption" fontWeight="bold" color={dist.current_balance > 0 ? 'error.main' : 'success.main'}>{formatCurrency(dist.current_balance)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Commission</Typography>
                        <Typography variant="caption" fontWeight="bold" color="success.main">{dist.commission_percent || 0}%</Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
                      <Tooltip title="View Ledger"><IconButton size="small" color="info" onClick={() => { setSelectedDistributorForLedger(dist.id); loadDistributorLedgerData(dist.id); setActiveTab(5); }}><AccountBalanceWallet fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="New Order"><IconButton size="small" color="primary" onClick={() => { setDistOrderForm({ ...distOrderForm, distributor_id: dist.id }); setDistCartItems([]); setDistributorOrderDialog(true); }}><ShoppingCart fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Add Payment"><IconButton size="small" color="success" onClick={() => { setDistPaymentForm({ ...distPaymentForm, distributor_id: dist.id }); setDistributorPaymentDialog(true); }}><Payment fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" color="primary" onClick={() => {
                        setEditingDistributor(dist);
                        setDistributorForm({
                          ...dist,
                          opening_balance: dist.opening_balance || 0,
                          credit_limit: dist.credit_limit || 0,
                          commission_percent: dist.commission_percent || 0
                        });
                        setDistributorDialog(true);
                      }}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteDistributor(dist.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              {distributors.filter(d => !d.is_deleted).length === 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '2px dashed #e5e7eb' }}>
                    <Store sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>No distributors added yet. Click "Add Distributor" to get started.</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 5: DISTRIBUTOR ORDERS & RETURNS ==================== */}
      {activeTab === 5 && (
        <Fade in>
          <Box>
            {/* Orders Section */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingBag sx={{ color: '#6C63FF' }} /> Distributor Orders
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setDistCartItems([]); setDistributorOrderDialog(true); }} sx={{ bgcolor: '#6C63FF' }}>New Order</Button>
                  <Tooltip title="Export CSV"><IconButton size="small" color="primary" onClick={() => exportToCSV(filteredDistOrders, 'distributor_orders.csv')}><FileDownload /></IconButton></Tooltip>
                  <Tooltip title="Export PDF"><IconButton size="small" color="error" onClick={() => exportToPDF('Distributor Orders', [{key:'order_no',label:'Order No'},{key:'order_date',label:'Date'},{key:'distributor_name',label:'Distributor'},{key:'status',label:'Status'},{key:'payment_status',label:'Payment'},{key:'grand_total',label:'Total'},{key:'due_amount',label:'Due'}], filteredDistOrders)}><PictureAsPdf /></IconButton></Tooltip>
                </Stack>
              </Box>
              <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="small"><InputLabel>Distributor</InputLabel>
                    <Select value={distOrderFilter.distributor_id} onChange={(e) => setDistOrderFilter({...distOrderFilter, distributor_id: e.target.value})} label="Distributor">
                      <MenuItem value="">All Distributors</MenuItem>
                      {distributors.filter(d => !d.is_deleted).map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
                    <Select value={distOrderFilter.status} onChange={(e) => setDistOrderFilter({...distOrderFilter, status: e.target.value})} label="Status">
                      <MenuItem value="">All Statuses</MenuItem><MenuItem value="pending">Pending</MenuItem><MenuItem value="processing">Processing</MenuItem><MenuItem value="shipped">Shipped</MenuItem><MenuItem value="delivered">Delivered</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                  <FormControl fullWidth size="small"><InputLabel>Payment</InputLabel>
                    <Select value={distOrderFilter.payment_status} onChange={(e) => setDistOrderFilter({...distOrderFilter, payment_status: e.target.value})} label="Payment">
                      <MenuItem value="">All Payments</MenuItem><MenuItem value="paid">Paid</MenuItem><MenuItem value="due">Due</MenuItem><MenuItem value="partial">Partial</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Button fullWidth variant="outlined" size="small" onClick={() => setDistOrderFilter({ distributor_id: '', status: '', payment_status: '' })} startIcon={<Refresh />} sx={{ height: 40 }}>Clear</Button>
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Order #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Distributor</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Paid</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Due</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDistOrders.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3 }}>No orders found.</TableCell></TableRow> :
                      paginatedDistOrders.map((order) => (
                        <TableRow key={order.id} hover>
                          <TableCell fontWeight="bold">{order.order_no || `#${order.id}`}</TableCell>
                          <TableCell>{formatDate(order.order_date)}</TableCell>
                          <TableCell>{order.distributor_name || distributors.find(d => String(d.id) === String(order.distributor_id))?.name || 'Unknown'}</TableCell>
                          <TableCell><Chip size="small" label={order.status} color={order.status === 'delivered' ? 'success' : order.status === 'pending' ? 'warning' : 'default'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                          <TableCell><Chip size="small" label={order.payment_status} color={order.payment_status === 'paid' ? 'success' : order.payment_status === 'partial' ? 'warning' : 'error'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                          <TableCell align="right" fontWeight="bold">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell align="right">{formatCurrency(order.paid_amount)}</TableCell>
                          <TableCell align="right" color="error.main">{formatCurrency(order.due_amount)}</TableCell>
                          <TableCell align="center">
                            <Tooltip title="Add Payment"><IconButton size="small" color="success" onClick={() => { setDistPaymentForm({ ...distPaymentForm, distributor_id: order.distributor_id, order_id: order.id }); setDistributorPaymentDialog(true); }}><Payment fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Process Return"><IconButton size="small" color="warning" onClick={() => {
                              setDistReturnForm({
                                ...distReturnForm,
                                order_id: order.id,
                                distributor_id: order.distributor_id,
                                grand_total: 0 // FIXED: Don't auto-fill order total
                              });
                              // FIXED: Load order items for return selection
                              db.getDistributorOrderById ? db.getDistributorOrderById(order.id).then(detail => {
                                if (detail && detail.items) {
                                  setReturnOrderItems(detail.items.map(it => ({
                                    ...it,
                                    return_qty: 0,
                                    return_price: it.price || 0,
                                    reason: '',
                                    selected: false
                                  })));
                                } else {
                                  setReturnOrderItems([]);
                                }
                              }) : setReturnOrderItems([]);
                              setDistributorReturnDialog(true);
                            }}><Restore fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Update Status"><IconButton size="small" color="primary" onClick={() => {
                              const newStatus = prompt('Enter new status (pending/processing/shipped/delivered/cancelled):');
                              if (newStatus && ['pending','processing','shipped','delivered','cancelled'].includes(newStatus)) {
                                db.updateDistributorOrderStatus(order.id, newStatus).then(() => { showSuccess('Status updated!'); loadDistributorData(); });
                              } else if (newStatus) { showError('Invalid status'); }
                            }}><Edit fontSize="small" /></IconButton></Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={filteredDistOrders.length}
                page={distOrderPage}
                rowsPerPage={distOrderRowsPerPage}
                onPageChange={setDistOrderPage}
                onRowsPerPageChange={(r) => {
                  setDistOrderRowsPerPage(r);
                  setDistOrderPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
              <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">Total Orders: {formatCurrency(filteredDistOrders.reduce((s, i) => s + (i.grand_total || 0), 0))} ({filteredDistOrders.length} Orders)</Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main">Total Paid: {formatCurrency(filteredDistOrders.reduce((s, i) => s + (i.paid_amount || 0), 0))}</Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="error.main">Total Due: {formatCurrency(filteredDistOrders.reduce((s, i) => s + (i.due_amount || 0), 0))}</Typography>
              </Box>
            </Paper>

            {/* Distributor Ledger Viewer (if selected) */}
            {selectedDistributorForLedger && (
              <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalanceWallet sx={{ color: '#6C63FF' }} /> Distributor Ledger
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" onClick={() => setSelectedDistributorForLedger('')}>Close Ledger</Button>
                    <Tooltip title="Export CSV"><IconButton size="small" color="primary" onClick={() => exportToCSV(distributorLedgerEntries, 'distributor_ledger.csv')}><FileDownload /></IconButton></Tooltip>
                  </Stack>
                </Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6} md={3}><Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><CardContent sx={{ p: 2, '&:last-child':{pb:2} }}><Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Total Debit</Typography><Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(distributorBalance.total_debit)}</Typography></CardContent></Card></Grid>
                  <Grid item xs={6} md={3}><Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><CardContent sx={{ p: 2, '&:last-child':{pb:2} }}><Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Total Credit</Typography><Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(distributorBalance.total_credit)}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} md={3}><Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><CardContent sx={{ p: 2, '&:last-child':{pb:2} }}><Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Net Balance</Typography><Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(distributorBalance.balance)}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} md={3}><Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}><CardContent sx={{ p: 2, '&:last-child':{pb:2} }}><Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Distributor</Typography><Typography variant="h6" fontWeight="bold" color="#1c2580">{distributors.find(d => String(d.id) === String(selectedDistributorForLedger))?.name || ''}</Typography></CardContent></Card></Grid>
                </Grid>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Description</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Prev. Balance</TableCell><TableCell align="right">Balance After</TableCell></TableRow>
                    </TableHead>
                    <TableBody>
                      {distributorLedgerEntries.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No ledger entries found.</TableCell></TableRow> :
                        distributorLedgerEntries.map((entry) => (
                          <TableRow key={entry.id} hover>
                            <TableCell>{formatDateTime(entry.date)}</TableCell>
                            <TableCell><Chip size="small" label={entry.type} color={entry.type === 'order' ? 'success' : entry.type === 'payment' ? 'primary' : entry.type === 'return' ? 'warning' : 'default'} sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell align="right" fontWeight="bold">{formatCurrency(entry.amount)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.previous_balance)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.balance_after)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* Returns Section */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Restore sx={{ color: '#6C63FF' }} /> Distributor Returns
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setReturnOrderItems([]); setDistReturnForm({ order_id: '', distributor_id: '', return_date: new Date().toISOString().split('T')[0], total_amount: 0, discount_amount: 0, tax_amount: 0, grand_total: 0, notes: '', items: [] }); setDistributorReturnDialog(true); }} sx={{ bgcolor: '#6C63FF' }}>New Return</Button>
                  <Tooltip title="Export CSV"><IconButton size="small" color="primary" onClick={() => exportToCSV(filteredDistReturns, 'distributor_returns.csv')}><FileDownload /></IconButton></Tooltip>
                </Stack>
              </Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small"><InputLabel>Distributor</InputLabel>
                    <Select value={distReturnFilter.distributor_id} onChange={(e) => setDistReturnFilter({...distReturnFilter, distributor_id: e.target.value})} label="Distributor">
                      <MenuItem value="">All</MenuItem>
                      {distributors.filter(d => !d.is_deleted).map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Button fullWidth variant="outlined" size="small" onClick={() => setDistReturnFilter({ distributor_id: '', order_id: '' })} startIcon={<Refresh />}>Clear Filters</Button>
                </Grid>
              </Grid>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Return #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Distributor</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Order</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDistReturns.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No returns found.</TableCell></TableRow> :
                      paginatedDistReturns.map((ret) => (
                        <TableRow key={ret.id} hover>
                          <TableCell fontWeight="bold">{ret.return_no || `#${ret.id}`}</TableCell>
                          <TableCell>{formatDate(ret.return_date)}</TableCell>
                          <TableCell>{ret.distributor_name || distributors.find(d => String(d.id) === String(ret.distributor_id))?.name || 'Unknown'}</TableCell>
                          <TableCell><Typography variant="caption">Order #{ret.order_id}</Typography></TableCell>
                          <TableCell align="right" fontWeight="bold">{formatCurrency(ret.grand_total)}</TableCell>
                          <TableCell>{ret.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Fade>
      )}


      {/* ==================== DIALOGS ==================== */}

      {/* SALESMAN DIALOG */}
      <Dialog open={salesmanDialog} onClose={() => setSalesmanDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>{editingSalesman ? 'Edit Salesman' : 'Add New Salesman'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="Full Name *" value={salesmanForm.name} onChange={(e) => setSalesmanForm({...salesmanForm, name: e.target.value})} />
            <TextField fullWidth size="small" label="Phone Number" value={salesmanForm.phone} onChange={(e) => setSalesmanForm({...salesmanForm, phone: e.target.value})} />
            <TextField fullWidth size="small" label="CNIC Number" value={salesmanForm.cnic} onChange={(e) => setSalesmanForm({...salesmanForm, cnic: e.target.value})} />
            <TextField fullWidth size="small" label="Address" multiline rows={2} value={salesmanForm.address} onChange={(e) => setSalesmanForm({...salesmanForm, address: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Joining Date" value={salesmanForm.joining_date} onChange={(e) => setSalesmanForm({...salesmanForm, joining_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth size="small" type="number" label="Base Salary (PKR)" value={salesmanForm.base_salary} onChange={(e) => setSalesmanForm({...salesmanForm, base_salary: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Monthly Target (PKR)" value={salesmanForm.target_amount} onChange={(e) => setSalesmanForm({...salesmanForm, target_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Commission %" value={salesmanForm.commission_percent} onChange={(e) => setSalesmanForm({...salesmanForm, commission_percent: e.target.value})} />
            <FormControlLabel control={<Switch checked={salesmanForm.status === 'active'} onChange={(e) => setSalesmanForm({...salesmanForm, status: e.target.checked ? 'active' : 'inactive'})} color="success" />} label={salesmanForm.status === 'active' ? 'Active' : 'Inactive'} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setSalesmanDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" onClick={handleSaveSalesman} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }} disabled={loading}>{loading ? 'Saving...' : (editingSalesman ? 'Update' : 'Add')}</Button>
        </DialogActions>
      </Dialog>

      {/* DISTRIBUTOR DIALOG */}
      <Dialog open={distributorDialog} onClose={() => setDistributorDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>{editingDistributor ? 'Edit Distributor' : 'Add New Distributor'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Full Name *" value={distributorForm.name} onChange={(e) => setDistributorForm({...distributorForm, name: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Company Name" value={distributorForm.company_name} onChange={(e) => setDistributorForm({...distributorForm, company_name: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Phone" value={distributorForm.phone} onChange={(e) => setDistributorForm({...distributorForm, phone: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Email" value={distributorForm.email} onChange={(e) => setDistributorForm({...distributorForm, email: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="CNIC" value={distributorForm.cnic} onChange={(e) => setDistributorForm({...distributorForm, cnic: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="District" value={distributorForm.district} onChange={(e) => setDistributorForm({...distributorForm, district: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Province" value={distributorForm.province} onChange={(e) => setDistributorForm({...distributorForm, province: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Territory" value={distributorForm.territory} onChange={(e) => setDistributorForm({...distributorForm, territory: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Address" multiline rows={2} value={distributorForm.address} onChange={(e) => setDistributorForm({...distributorForm, address: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Opening Balance" value={distributorForm.opening_balance} onChange={(e) => setDistributorForm({...distributorForm, opening_balance: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Credit Limit" value={distributorForm.credit_limit} onChange={(e) => setDistributorForm({...distributorForm, credit_limit: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Commission %" value={distributorForm.commission_percent} onChange={(e) => setDistributorForm({...distributorForm, commission_percent: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small"><InputLabel>Payment Terms</InputLabel>
                <Select value={distributorForm.payment_terms} onChange={(e) => setDistributorForm({...distributorForm, payment_terms: e.target.value})} label="Payment Terms">
                  <MenuItem value="cash">Cash</MenuItem><MenuItem value="credit">Credit</MenuItem><MenuItem value="cheque">Cheque</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel control={<Switch checked={distributorForm.status === 'active'} onChange={(e) => setDistributorForm({...distributorForm, status: e.target.checked ? 'active' : 'inactive'})} color="success" />} label={distributorForm.status === 'active' ? 'Active' : 'Inactive'} />
            </Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Reference Name" value={distributorForm.reference_name} onChange={(e) => setDistributorForm({...distributorForm, reference_name: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Reference Phone" value={distributorForm.reference_phone} onChange={(e) => setDistributorForm({...distributorForm, reference_phone: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Notes" multiline rows={2} value={distributorForm.notes} onChange={(e) => setDistributorForm({...distributorForm, notes: e.target.value})} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setDistributorDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" onClick={handleSaveDistributor} sx={{ bgcolor: '#6C63FF' }} disabled={loading}>{loading ? 'Saving...' : (editingDistributor ? 'Update' : 'Add')}</Button>
        </DialogActions>
      </Dialog>

      {/* RETURN DIALOG (Salesman) — FIXED: Added item-level return selection */}
      <Dialog open={returnDialog} onClose={() => setReturnDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white' }}>Process Sale Return</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" type="number" label="Refund Amount" value={returnForm.refund_amount} onChange={(e) => setReturnForm({...returnForm, refund_amount: e.target.value})} helperText="Will be clamped to sale grand total by system" />
            <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel>
              <Select value={returnForm.payment_mode} onChange={(e) => setReturnForm({...returnForm, payment_mode: e.target.value})} label="Payment Mode">
                <MenuItem value="cash">Cash</MenuItem><MenuItem value="bank">Bank</MenuItem><MenuItem value="credit">Credit</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth size="small" type="date" label="Return Date" value={returnForm.return_date} onChange={(e) => setReturnForm({...returnForm, return_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth size="small" multiline rows={2} label="Notes" value={returnForm.notes} onChange={(e) => setReturnForm({...returnForm, notes: e.target.value})} />

            {/* FIXED: Item selection for return */}
            {returnSaleItems.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight="bold">Select Items to Return</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell>Select</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="center">Original Qty</TableCell>
                        <TableCell align="center">Return Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnSaleItems.map((it, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell><Checkbox size="small" checked={it.selected} onChange={(e) => {
                            const updated = [...returnSaleItems];
                            updated[idx].selected = e.target.checked;
                            setReturnSaleItems(updated);
                          }} /></TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{it.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{it.sku}</Typography>
                          </TableCell>
                          <TableCell align="center">{it.quantity}</TableCell>
                          <TableCell align="center">
                            <TextField size="small" type="number" sx={{ width: 80 }} value={it.return_qty} onChange={(e) => {
                              const updated = [...returnSaleItems];
                              updated[idx].return_qty = Math.min(parseInt(e.target.value) || 0, it.quantity);
                              setReturnSaleItems(updated);
                            }} />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(it.return_price)}</TableCell>
                          <TableCell>
                            <TextField size="small" value={it.reason} onChange={(e) => {
                              const updated = [...returnSaleItems];
                              updated[idx].reason = e.target.value;
                              setReturnSaleItems(updated);
                            }} placeholder="Reason" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
            {returnSaleItems.length === 0 && (
              <Alert severity="warning">No items found for this sale. You can still process a full refund.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSaveReturn} disabled={loading}>{loading ? 'Processing...' : 'Process Return'}</Button>
        </DialogActions>
      </Dialog>

      {/* SALARY DIALOG */}
      <Dialog open={salaryDialog} onClose={() => setSalaryDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>Record Salary Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small" disabled={!!salaryForm.salesman_id}><InputLabel>Salesman</InputLabel>
              <Select value={salaryForm.salesman_id} onChange={(e) => setSalaryForm({...salaryForm, salesman_id: e.target.value})} label="Salesman">
                <MenuItem value="">Select...</MenuItem>
                {salesmen.filter(s => !s.is_deleted).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Month-Year (e.g. 2024-01)" value={salaryForm.month_year} onChange={(e) => setSalaryForm({...salaryForm, month_year: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Base Salary" value={salaryForm.base_salary} onChange={(e) => setSalaryForm({...salaryForm, base_salary: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Bonus" value={salaryForm.bonus} onChange={(e) => setSalaryForm({...salaryForm, bonus: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Deduction" value={salaryForm.deduction} onChange={(e) => setSalaryForm({...salaryForm, deduction: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Advance Deducted" value={salaryForm.advance_deducted} onChange={(e) => setSalaryForm({...salaryForm, advance_deducted: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Paid Amount" value={salaryForm.paid_amount} onChange={(e) => setSalaryForm({...salaryForm, paid_amount: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Payment Date" value={salaryForm.payment_date} onChange={(e) => setSalaryForm({...salaryForm, payment_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel>
              <Select value={salaryForm.payment_mode} onChange={(e) => setSalaryForm({...salaryForm, payment_mode: e.target.value})} label="Payment Mode">
                <MenuItem value="cash">Cash</MenuItem><MenuItem value="bank">Bank Transfer</MenuItem><MenuItem value="cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select value={salaryForm.status} onChange={(e) => setSalaryForm({...salaryForm, status: e.target.value})} label="Status">
                <MenuItem value="pending">Pending</MenuItem><MenuItem value="paid">Paid</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth size="small" multiline rows={2} label="Note" value={salaryForm.note} onChange={(e) => setSalaryForm({...salaryForm, note: e.target.value})} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalaryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSalary} sx={{ bgcolor: '#6C63FF' }} disabled={loading}>{loading ? 'Saving...' : 'Save Salary'}</Button>
        </DialogActions>
      </Dialog>

      {/* COMMISSION DIALOG — FIXED: sale_id is now Select dropdown */}
      <Dialog open={commissionDialog} onClose={() => setCommissionDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>Record Commission Payout</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small" disabled={!!commissionForm.salesman_id}><InputLabel>Salesman</InputLabel>
              <Select value={commissionForm.salesman_id} onChange={(e) => setCommissionForm({...commissionForm, salesman_id: e.target.value})} label="Salesman">
                <MenuItem value="">Select...</MenuItem>
                {salesmen.filter(s => !s.is_deleted).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small"><InputLabel>Sale (Optional)</InputLabel>
              <Select value={commissionForm.sale_id} onChange={(e) => {
                const sale = pendingCommissions.find(p => String(p.id) === String(e.target.value));
                setCommissionForm({
                  ...commissionForm,
                  sale_id: e.target.value,
                  commission_amount: sale?.commission_amount || commissionForm.commission_amount
                });
              }} label="Sale">
                <MenuItem value="">General Payout</MenuItem>
                {pendingCommissions.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.invoice_no || `#${p.id}`} — {formatCurrency(p.commission_amount)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" type="number" label="Commission Amount" value={commissionForm.commission_amount} onChange={(e) => setCommissionForm({...commissionForm, commission_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Payout Amount" value={commissionForm.payout_amount} onChange={(e) => setCommissionForm({...commissionForm, payout_amount: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Payout Date" value={commissionForm.payout_date} onChange={(e) => setCommissionForm({...commissionForm, payout_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel>
              <Select value={commissionForm.payment_mode} onChange={(e) => setCommissionForm({...commissionForm, payment_mode: e.target.value})} label="Payment Mode">
                <MenuItem value="cash">Cash</MenuItem><MenuItem value="bank">Bank</MenuItem><MenuItem value="cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select value={commissionForm.status} onChange={(e) => setCommissionForm({...commissionForm, status: e.target.value})} label="Status">
                <MenuItem value="pending">Pending</MenuItem><MenuItem value="paid">Paid</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth size="small" multiline rows={2} label="Note" value={commissionForm.note} onChange={(e) => setCommissionForm({...commissionForm, note: e.target.value})} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommissionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCommission} sx={{ bgcolor: '#6C63FF' }} disabled={loading}>{loading ? 'Saving...' : 'Save Commission'}</Button>
        </DialogActions>
      </Dialog>

      {/* ADVANCE DIALOG */}
      <Dialog open={advanceDialog} onClose={() => setAdvanceDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>Record Advance / Loan</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small" disabled={!!advanceForm.salesman_id}><InputLabel>Salesman</InputLabel>
              <Select value={advanceForm.salesman_id} onChange={(e) => setAdvanceForm({...advanceForm, salesman_id: e.target.value})} label="Salesman">
                <MenuItem value="">Select...</MenuItem>
                {salesmen.filter(s => !s.is_deleted).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" type="number" label="Amount" value={advanceForm.amount} onChange={(e) => setAdvanceForm({...advanceForm, amount: e.target.value})} />
            <FormControl fullWidth size="small"><InputLabel>Advance Type</InputLabel>
              <Select value={advanceForm.advance_type} onChange={(e) => setAdvanceForm({...advanceForm, advance_type: e.target.value})} label="Advance Type">
                <MenuItem value="salary">Salary Advance</MenuItem><MenuItem value="loan">Loan</MenuItem><MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Reason" value={advanceForm.reason} onChange={(e) => setAdvanceForm({...advanceForm, reason: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Given Date" value={advanceForm.given_date} onChange={(e) => setAdvanceForm({...advanceForm, given_date: e.target.value})} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvanceDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAdvance} sx={{ bgcolor: '#6C63FF' }} disabled={loading}>{loading ? 'Saving...' : 'Save Advance'}</Button>
        </DialogActions>
      </Dialog>

      {/* DISTRIBUTOR ORDER DIALOG */}
      <Dialog open={distributorOrderDialog} onClose={() => setDistributorOrderDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>New Distributor Order</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small"><InputLabel>Distributor *</InputLabel>
                <Select value={distOrderForm.distributor_id} onChange={(e) => setDistOrderForm({...distOrderForm, distributor_id: e.target.value})} label="Distributor *">
                  <MenuItem value="">Select...</MenuItem>
                  {distributors.filter(d => !d.is_deleted).map(d => <MenuItem key={d.id} value={d.id}>{d.name} {d.company_name ? `(${d.company_name})` : ''}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" label="Order Date" value={distOrderForm.order_date} onChange={(e) => setDistOrderForm({...distOrderForm, order_date: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" label="Due Date" value={distOrderForm.due_date} onChange={(e) => setDistOrderForm({...distOrderForm, due_date: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}><Category sx={{ color: '#6C63FF', verticalAlign: 'middle', mr: 1 }} />Select Products</Typography>
              {productsData.map((category) => (
                <Card key={category.category_id || 'uncategorized'} variant="outlined" sx={{ mb: 1 }}>
                  <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: expandedCategories[category.category_id || 'uncategorized'] ? '#f0f0ff' : 'white' }} onClick={() => toggleCategory(category.category_id || 'uncategorized')}>
                    <Typography variant="subtitle2" fontWeight="bold">{category.category_name} ({category.products?.length || 0})</Typography>
                    {expandedCategories[category.category_id || 'uncategorized'] ? <ExpandLess /> : <ExpandMore />}
                  </Box>
                  <Collapse in={expandedCategories[category.category_id || 'uncategorized']}>
                    <Divider />
                    <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {category.products?.map((product) => (
                        <Chip key={product.variant_id || product.id} label={`${product.product_name || product.name} - ${formatCurrency(product.retail_price || product.price || 0)}`} onClick={() => handleAddDistProductToCart(product)} icon={<Add fontSize="small" />} color="primary" variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#6C63FF', color: 'white' } }} />
                      ))}
                    </Box>
                  </Collapse>
                </Card>
              ))}
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}><ShoppingCart sx={{ color: '#6C63FF', verticalAlign: 'middle', mr: 1 }} />Cart ({distCartItems.length})</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Qty</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Price</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {distCartItems.map((item, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" fontWeight={500}>{item.product_name}</Typography><Typography variant="caption" color="text.secondary">{item.sku}</Typography></TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => updateDistCartQty(item.variant_id, item.qty - 1)}><Remove fontSize="small" /></IconButton>
                          <Typography component="span" sx={{ mx: 1, fontWeight: 'bold' }}>{item.qty}</Typography>
                          <IconButton size="small" onClick={() => updateDistCartQty(item.variant_id, item.qty + 1)}><Add fontSize="small" /></IconButton>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                        <TableCell align="right" fontWeight="bold">{formatCurrency(item.total)}</TableCell>
                        <TableCell align="center"><IconButton size="small" color="error" onClick={() => updateDistCartQty(item.variant_id, 0)}><Delete fontSize="small" /></IconButton></TableCell>
                      </TableRow>
                    ))}
                    {distCartItems.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Add products from above.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Discount Amount" value={distOrderForm.discount_amount} onChange={(e) => setDistOrderForm({...distOrderForm, discount_amount: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Tax (%)" value={distOrderForm.tax_amount} onChange={(e) => setDistOrderForm({...distOrderForm, tax_amount: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth size="small" type="number" label="Shipping Charges" value={distOrderForm.shipping_charges} onChange={(e) => setDistOrderForm({...distOrderForm, shipping_charges: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" multiline rows={2} label="Notes" value={distOrderForm.notes} onChange={(e) => setDistOrderForm({...distOrderForm, notes: e.target.value})} /></Grid>

            <Grid item xs={12}>
              <Card variant="outlined" sx={{ bgcolor: '#f8f9fa' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={2}><Typography variant="caption" color="text.secondary">Subtotal</Typography><Typography variant="h6" fontWeight="bold">{formatCurrency(distOrderCalculations.subtotal)}</Typography></Grid>
                    <Grid item xs={6} md={2}><Typography variant="caption" color="text.secondary">Discount</Typography><Typography variant="h6" fontWeight="bold" color="error">-{formatCurrency(distOrderCalculations.discount)}</Typography></Grid>
                    <Grid item xs={6} md={2}><Typography variant="caption" color="text.secondary">Tax</Typography><Typography variant="h6" fontWeight="bold">+{formatCurrency(distOrderCalculations.tax)}</Typography></Grid>
                    <Grid item xs={6} md={2}><Typography variant="caption" color="text.secondary">Shipping</Typography><Typography variant="h6" fontWeight="bold">+{formatCurrency(distOrderCalculations.shipping)}</Typography></Grid>
                    <Grid item xs={12} md={4} sx={{ borderLeft: isMobile ? 'none' : '2px solid #6C63FF', pl: isMobile ? 0 : 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">Grand Total</Typography>
                      <Typography variant="h5" fontWeight="bold" color="#6C63FF">{formatCurrency(distOrderCalculations.grandTotal)}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributorOrderDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDistributorOrder} sx={{ bgcolor: '#6C63FF' }} disabled={loading || distCartItems.length === 0}>{loading ? 'Saving...' : 'Save Order'}</Button>
        </DialogActions>
      </Dialog>

      {/* DISTRIBUTOR PAYMENT DIALOG */}
      <Dialog open={distributorPaymentDialog} onClose={() => setDistributorPaymentDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Record Distributor Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small" disabled={!!distPaymentForm.distributor_id}><InputLabel>Distributor</InputLabel>
              <Select value={distPaymentForm.distributor_id} onChange={(e) => setDistPaymentForm({...distPaymentForm, distributor_id: e.target.value})} label="Distributor">
                <MenuItem value="">Select...</MenuItem>
                {distributors.filter(d => !d.is_deleted).map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small"><InputLabel>Order (Optional)</InputLabel>
              <Select value={distPaymentForm.order_id} onChange={(e) => setDistPaymentForm({...distPaymentForm, order_id: e.target.value})} label="Order">
                <MenuItem value="">General Payment</MenuItem>
                {distributorOrdersList.filter(o => String(o.distributor_id) === String(distPaymentForm.distributor_id) && o.due_amount > 0).map(o => <MenuItem key={o.id} value={o.id}>{o.order_no || `#${o.id}`} - Due: {formatCurrency(o.due_amount)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" type="number" label="Amount *" value={distPaymentForm.amount} onChange={(e) => setDistPaymentForm({...distPaymentForm, amount: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Payment Date" value={distPaymentForm.payment_date} onChange={(e) => setDistPaymentForm({...distPaymentForm, payment_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel>
              <Select value={distPaymentForm.payment_mode} onChange={(e) => setDistPaymentForm({...distPaymentForm, payment_mode: e.target.value})} label="Payment Mode">
                <MenuItem value="cash">Cash</MenuItem><MenuItem value="bank">Bank Transfer</MenuItem><MenuItem value="cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
            {distPaymentForm.payment_mode === 'cheque' && (
              <>
                <TextField fullWidth size="small" label="Cheque No" value={distPaymentForm.cheque_no} onChange={(e) => setDistPaymentForm({...distPaymentForm, cheque_no: e.target.value})} />
                <TextField fullWidth size="small" type="date" label="Cheque Date" value={distPaymentForm.cheque_date} onChange={(e) => setDistPaymentForm({...distPaymentForm, cheque_date: e.target.value})} InputLabelProps={{ shrink: true }} />
                <TextField fullWidth size="small" label="Bank Name" value={distPaymentForm.bank_name} onChange={(e) => setDistPaymentForm({...distPaymentForm, bank_name: e.target.value})} />
              </>
            )}
            <TextField fullWidth size="small" label="Receipt No" value={distPaymentForm.receipt_no} onChange={(e) => setDistPaymentForm({...distPaymentForm, receipt_no: e.target.value})} />
            <TextField fullWidth size="small" multiline rows={2} label="Note" value={distPaymentForm.note} onChange={(e) => setDistPaymentForm({...distPaymentForm, note: e.target.value})} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributorPaymentDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleSaveDistributorPayment} disabled={loading}>{loading ? 'Saving...' : 'Save Payment'}</Button>
        </DialogActions>
      </Dialog>

      {/* DISTRIBUTOR RETURN DIALOG — FIXED: item-level selection */}
      <Dialog open={distributorReturnDialog} onClose={() => setDistributorReturnDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white' }}>Process Distributor Return</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small"><InputLabel>Order *</InputLabel>
              <Select value={distReturnForm.order_id} onChange={(e) => {
                const order = distributorOrdersList.find(o => String(o.id) === String(e.target.value));
                setDistReturnForm({...distReturnForm, order_id: e.target.value, distributor_id: order?.distributor_id || '', grand_total: 0});
                if (e.target.value && db.getDistributorOrderById) {
                  db.getDistributorOrderById(e.target.value).then(detail => {
                    if (detail && detail.items) {
                      setReturnOrderItems(detail.items.map(it => ({
                        ...it,
                        return_qty: 0,
                        return_price: it.price || 0,
                        reason: '',
                        selected: false
                      })));
                    } else { setReturnOrderItems([]); }
                  }).catch(() => setReturnOrderItems([]));
                } else { setReturnOrderItems([]); }
              }} label="Order">
                <MenuItem value="">Select Order...</MenuItem>
                {distributorOrdersList.filter(o => !o.is_deleted).map(o => <MenuItem key={o.id} value={o.id}>{o.order_no || `#${o.id}`} - {distributors.find(d => String(d.id) === String(o.distributor_id))?.name || 'Unknown'}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" type="date" label="Return Date" value={distReturnForm.return_date} onChange={(e) => setDistReturnForm({...distReturnForm, return_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth size="small" type="number" label="Total Amount" value={distReturnForm.total_amount} onChange={(e) => setDistReturnForm({...distReturnForm, total_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Discount Amount" value={distReturnForm.discount_amount} onChange={(e) => setDistReturnForm({...distReturnForm, discount_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Tax Amount" value={distReturnForm.tax_amount} onChange={(e) => setDistReturnForm({...distReturnForm, tax_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Grand Total" value={distReturnForm.grand_total} onChange={(e) => setDistReturnForm({...distReturnForm, grand_total: e.target.value})} helperText="Enter actual return value (not auto-filled)" />
            <TextField fullWidth size="small" multiline rows={2} label="Notes" value={distReturnForm.notes} onChange={(e) => setDistReturnForm({...distReturnForm, notes: e.target.value})} />

            {returnOrderItems.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight="bold">Select Items to Return</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell>Select</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="center">Original Qty</TableCell>
                        <TableCell align="center">Return Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnOrderItems.map((it, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell><Checkbox size="small" checked={it.selected} onChange={(e) => {
                            const updated = [...returnOrderItems];
                            updated[idx].selected = e.target.checked;
                            setReturnOrderItems(updated);
                          }} /></TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{it.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{it.sku}</Typography>
                          </TableCell>
                          <TableCell align="center">{it.quantity}</TableCell>
                          <TableCell align="center">
                            <TextField size="small" type="number" sx={{ width: 80 }} value={it.return_qty} onChange={(e) => {
                              const updated = [...returnOrderItems];
                              updated[idx].return_qty = Math.min(parseInt(e.target.value) || 0, it.quantity);
                              setReturnOrderItems(updated);
                            }} />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(it.return_price)}</TableCell>
                          <TableCell>
                            <TextField size="small" value={it.reason} onChange={(e) => {
                              const updated = [...returnOrderItems];
                              updated[idx].reason = e.target.value;
                              setReturnOrderItems(updated);
                            }} placeholder="Reason" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributorReturnDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSaveDistributorReturn} disabled={loading}>{loading ? 'Processing...' : 'Process Return'}</Button>
        </DialogActions>
      </Dialog>

      {/* STATS DIALOG */}
      <Dialog open={statsDialog} onClose={() => setStatsDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart /> {statsEntity?.name || 'Entity'} - Performance Stats
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {statsType === 'salesman' && selectedStats && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}><Chip label={`Sales: ${selectedStats.stats?.total_sales || 0}`} color="primary" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Amount: ${formatCurrency(selectedStats.stats?.total_amount || 0)}`} color="success" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Avg: ${formatCurrency(selectedStats.stats?.avg_amount || 0)}`} color="info" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Commission: ${formatCurrency(selectedStats.stats?.total_commission || 0)}`} color="warning" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Customers: ${selectedStats.stats?.unique_customers || 0}`} variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Completed: ${formatCurrency(selectedStats.stats?.completed_amount || 0)}`} color="success" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Pending: ${formatCurrency(selectedStats.stats?.pending_amount || 0)}`} color="warning" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Target: ${formatCurrency(selectedStats.target?.target_amount || 0)}`} color="secondary" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
              </Grid>
              {selectedStats.target && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Target Achievement: {selectedStats.target.achievement_percent || 0}%</Typography>
                  <LinearProgress variant="determinate" value={Math.min(selectedStats.target.achievement_percent || 0, 100)} sx={{ height: 10, borderRadius: 5, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#6C63FF' } }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Achieved: {formatCurrency(selectedStats.target.achieved_amount || 0)}</Typography>
                    <Typography variant="caption" color="text.secondary">Target: {formatCurrency(selectedStats.target.target_amount || 0)}</Typography>
                  </Box>
                </Box>
              )}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Monthly Breakdown</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow><TableCell>Month</TableCell><TableCell align="right">Sales Count</TableCell><TableCell align="right">Total Amount</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedStats.monthly?.length === 0 ? <TableRow><TableCell colSpan={3} align="center" sx={{ py: 2 }}>No monthly data.</TableCell></TableRow> :
                      selectedStats.monthly.map((m) => (
                        <TableRow key={m.month}><TableCell>{m.month}</TableCell><TableCell align="right">{m.sales_count}</TableCell><TableCell align="right">{formatCurrency(m.total)}</TableCell></TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {statsType === 'distributor' && selectedStats && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}><Chip label={`Orders: ${selectedStats.total_orders || 0}`} color="primary" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Order Value: ${formatCurrency(selectedStats.total_order_value || 0)}`} color="success" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Paid: ${formatCurrency(selectedStats.total_paid || 0)}`} color="info" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Due: ${formatCurrency(selectedStats.total_due || 0)}`} color="error" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Pending: ${selectedStats.pending_orders || 0}`} variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Delivered: ${selectedStats.delivered_orders || 0}`} color="success" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Payments: ${formatCurrency(selectedStats.total_payments || 0)}`} color="primary" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
                <Grid item xs={6} md={3}><Chip label={`Returns: ${formatCurrency(selectedStats.total_returns || 0)}`} color="warning" variant="outlined" sx={{ width: '100%', justifyContent: 'center' }} /></Grid>
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialog(false)} startIcon={<Close />}>Close</Button>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={() => {
            if (statsType === 'salesman' && selectedStats?.monthly) exportToCSV(selectedStats.monthly, `${statsEntity?.name || 'salesman'}_monthly_stats.csv`);
          }}>Export CSV</Button>
        </DialogActions>
      </Dialog>

      {/* CUSTOMER HISTORY DIALOG */}
      <Dialog open={customerDialog} onClose={() => setCustomerDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person /> {selectedCustomer?.name || 'Customer'} - Purchase History
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {customerStats && (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6} md={3}><Chip label={`Purchases: ${customerStats.total_purchases || 0}`} color="primary" sx={{ width: '100%' }} /></Grid>
              <Grid item xs={6} md={3}><Chip label={`Spent: ${formatCurrency(customerStats.total_spent)}`} color="success" sx={{ width: '100%' }} /></Grid>
              <Grid item xs={6} md={3}><Chip label={`Paid: ${formatCurrency(customerStats.total_paid)}`} color="info" sx={{ width: '100%' }} /></Grid>
              <Grid item xs={6} md={3}><Chip label={`Due: ${formatCurrency(customerStats.total_due)}`} color="error" sx={{ width: '100%' }} /></Grid>
            </Grid>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#1c2580' }}>
                <TableRow><TableCell>Date</TableCell><TableCell>Salesman</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Due</TableCell><TableCell>Payment</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {customerHistory.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 2 }}>No purchase history.</TableCell></TableRow> :
                  customerHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.sale_date)}</TableCell>
                      <TableCell>{h.salesman_name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(h.total_amount)}</TableCell>
                      <TableCell align="right">{formatCurrency(h.paid_amount)}</TableCell>
                      <TableCell align="right" color="error">{formatCurrency(h.due_amount)}</TableCell>
                      <TableCell><Chip size="small" label={h.payment_mode || 'Cash'} variant="outlined" sx={{ height: 18, fontSize: '0.5rem' }} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={() => exportToCSV(customerHistory, `${selectedCustomer?.name || 'customer'}_history.csv`)}>Export CSV</Button>
        </DialogActions>
      </Dialog>

      {/* SALE DETAIL DIALOG */}
      <Dialog open={saleDetailDialog} onClose={() => setSaleDetailDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>Sale Details {formatCleanId(selectedSale)}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Salesman</Typography><Typography variant="body2" fontWeight="bold">{selectedSale.salesman_name || salesmen.find(s => String(s.id) === String(selectedSale.salesman_id))?.name || '-'}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Customer</Typography><Typography variant="body2" fontWeight="bold">{selectedSale.customer_name || selectedSale.customer_name_full || 'Walk-in'}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body2" fontWeight="bold">{formatDate(selectedSale.sale_date)}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Status</Typography><Chip size="small" label={selectedSale.status} color={selectedSale.status === 'Completed' ? 'success' : 'warning'} sx={{ height: 18, fontSize: '0.5rem' }} /></Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle2" fontWeight="bold">Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow><TableCell>Product</TableCell><TableCell>SKU</TableCell><TableCell align="center">Qty</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Total</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSale.items?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell><Typography variant="caption">{item.sku}</Typography></TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                        <TableCell align="right" fontWeight="bold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    )) || <TableRow><TableCell colSpan={5} align="center">No items found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
                <Typography variant="body2">Subtotal: <strong>{formatCurrency(selectedSale.subtotal)}</strong></Typography>
                <Typography variant="body2" color="error">Discount: <strong>-{formatCurrency(selectedSale.discount)}</strong></Typography>
                <Typography variant="body2">Tax: <strong>+{formatCurrency(selectedSale.tax)}</strong></Typography>
                <Typography variant="body2">Shipping: <strong>+{formatCurrency(selectedSale.shipping)}</strong></Typography>
                <Typography variant="h6" color="#6C63FF">Total: <strong>{formatCurrency(selectedSale.grand_total)}</strong></Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaleDetailDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

