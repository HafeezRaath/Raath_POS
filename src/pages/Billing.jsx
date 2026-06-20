import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Chip, Divider, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, InputAdornment, Tooltip, useMediaQuery, useTheme
} from '@mui/material';
import {
  Add, Delete, Search, Print, Save, Pause, Close,
  Settings, Receipt, ArrowBack, QrCodeScanner, Person, LocalShipping
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
const formatPKR = (amount) => {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
};

const today = () => new Date().toISOString().split('T')[0];

// ==================== THERMAL RECEIPT (58mm Style) ====================
const ThermalReceipt = React.forwardRef(({ sale, items, party, partyType }, ref) => {
  if (!sale) {
    return (
      <div ref={ref} style={{ width: '58mm', padding: '20px', textAlign: 'center', fontFamily: '"Courier New", monospace', fontSize: '12px' }}>
        <div>No receipt data</div>
      </div>
    );
  }
  
  const dateStr = sale?.date ? new Date(sale.date).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) : '';
  
  const totalQty = items?.reduce((s, i) => s + Number(i.qty || 0), 0) || 0;
  
  return (
    <div ref={ref} style={{
      width: '58mm',
      padding: '4px 6px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      lineHeight: '1.4',
      background: 'white',
      color: 'black',
      boxSizing: 'border-box'
    }}>
      {/* Store Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '2px' }}>
          RAATH POS
        </div>
        <div style={{ fontSize: '10px', marginBottom: '1px' }}>Universal Retail System</div>
        <div style={{ fontSize: '10px' }}>Phone: 0349-3860656</div>
      </div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
      
      {/* Invoice Info */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Slip: {sale?.invoiceNo || 'N/A'}</span>
          <span>Staff: Admin</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date: {dateStr}</span>
          <span>Type: {String(partyType).toUpperCase()}</span>
        </div>
      </div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
      
      {/* Party/Customer */}
      <div style={{ marginBottom: '4px', textAlign: 'center' }}>
        **** {party?.name || 'Walk-in Account'} ****
      </div>
      
      {/* Items Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '2px', fontWeight: 'bold' }}>
        <span style={{ flex: 1 }}>Description</span>
        <span style={{ width: '35px', textAlign: 'right' }}>Qty</span>
        <span style={{ width: '50px', textAlign: 'right' }}>Amount</span>
      </div>
      
      {/* Items */}
      {(items || []).map((item, idx) => (
        <div key={idx} style={{ marginBottom: '2px' }}>
          <div style={{ display: 'flex' }}>
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.name || 'Item'}</span>
            <span style={{ width: '35px', textAlign: 'right' }}>{Number(item.qty || 0).toFixed(item.qty % 1 === 0 ? 0 : 3)}</span>
            <span style={{ width: '50px', textAlign: 'right' }}>{Number(item.total || 0).toFixed(0)}</span>
          </div>
          {item.sku && (
            <div style={{ fontSize: '9px', color: '#333', paddingLeft: '4px' }}>
              {item.sku} @ {Number(item.price || 0).toFixed(0)}
            </div>
          )}
        </div>
      ))}
      
      <div style={{ borderTop: '1px solid #000', margin: '4px 0', paddingTop: '2px' }}></div>
      
      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Total Items: {items?.length || 0}</span>
        <span>Total Qty: {totalQty.toFixed(3)}</span>
      </div>
      
      <div style={{ marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sub Total:</span>
          <span>{Number(sale?.subtotal || 0).toFixed(2)}</span>
        </div>
        {sale?.itemDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Item Disc:</span>
            <span>-{Number(sale.itemDiscount).toFixed(2)}</span>
          </div>
        )}
        {sale?.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bill Disc:</span>
            <span>-{Number(sale.discount).toFixed(2)}</span>
          </div>
        )}
        {sale?.tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tax:</span>
            <span>{Number(sale.tax).toFixed(2)}</span>
          </div>
        )}
      </div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <span>GRAND TOTAL:</span>
          <span>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>
      
      <div style={{ marginTop: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Paid:</span>
          <span>{Number(sale?.paid || 0).toFixed(2)}</span>
        </div>
        {sale?.due > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Due:</span>
            <span>{Number(sale.due).toFixed(2)}</span>
          </div>
        )}
        {sale?.change > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Change:</span>
            <span>{Number(sale.change).toFixed(2)}</span>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
        <div style={{ fontSize: '10px', marginBottom: '2px' }}>Thank You! Visit Again</div>
        <div style={{ fontSize: '9px', color: '#666' }}>Powered by Raath Developers</div>
      </div>
    </div>
  );
});

// ==================== MAIN BILLING ====================
export default function BillingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // ---- STATE ----
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  
  // Entity Switch Configurations
  const [partyType, setPartyType] = useState('customer'); // 'customer' or 'supplier'
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [saleType, setSaleType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountType, setBillDiscountType] = useState('amount');
  const [taxPercent, setTaxPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState('INV-0001');
  const [heldBills, setHeldBills] = useState(() => {
    const saved = localStorage.getItem('heldBills');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [searchKey, setSearchKey] = useState(0);

  const printRef = useRef();
  const searchRef = useRef();
  const barcodeTimeoutRef = useRef();

  // ---- LOAD DATA ----
  useEffect(() => {
    loadData();
    generateInvoiceNo();
    setTimeout(() => searchRef.current?.focus(), 500);
  }, []);

  const loadData = async () => {
    try {
      const [allVariants, custs, sups, cats] = await Promise.all([
        db.getAllVariants ? db.getAllVariants() : db.getProductVariants(),
        db.getCustomers(),
        db.getSuppliers(),
        db.getCategories()
      ]);
      setProducts(allVariants || []);
      setCustomers(custs || []);
      setSuppliers(sups || []);
      setCategories(cats || []);
    } catch (err) {
      console.error("Data loading failed:", err);
    }
  };

  const generateInvoiceNo = async () => {
    try {
      if (db.getNextInvoiceNumber) {
        const nextNo = await db.getNextInvoiceNumber();
        setInvoiceNo(nextNo);
      }
    } catch (err) {
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
    }
  };

  // ---- BARCODE SCANNER LOGIC WITH STRICT CATEGORY FILTER ----
  useEffect(() => {
    const handleBarcode = (e) => {
      const now = Date.now();
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== searchRef.current) {
        return;
      }
      if (now - lastScanTime > 100 && barcodeBuffer.length > 0 && e.key !== 'Enter') {
        setBarcodeBuffer(e.key);
      } else if (e.key !== 'Enter') {
        setBarcodeBuffer(prev => prev + e.key);
      }
      setLastScanTime(now);
      
      if (e.key === 'Enter' && barcodeBuffer.length > 3) {
        e.preventDefault();
        const scannedCode = barcodeBuffer.trim().toLowerCase();
        
        const matched = products.find(p => {
          const isCodeMatch = (p.barcode || '').toLowerCase() === scannedCode || (p.sku || '').toLowerCase() === scannedCode;
          if (!isCodeMatch) return false;
          // Apply strict Category Filter validation
          if (selectedCategory && Number(p.category_id) !== Number(selectedCategory)) return false;
          return true;
        });
        
        if (matched) {
          addToCart(matched);
        } else {
          setSnackbar({ open: true, message: `Barcode not found inside selected category constraints!`, severity: 'warning' });
        }
        setBarcodeBuffer('');
      }
      
      clearTimeout(barcodeTimeoutRef.current);
      barcodeTimeoutRef.current = setTimeout(() => {
        setBarcodeBuffer('');
      }, 150);
    };
    
    window.addEventListener('keydown', handleBarcode);
    return () => {
      window.removeEventListener('keydown', handleBarcode);
      clearTimeout(barcodeTimeoutRef.current);
    };
  }, [barcodeBuffer, lastScanTime, products, selectedCategory]);

  // ---- FILTERED SEARCH LOGIC ----
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = products.filter(p => {
      // Category filter dynamic application
      if (selectedCategory && Number(p.category_id) !== Number(selectedCategory)) return false;

      const name = (p.product_name || p.variant_name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    }).slice(0, 15);
    setSearchResults(results);
  }, [searchQuery, products, selectedCategory]);

  // ---- ADD TO CART (WITH STRICTOR OUT OF STOCK CONTROLS) ----
  const addToCart = useCallback((product) => {
    const availableStock = Number(product.current_stock || 0);
    
    // 1. If stock is absolutely 0 or less, completely block addition
    if (availableStock <= 0) {
      setSnackbar({ 
        open: true, 
        message: `🚫 Cannot add! ${product.product_name || product.variant_name} is completely Out of Stock!`, 
        severity: 'error' 
      });
      return;
    }

    const price = saleType === 'wholesale' 
      ? (product.wholesale_price || product.retail_price || 0)
      : (product.retail_price || product.purchase_price || 0);

    const existingIndex = cart.findIndex(c => c.variantId === product.id);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].qty + 1;
      
      // 2. Verify if the incremented quantity exceeds the physical current stock limit
      if (newQty > availableStock) {
        setSnackbar({ 
          open: true, 
          message: `⚠️ Max available stock reached! Only ${availableStock} units are available in inventory.`, 
          severity: 'warning' 
        });
        return;
      }
      
      updated[existingIndex].qty = newQty;
      updated[existingIndex].total = updated[existingIndex].qty * updated[existingIndex].price;
      setCart(updated);
      setSnackbar({ open: true, message: `Updated quantity for ${product.product_name || product.variant_name}`, severity: 'success' });
    } else {
      // 3. Fresh cart row addition constraint check
      setCart(prev => [...prev, {
        id: Date.now(),
        variantId: product.id,
        productId: product.product_id,
        name: product.product_name || product.variant_name || 'Item Stack',
        sku: product.sku || '',
        barcode: product.barcode || '',
        qty: 1,
        price: price,
        costPrice: product.purchase_price || 0,
        total: price,
        discount: 0,
        discountType: 'amount',
        unit: product.unit || 'pc',
        stock: availableStock, // Save stock limit data reference natively into cart object row
      }]);
      setSnackbar({ open: true, message: `Added ${product.product_name || product.variant_name} to cart.`, severity: 'success' });
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1); // Force remount autocomplete UI
    
    setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
  }, [cart, saleType]);

  // ---- CART OPERATIONS (WITH STRICTOR STOCK VALUE CHANGERS) ----
  const handleQtyChange = (index, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) return;
    
    const updated = [...cart];
    const stockLimit = Number(updated[index].stock || 0);

    // Dynamic constraint check over typed value against native inventory limitation bounds
    if (val > stockLimit) {
      setSnackbar({ 
        open: true, 
        message: `⚠️ Exceeds Inventory! Total available physical stock is only ${stockLimit} ${updated[index].unit}.`, 
        severity: 'warning' 
      });
      // Rollback to maximum available stock bounds limits automatically
      updated[index].qty = stockLimit;
    } else {
      updated[index].qty = val;
    }

    updated[index].total = updated[index].qty * updated[index].price;
    setCart(updated);
  };

  const handleAmountChange = (index, amount) => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    const updated = [...cart];
    const price = updated[index].price;
    const stockLimit = Number(updated[index].stock || 0);
    
    if (price > 0) {
      let calculatedQty = Number((val / price).toFixed(3));
      
      if (calculatedQty > stockLimit) {
        setSnackbar({ 
          open: true, 
          message: `⚠️ Amount exceeds stock limitation bounds! Forced maximum capability to ${stockLimit} units.`, 
          severity: 'warning' 
        });
        calculatedQty = stockLimit;
      }
      
      updated[index].qty = calculatedQty;
      updated[index].total = calculatedQty * price;
    }
    setCart(updated);
  };

  const handlePriceChange = (index, newPrice) => {
    const val = parseFloat(newPrice);
    if (isNaN(val) || val < 0) return;
    const updated = [...cart];
    updated[index].price = val;
    updated[index].total = updated[index].qty * val;
    setCart(updated);
  };

  const handleItemDiscount = (index, discount, type) => {
    const val = parseFloat(discount) || 0;
    const updated = [...cart];
    updated[index].discount = val;
    updated[index].discountType = type;
    const base = updated[index].qty * updated[index].price;
    updated[index].total = type === 'percent' ? base - (base * val / 100) : Math.max(0, base - val);
    setCart(updated);
  };

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // ---- CALCULATION DESK ----
  const calc = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const itemDiscount = cart.reduce((sum, item) => {
      const base = item.qty * item.price;
      return sum + (item.discountType === 'percent' ? (base * (item.discount || 0) / 100) : (item.discount || 0));
    }, 0);
    
    const afterItemDisc = subtotal - itemDiscount;
    const disc = billDiscountType === 'percent' ? (afterItemDisc * (Number(billDiscount) || 0) / 100) : (Number(billDiscount) || 0);
    const afterBillDisc = Math.max(0, afterItemDisc - disc);
    const tax = afterBillDisc * (Number(taxPercent) || 0) / 100;
    const grandTotal = afterBillDisc + tax;
    const paid = Number(paidAmount) || 0;
    const due = Math.max(0, grandTotal - paid);
    const change = Math.max(0, paid - grandTotal);
    
    return {
      subtotal, itemDiscount, billDiscount: disc, tax, grandTotal,
      paid, due, change, totalItems: cart.length,
      totalQty: cart.reduce((s, i) => s + Number(i.qty), 0)
    };
  }, [cart, billDiscount, billDiscountType, taxPercent, paidAmount]);

  // ---- SAVE TRANSACTION AND RECOVERY SYSTEM (SYNC WITH DATABASE LAYER SCHEMA) ----
  const saveSale = async () => {
    if (cart.length === 0) {
      setSnackbar({ open: true, message: 'Cart empty!', severity: 'warning' });
      return;
    }

    try {
      // 1. Exact Column-Name Object mapping for SQLite DB 'sales' table 
      const saleData = {
        invoice_no: invoiceNo,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Account',
        subtotal: calc.subtotal,
        item_discount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grand_total: calc.grandTotal,
        paid_amount: calc.paid,
        due_amount: calc.due,
        change_amount: calc.change,
        payment_mode: paymentMode,
        payment_status: calc.due > 0 ? (calc.paid > 0 ? 'partial' : 'due') : 'paid',
        sale_type: saleType,
        date: new Date(invoiceDate).toISOString()
      };

      // 2. Exact Column-Name Mapping for Child Rows DB 'sale_items' table
      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        product_id: item.productId,
        quantity: item.qty,
        price: item.price,
        discount: item.discount || 0,
        total: item.total
      }));

      // 3. Save to Core DB Engine
      await db.createSale({ sale: saleData, items: itemsData });

      // 4. Core Inventory Reduction
      for (const item of cart) {
        await db.updateVariantStock(item.variantId, -item.qty);
      }

      // 5. Audit Accounting Ledgers Management based on targeted selected Entity
      if (selectedParty && calc.due > 0) {
        if (partyType === 'customer') {
          const currentBal = Number(selectedParty.current_balance || 0) + calc.due;
          await db.updateCustomer(selectedParty.id, { ...selectedParty, current_balance: currentBal });
          
          await db.addCustomerLedgerEntry({
            customer_id: selectedParty.id,
            type: 'debit',
            amount: calc.due,
            description: `Auto-generated recovery statement for Invoice #${invoiceNo}`,
            payment_mode: paymentMode
          });
        } else if (partyType === 'supplier') {
          await db.updateSupplierBalance(selectedParty.id, -calc.due);
          
          await db.addLedgerEntry({
            supplier_id: selectedParty.id,
            type: 'debit',
            amount: calc.due,
            description: `Trade asset profile transaction against Invoice #${invoiceNo}`,
            date: today()
          });
        }
      }

      // 6. General Ledger Logging Entry
      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger('Sales Assets Revenue', invoiceNo, calc.paid, calc.due, `Executed order system audit entry for invoice profile matching index ref #${invoiceNo}`);
      }

      // Legacy Object mapping fallback to cleanly compile print preview template layout engine
      const legacyReceiptMapping = {
        invoiceNo: invoiceNo,
        subtotal: calc.subtotal,
        itemDiscount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grandTotal: calc.grandTotal,
        paid: calc.paid,
        due: calc.due,
        change: calc.change,
        date: saleData.date,
        items: cart
      };

      setLastSale(legacyReceiptMapping);
      setShowReceipt(true);
      setSnackbar({ open: true, message: 'Transaction Saved and Ledgers synchronized completely!', severity: 'success' });
      
      // Reload deep database tables array references to fetch updated fresh stocks
      loadData();

      // Reset State
      setCart([]);
      setPaidAmount('');
      setBillDiscount(0);
      setTaxPercent(0);
      setSelectedParty(null);
      generateInvoiceNo();
    } catch (err) {
      console.error("Critical Save Execution Crash:", err);
      setSnackbar({ open: true, message: 'Transaction Error: ' + err.message, severity: 'error' });
    }
  };

  // ---- HOLD / RESUME ACCELERATORS ----
  const holdBill = () => {
    if (cart.length === 0) return;
    const hold = {
      id: Date.now(),
      cart: [...cart],
      party: selectedParty,
      partyType,
      total: calc.grandTotal,
      date: new Date().toISOString()
    };
    const updated = [...heldBills, hold];
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
    setCart([]);
    setSelectedParty(null);
    setSnackbar({ open: true, message: 'Current Invoice suspended and held safely.', severity: 'info' });
  };

  const resumeBill = (bill) => {
    setCart(bill.cart);
    setSelectedParty(bill.party);
    setPartyType(bill.partyType || 'customer');
    setShowResumeDialog(false);
  };

  const deleteHeld = (id) => {
    const updated = heldBills.filter(h => h.id !== id);
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
  };

  const newBill = () => {
    setCart([]);
    setSelectedParty(null);
    setPaidAmount('');
    setBillDiscount(0);
    setTaxPercent(0);
    setInvoiceDate(today());
    generateInvoiceNo();
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    searchRef.current?.focus();
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(`
      <html>
        <head>
          <title>Thermal Output Reference #${lastSale?.invoiceNo || ''}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; padding: 0; font-family: "Courier New", Courier, monospace; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 200);
          }
        </script>
      </html>
    `);
    win.document.close();
  };

  // ---- HOTKEYS ACCELERATORS STRUCT ----
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (!['F1','F3','F5','F9','F10','Escape'].includes(e.key)) return;
      }
      if (e.key === 'F9') { e.preventDefault(); saveSale(); }
      if (e.key === 'F10') { e.preventDefault(); newBill(); }
      if (e.key === 'F3') { e.preventDefault(); holdBill(); }
      if (e.key === 'F5') { e.preventDefault(); setShowResumeDialog(true); }
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { 
        setShowReceipt(false); 
        setShowHoldDialog(false); 
        setShowResumeDialog(false); 
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, calc, lastSale, selectedParty, partyType]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5', overflow: 'hidden' }}>
      
      {/* ===== HEADER ===== */}
      <Paper sx={{ bgcolor: '#10b981', color: 'white', px: 1.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0, flexShrink: 0 }}>
        <Receipt sx={{ fontSize: 28 }} />
        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
          Raath Terminal Management System (POS v2.0)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Receipt />} onClick={() => setShowResumeDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">
            Held Receipts (F5)
          </Button>
          <Button size="small" startIcon={<Pause />} onClick={() => setShowHoldDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">
            Hold (F3)
          </Button>
        </Box>
      </Paper>

      {/* ===== BARCODE AND FILTERS SECTION ===== */}
      <Paper sx={{ px: 1.5, py: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        
        {/* Category Filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Category Filter</InputLabel>
          <Select 
            value={selectedCategory} 
            label="Category Filter" 
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <MenuItem value=""><em>All Categories (Show All)</em></MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Barcode Autocomplete Field */}
        <Autocomplete
          key={searchKey}
          freeSolo
          options={searchResults}
          getOptionLabel={(o) => typeof o === 'string' ? o : `${o.product_name || o.variant_name} (Stock: ${o.current_stock || 0})`}
          inputValue={searchQuery}
          onInputChange={(e, v) => setSearchQuery(v)}
          onChange={(e, v) => { if (v && typeof v !== 'string') addToCart(v); }}
          sx={{ flex: 1, minWidth: 250, maxWidth: 400 }}
          renderInput={(params) => (
            <TextField 
              {...params} 
              inputRef={searchRef}
              size="small" 
              placeholder={selectedCategory ? "Search filtered items... (F1)" : "Universal search / Scan Barcode (F1)"}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <QrCodeScanner sx={{ color: '#10b981', fontSize: 18 }} />
                  </InputAdornment>
                )
              }}
            />
          )}
          renderOption={(props, option) => {
            const isOut = Number(option.current_stock || 0) <= 0;
            return (
              <li { ...props} style={{ opacity: isOut ? 0.5 : 1, backgroundColor: isOut ? '#f3f4f6' : 'transparent' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.product_name || option.variant_name}
                      {isOut && <Chip label="OUT" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem', ml: 1 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{option.sku || 'No SKU'}</Typography>
                  </Box>
                  <Typography variant="caption" color="primary" fontWeight="bold">
                    Rs. {saleType === 'wholesale' ? option.wholesale_price : option.retail_price}
                  </Typography>
                </Box>
              </li>
            );
          }}
          filterOptions={(x) => x}
          clearOnBlur={false}
          disableClearable
        />

        <Button variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} onClick={() => searchResults[0] && addToCart(searchResults[0])}>
          <Add />
        </Button>

        {/* Party Switcher */}
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }}>
            <MenuItem value="customer">Customer</MenuItem>
            <MenuItem value="supplier">Supplier</MenuItem>
          </Select>
        </FormControl>

        {/* Party Selector */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{partyType === 'customer' ? 'Select Customer Account' : 'Select Supplier Account'}</InputLabel>
          <Select 
            value={selectedParty?.id || ''} 
            onChange={(e) => {
              const dataset = partyType === 'customer' ? customers : suppliers;
              const match = dataset.find(x => x.id === e.target.value);
              setSelectedParty(match || null);
            }}
            label={partyType === 'customer' ? 'Select Customer Account' : 'Select Supplier Account'}
          >
            <MenuItem value=""><em>Walk-in (Cash Account Ledger)</em></MenuItem>
            {(partyType === 'customer' ? customers : suppliers).map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} {p.company_name ? `[${p.company_name}]` : ''} - (Bal: {p.current_balance || 0})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 145 }} />

        <Button 
          size="small" 
          variant={saleType === 'wholesale' ? 'contained' : 'outlined'}
          onClick={() => setSaleType(prev => prev === 'retail' ? 'wholesale' : 'retail')}
          sx={{ bgcolor: saleType === 'wholesale' ? '#10b981' : undefined }}
        >
          {saleType === 'retail' ? 'Retail View' : 'Wholesale Formula'}
        </Button>
      </Paper>

      {/* ===== MATRIX CART VIEWPORT ===== */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1, p: 1, flexDirection: { xs: 'column', md: 'row' } }}>
        
        {/* LEFT VIEWPORT: TABLE ITEMS */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  {['Action', '#Sr', 'SKU/Code', 'Item Name', 'Cost Price', 'Qty', 'Unit', 'Price Rate', 'Item Discount', 'Total Net'].map((h) => (
                    <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', py: 1 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.map((item, idx) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontSize: '0.72rem' }}>{item.sku}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{item.name}</TableCell>
                    <TableCell>{formatPKR(item.costPrice)}</TableCell>
                    <TableCell>
                      <TextField
                        type="number" size="small" value={item.qty}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        inputProps={{ step: 0.001, style: { textAlign: 'center', padding: '4px' } }}
                        sx={{ width: 75 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{item.unit}</TableCell>
                    <TableCell>
                      <TextField
                        type="number" size="small" value={item.price}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        inputProps={{ style: { textAlign: 'right', padding: '4px' } }}
                        sx={{ width: 85 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <TextField
                          type="number" size="small" value={item.discount || ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value, item.discountType)}
                          inputProps={{ style: { textAlign: 'right', padding: '4px' } }}
                          sx={{ width: 60 }}
                        />
                        <Chip 
                          size="small" label={item.discountType === 'percent' ? '%' : 'Rs'}
                          onClick={() => handleItemDiscount(idx, item.discount, item.discountType === 'percent' ? 'amount' : 'percent')}
                          sx={{ cursor: 'pointer', height: 22, fontWeight: 'bold' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number" size="small" value={item.total}
                        onChange={(e) => handleAmountChange(idx, e.target.value)}
                        inputProps={{ style: { textAlign: 'right', fontWeight: 'bold', color: '#10b981', padding: '4px' } }}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                
                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 10 }}>
                      <Search sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                      <Typography color="text.secondary">Cart Empty — Apply filters above to scan assets</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* RIGHT PANEL: PAYMENT & TOTAL CALCULATIONS */}
        <Paper sx={{ width: { xs: '100%', md: 330 }, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'auto', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Gross Sub Total</Typography>
            <Typography fontWeight="bold" color="#10b981" variant="h6">{formatPKR(calc.subtotal)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Net Payable</Typography>
            <Typography fontWeight="bold" color="#059669" variant="h6">{formatPKR(calc.grandTotal)}</Typography>
          </Box>

          <Divider />

          {/* Discount Block */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: 85, fontSize: '0.8rem', fontWeight: 500 }}>Discount</Typography>
            <TextField size="small" type="number" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} sx={{ flex: 1 }} placeholder="Value" />
            <Select size="small" value={billDiscountType} onChange={(e) => setBillDiscountType(e.target.value)} sx={{ width: 80 }}>
              <MenuItem value="amount">Rs</MenuItem>
              <MenuItem value="percent">%</MenuItem>
            </Select>
          </Box>

          {/* Tax Selector */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: 85, fontSize: '0.8rem', fontWeight: 500 }}>Tax Percent</Typography>
            <FormControl size="small" report-node="true" sx={{ flex: 1 }}>
              <Select value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)}>
                <MenuItem value={0}>Non-Taxable (0%)</MenuItem>
                <MenuItem value={5}>GST Premium (5%)</MenuItem>
                <MenuItem value={17}>FBR Standard (17%)</MenuItem>
                <MenuItem value={18}>FBR Standard Variant (18%)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Payment Mode Selector */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: 85, fontSize: '0.8rem', fontWeight: 500 }}>Payment Method</Typography>
            <FormControl size="small" sx={{ flex: 1 }}>
              <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <MenuItem value="cash">Cash Account</MenuItem>
                <MenuItem value="bank">Bank Wire</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa Hub</MenuItem>
                <MenuItem value="jazzcash">JazzCash Wallet</MenuItem>
                <MenuItem value="credit">Open Book (Udhaar Ledger)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Paid Amount Input */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: 85, fontSize: '0.8rem', fontWeight: 700 }}>Paid Amount</Typography>
            <TextField size="small" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} sx={{ flex: 1 }} placeholder="0.00" inputProps={{ style: { fontWeight: 'bold' } }} />
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Ledger Warning Boxes */}
          {calc.due > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#fef2f2', p: 1, borderRadius: 1, border: '1px solid #fecaca' }}>
              <Typography color="error" fontWeight="bold" fontSize="0.82rem">Receivable Ledger Debit</Typography>
              <Typography color="error" fontWeight="bold">{formatPKR(calc.due)}</Typography>
            </Box>
          )}
          {calc.change > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f0fdf4', p: 1, borderRadius: 1, border: '1px solid #bbf7d0' }}>
              <Typography color="green" fontWeight="bold" fontSize="0.82rem">Cashback Balance Due</Typography>
              <Typography color="green" fontWeight="bold">{formatPKR(calc.change)}</Typography>
            </Box>
          )}

          <Button fullWidth variant="contained" onClick={saveSale} sx={{ bgcolor: '#10b981', py: 1.2, fontWeight: 'bold', fontSize: '1rem', '&:hover': { bgcolor: '#059669' }, mt: 'auto' }}>
            Process Invoice: {formatPKR(calc.grandTotal)}
          </Button>
        </Paper>
      </Box>

      {/* ===== BOTTOM SYSTEM STATUS BAR ===== */}
      <Paper sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderTop: '2px solid #10b981', flexShrink: 0, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">Cart Row Count</Typography>
            <Typography variant="h6" fontWeight="bold" color="#10b981">{calc.totalItems}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">Total Vol/Qty</Typography>
            <Typography variant="h6" fontWeight="bold" color="#10b981">{calc.totalQty.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">Balance Account Due</Typography>
            <Typography variant="h6" fontWeight="bold" color={calc.due > 0 ? 'error' : '#10b981'}>{formatPKR(calc.due)}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Save />} onClick={saveSale} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
            Save (F9)
          </Button>
          <Button variant="contained" startIcon={<Close />} onClick={newBill} sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}>
            Clear (F10)
          </Button>
        </Box>
      </Paper>

      {/* ===== RECEIPT PREVIEW DIALOG ===== */}
      <Dialog open={showReceipt} onClose={() => setShowReceipt(false)} maxWidth="xs">
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', py: 1, fontSize: '1rem' }}>
          Receipt Printed Successfully Profile Engine
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#f3f4f6' }}>
          <div style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }}>
            <ThermalReceipt ref={printRef} sale={lastSale} items={lastSale?.items || []} party={selectedParty} partyType={partyType} />
          </div>
          <Paper sx={{ p: 1, width: '58mm', bgcolor: 'white', boxShadow: 3 }}>
            <ThermalReceipt sale={lastSale} items={lastSale?.items || []} party={selectedParty} partyType={partyType} />
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReceipt(false)}>Close (Esc)</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<Print />} sx={{ bgcolor: '#10b981' }}>Print Slip</Button>
        </DialogActions>
      </Dialog>

      {/* ===== SUSPENDED/HELD BILLS DIALOG ===== */}
      <Dialog open={showResumeDialog} onClose={() => setShowResumeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Suspended/Held Queue Slips</DialogTitle>
        <DialogContent>
          {heldBills.length === 0 ? <Alert severity="info">No orders on ice.</Alert> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Party Details</TableCell>
                    <TableCell>Total Gross</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {heldBills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.id.toString().slice(-5)}</TableCell>
                      <TableCell>{bill.party?.name || 'Cash Walk-in'} ({bill.partyType})</TableCell>
                      <TableCell>{formatPKR(bill.total)}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => resumeBill(bill)} variant="contained" sx={{ bgcolor: '#10b981', mr: 1 }}>Resume</Button>
                        <Button size="small" onClick={() => deleteHeld(bill.id)} color="error">Drop</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== SUSPEND DIALOG TRIGGER ===== */}
      <Dialog open={showHoldDialog} onClose={() => setShowHoldDialog(false)}>
        <DialogTitle>Suspend Transaction</DialogTitle>
        <DialogContent><Typography>This snapshot will freeze current items into system local memory state pool.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHoldDialog(false)}>Cancel</Button>
          <Button onClick={() => { holdBill(); setShowHoldDialog(false); }} variant="contained" sx={{ bgcolor: '#f59e0b' }}>Freeze Stack</Button>
        </DialogActions>
      </Dialog>

      {/* ===== SNACKBAR ENGINE ===== */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}