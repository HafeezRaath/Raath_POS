import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Chip, Divider, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, InputAdornment, Tooltip, useMediaQuery, useTheme,
  Grid, Card, CardContent, Stack, Badge, Collapse,
  List, ListItem, ListItemText, ListItemIcon,
  BottomNavigation, BottomNavigationAction, Drawer
} from '@mui/material';
import {
  Add, Delete, Search, Print, Save, Pause, Close,
  Receipt, QrCodeScanner, LocalOffer, ShoppingCart,
  Menu as MenuIcon, KeyboardArrowDown, KeyboardArrowUp,
  CheckCircle, Print as PrintIcon
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
const formatPKR = (amount) => {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
};

const today = () => new Date().toISOString().split('T')[0];

// ==================== THERMAL RECEIPT ====================
const ThermalReceipt = React.forwardRef(({ sale, items, party, partyType }, ref) => {
  if (!sale) {
    return (
      <div ref={ref} style={{ width: '80mm', padding: '20px', textAlign: 'center' }}>
        <div>No receipt data</div>
      </div>
    );
  }

  const dateStr = sale?.date ? new Date(sale.date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) : '';

  const totalQty = items?.reduce((s, i) => s + Number(i.qty || 0), 0) || 0;

  return (
    <div ref={ref} style={{
      width: '80mm',
      padding: '8px 12px',
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '11px',
      lineHeight: '1.5',
      background: '#fff',
      color: '#1a1a1a',
      boxSizing: 'border-box'
    }}>
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '2px solid #10b981' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '2px', color: '#10b981', textTransform: 'uppercase' }}>
          RAATH POS
        </div>
        <div style={{ fontSize: '11px', color: '#666' }}>Universal Retail Management System</div>
        <div style={{ fontSize: '10px', color: '#888' }}>
          <span style={{ marginRight: '8px' }}>📞 0349-3860656</span>
          <span>📍 Main Market, Lahore</span>
        </div>
      </div>

      {/* INVOICE INFO */}
      <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ color: '#64748b' }}>Invoice #</span>
          <span style={{ fontWeight: '700', color: '#10b981' }}>{sale?.invoiceNo || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ color: '#64748b' }}>Date</span>
          <span style={{ fontWeight: '600' }}>{dateStr}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Type</span>
          <span style={{ fontWeight: '700', color: partyType === 'customer' ? '#3b82f6' : '#f59e0b', textTransform: 'uppercase', fontSize: '10px' }}>
            {String(partyType).toUpperCase()}
          </span>
        </div>
      </div>

      {/* CUSTOMER INFO */}
      <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600' }}>BILL TO</div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e40af' }}>{party?.name || 'Walk-in Customer'}</div>
        {party?.phone && <div style={{ fontSize: '10px', color: '#64748b' }}>📱 {party.phone}</div>}
      </div>

      {/* ITEMS TABLE */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', background: '#10b981', color: 'white', padding: '6px 8px', borderRadius: '4px 4px 0 0', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase' }}>
          <span style={{ flex: 1 }}>Item</span>
          <span style={{ width: '35px', textAlign: 'center' }}>Qty</span>
          <span style={{ width: '50px', textAlign: 'right' }}>Price</span>
          <span style={{ width: '50px', textAlign: 'right' }}>Total</span>
        </div>

        {(items || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', padding: '6px 8px', borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: '600' }}>{item.name || 'Item'}</span>
              {item.isOfferItem && <span style={{ background: '#dcfce7', color: '#166534', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>OFFER</span>}
              <br/><span style={{ fontSize: '9px', color: '#94a3b8' }}>{item.sku || ''}</span>
            </span>
            <span style={{ width: '35px', textAlign: 'center', fontWeight: '600' }}>{Number(item.qty || 0).toFixed(0)}</span>
            <span style={{ width: '50px', textAlign: 'right', color: '#64748b' }}>{Number(item.price || 0).toFixed(0)}</span>
            <span style={{ width: '50px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>{Number(item.total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* SUMMARY */}
      <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '10px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span style={{ color: '#64748b' }}>Total Items</span>
          <span style={{ fontWeight: '600' }}>{items?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px' }}>
          <span style={{ color: '#64748b' }}>Total Quantity</span>
          <span style={{ fontWeight: '600' }}>{totalQty.toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Sub Total</span>
            <span style={{ fontWeight: '600' }}>Rs. {Number(sale?.subtotal || 0).toFixed(2)}</span>
          </div>
          {sale?.itemDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444' }}>Item Discount</span>
            <span style={{ color: '#ef4444' }}>-Rs. {Number(sale.itemDiscount).toFixed(2)}</span>
          </div>}
          {sale?.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444' }}>Bill Discount</span>
            <span style={{ color: '#ef4444' }}>-Rs. {Number(sale.discount).toFixed(2)}</span>
          </div>}
          {sale?.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Tax</span>
            <span>Rs. {Number(sale.tax).toFixed(2)}</span>
          </div>}
        </div>

        <div style={{ borderTop: '2px solid #10b981', marginTop: '6px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: '800' }}>GRAND TOTAL</span>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* PAYMENT DETAILS */}
      <div style={{ background: '#ecfdf5', borderRadius: '6px', padding: '8px 10px', border: '1px solid #a7f3d0', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#059669', fontWeight: '600' }}>Paid Amount</span>
          <span style={{ fontWeight: '700', color: '#059669' }}>Rs. {Number(sale?.paid || 0).toFixed(2)}</span>
        </div>
        {sale?.due > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#dc2626', fontWeight: '600' }}>Balance Due</span>
          <span style={{ fontWeight: '700', color: '#dc2626' }}>Rs. {Number(sale.due).toFixed(2)}</span>
        </div>}
        {sale?.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#059669', fontWeight: '600' }}>Change Return</span>
          <span style={{ fontWeight: '700', color: '#059669' }}>Rs. {Number(sale.change).toFixed(2)}</span>
        </div>}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>Thank You For Your Business!</div>
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Goods once sold will not be taken back</div>
        <div style={{ fontSize: '9px', color: '#cbd5e1' }}>Powered by Raath Developers</div>
      </div>
    </div>
  );
});

// ==================== PRINTER SETTINGS DIALOG ====================
const PrinterSettingsDialog = ({ open, onClose, onPrinterSelect }) => {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadPrinters();
  }, [open]);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.getPrinters) {
        const list = await window.electronAPI.getPrinters();
        setPrinters(list || []);
      } else {
        setPrinters([
          { name: 'EPSON TM-T88V' },
          { name: 'Thermal Printer (USB)' },
          { name: 'Microsoft Print to PDF' }
        ]);
      }
      const saved = localStorage.getItem('default_printer');
      if (saved) setSelectedPrinter(saved);
    } catch (err) {
      console.error('Failed to load printers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (printerName) => {
    setSelectedPrinter(printerName);
    localStorage.setItem('default_printer', printerName);
    if (onPrinterSelect) onPrinterSelect(printerName);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <PrintIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Printer Settings
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Select your default thermal printer. Press F12 to change anytime.
        </Alert>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}><Typography>Loading printers...</Typography></Box>
        ) : printers.length === 0 ? (
          <Alert severity="warning">No printers found.</Alert>
        ) : (
          <List>
            {printers.map((printer) => (
              <ListItem
                key={printer.name}
                button
                onClick={() => handleSelect(printer.name)}
                sx={{
                  bgcolor: selectedPrinter === printer.name ? 'success.light' : 'transparent',
                  borderRadius: 1,
                  mb: 0.5,
                  border: selectedPrinter === printer.name ? '2px solid #10b981' : '1px solid transparent'
                }}
              >
                <ListItemIcon>
                  {selectedPrinter === printer.name ? <CheckCircle color="success" /> : <PrintIcon />}
                </ListItemIcon>
                <ListItemText primary={printer.name} />
                {selectedPrinter === printer.name && <Chip label="Selected" color="success" size="small" />}
              </ListItem>
            ))}
          </List>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          💡 Printer saved automatically. Press F12 to change.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== KEYBOARD SHORTCUTS ====================
const ShortcutsHelp = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>⌨️ Keyboard Shortcuts</DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      <Grid container spacing={1}>
        <Grid item xs={4}><Chip label="F1" size="small" color="primary" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Focus Search Bar</Typography></Grid>
        <Grid item xs={4}><Chip label="F3" size="small" color="warning" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Hold Current Bill</Typography></Grid>
        <Grid item xs={4}><Chip label="F5" size="small" color="info" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">View Held Bills</Typography></Grid>
        <Grid item xs={4}><Chip label="F9" size="small" color="success" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Save & Print Receipt</Typography></Grid>
        <Grid item xs={4}><Chip label="F10" size="small" color="error" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">New Bill / Clear Cart</Typography></Grid>
        <Grid item xs={4}><Chip label="F12" size="small" color="secondary" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Printer Settings</Typography></Grid>
        <Grid item xs={4}><Chip label="Esc" size="small" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Close Dialog</Typography></Grid>
        <Grid item xs={4}><Chip label="Enter" size="small" color="primary" sx={{ minWidth: 50 }} /></Grid>
        <Grid item xs={8}><Typography variant="body2">Add Product / Next Field / Save</Typography></Grid>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Alert severity="success">
        <Typography variant="body2" fontWeight="bold">🚀 Mouse usage is minimal! Use keyboard for fast billing.</Typography>
      </Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#10b981' }}>Got It!</Button>
    </DialogActions>
  </Dialog>
);

// ==================== MOBILE CART ITEM ====================
const MobileCartItem = React.memo(({ item, index, onQtyChange, onPriceChange, onDiscountChange, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1, borderLeft: item.isOfferItem ? '4px solid #f59e0b' : '4px solid #10b981' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight="bold">{item.name}</Typography>
            <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="#10b981">{formatPKR(item.total)}</Typography>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <TextField
                id={`mobile-qty-${index}`}
                label="Qty" type="number" size="small" value={item.qty}
                onChange={(e) => onQtyChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById(`mobile-price-${index}`)?.focus();
                  }
                }}
                inputProps={{ step: 0.001, style: { textAlign: 'center' } }} fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                id={`mobile-price-${index}`}
                label="Price" type="number" size="small" value={item.price}
                onChange={(e) => onPriceChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById(`mobile-discount-${index}`)?.focus();
                  }
                }}
                inputProps={{ style: { textAlign: 'right' } }} fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  id={`mobile-discount-${index}`}
                  label="Disc" type="number" size="small" value={item.discount || ''}
                  onChange={(e) => onDiscountChange(index, e.target.value, item.discountType)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('mobile-paid-input')?.focus();
                    }
                  }}
                  fullWidth
                />
                <Chip size="small" label={item.discountType === 'percent' ? '%' : 'Rs'}
                  onClick={() => onDiscountChange(index, item.discount, item.discountType === 'percent' ? 'amount' : 'percent')}
                  sx={{ cursor: 'pointer', height: 30, minWidth: 35 }} />
              </Box>
            </Grid>
          </Grid>
          <Button fullWidth variant="outlined" color="error" size="small" startIcon={<Delete />}
            onClick={() => onRemove(index)} sx={{ mt: 1 }}>Remove</Button>
        </Collapse>
      </CardContent>
    </Card>
  );
});

// ==================== MAIN COMPONENT ====================
export default function BillingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // ---- STATE ----
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  const [partyType, setPartyType] = useState('customer');
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [saleType, setSaleType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
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
  const [searchKey, setSearchKey] = useState(0);
  const [offers, setOffers] = useState([]);
  const [showOffersDialog, setShowOffersDialog] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  
  // Printer
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  const printRef = useRef();
  const searchRef = useRef();

  // ---- LOAD ----
  useEffect(() => {
    const saved = localStorage.getItem('default_printer');
    if (saved) setDefaultPrinter(saved);
  }, []);

  useEffect(() => {
    loadData();
    generateInvoiceNo();
    setTimeout(() => searchRef.current?.focus(), 500);
  }, []);

  const loadData = async () => {
    try {
      const [allVariants, custs, sups, cats, offs] = await Promise.all([
        db.getAllVariants ? db.getAllVariants() : db.getProductVariants(),
        db.getCustomers(),
        db.getSuppliers(),
        db.getCategories(),
        db.getOffers ? db.getOffers() : Promise.resolve([])
      ]);
      setProducts(allVariants || []);
      setCustomers(custs || []);
      setSuppliers(sups || []);
      setCategories(cats || []);
      setOffers(offs || []);
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

  // ---- SEARCH ----
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = products.filter(p => {
      if (selectedCategory && Number(p.category_id) !== Number(selectedCategory)) return false;
      const name = (p.product_name || p.variant_name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    }).slice(0, 15);
    setSearchResults(results);
  }, [searchQuery, products, selectedCategory]);

  // ---- ADD TO CART ----
  const addToCart = useCallback((product) => {
    const availableStock = Number(product.current_stock || 0);
    if (availableStock <= 0) {
      setSnackbar({ open: true, message: `🚫 ${product.product_name} Out of Stock!`, severity: 'error' });
      return;
    }

    const price = saleType === 'wholesale' 
      ? (product.wholesale_price || product.retail_price || 0)
      : (product.retail_price || product.purchase_price || 0);

    const existingIndex = cart.findIndex(c => c.variantId === product.id);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].qty + 1;
      if (newQty > availableStock) {
        setSnackbar({ open: true, message: `⚠️ Only ${availableStock} available!`, severity: 'warning' });
        return;
      }
      updated[existingIndex].qty = newQty;
      updated[existingIndex].total = updated[existingIndex].qty * updated[existingIndex].price;
      setCart(updated);
    } else {
      setCart(prev => [...prev, {
        id: Date.now(),
        variantId: product.id,
        productId: product.product_id,
        name: product.product_name || product.variant_name || 'Item',
        sku: product.sku || '',
        qty: 1,
        price: price,
        total: price,
        discount: 0,
        discountType: 'amount',
        stock: availableStock,
        isOfferItem: false,
        offerName: null
      }]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [cart, saleType]);

  // ---- CART OPERATIONS ----
  const handleQtyChange = (index, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) return;
    const updated = [...cart];
    const stockLimit = Number(updated[index].stock || 0);
    updated[index].qty = val > stockLimit ? stockLimit : val;
    updated[index].total = updated[index].qty * updated[index].price;
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
    updated[index].discountType = type || 'amount';
    const base = updated[index].qty * updated[index].price;
    updated[index].total = type === 'percent' ? base - (base * val / 100) : Math.max(0, base - val);
    setCart(updated);
  };

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // ---- CALCULATIONS ----
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

  // ---- PRINT ----
  const handlePrint = useCallback(async () => {
    const content = printRef.current;
    if (!content) return;

    const printHTML = `
      <html><head>
        <title>Receipt #${lastSale?.invoiceNo || ''}</title>
        <style>@page { size: 58mm auto; margin: 0; }
        body { margin: 0; padding: 0; font-family: "Courier New", Courier, monospace; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }</style>
      </head><body>${content.innerHTML}</body></html>
    `;

    if (window.electronAPI && window.electronAPI.printReceipt && defaultPrinter) {
      try {
        await window.electronAPI.printReceipt(printHTML);
        setSnackbar({ open: true, message: `🖨️ Sent to ${defaultPrinter}`, severity: 'success' });
        return;
      } catch (err) {
        console.error('Print failed:', err);
      }
    }
    
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(printHTML);
    win.document.close();
    win.onload = () => { setTimeout(() => { win.print(); setTimeout(() => win.close(), 500); }, 200); };
  }, [lastSale, defaultPrinter]);

  // ---- SAVE ----
  const saveSale = async () => {
    if (cart.length === 0) {
      setSnackbar({ open: true, message: 'Cart is empty!', severity: 'warning' });
      return;
    }

    try {
      const saleData = {
        invoice_no: invoiceNo,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Customer',
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

      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        product_id: item.productId,
        quantity: item.qty,
        price: item.price,
        discount: item.discount || 0,
        total: item.total
      }));

      await db.createSale({ sale: saleData, items: itemsData });

      for (const item of cart) {
        await db.updateVariantStock(item.variantId, -item.qty);
      }

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
      
      if (defaultPrinter) {
        setTimeout(handlePrint, 500);
      }
      
      setSnackbar({ open: true, message: '✅ Transaction saved!', severity: 'success' });
      
      loadData();
      setCart([]);
      setPaidAmount('');
      setBillDiscount(0);
      setTaxPercent(0);
      setSelectedParty(null);
      generateInvoiceNo();
    } catch (err) {
      console.error("Save error:", err);
      setSnackbar({ open: true, message: '❌ Error: ' + err.message, severity: 'error' });
    }
  };

  // ---- HOLD / RESUME ----
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
    setSnackbar({ open: true, message: '⏸️ Bill held!', severity: 'info' });
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

  // ---- APPLY OFFER ----
  const applyOffer = async (offer) => {
    try {
      let offerItems = [];
      if (db.getOfferItems) {
        const res = await db.getOfferItems(offer.id);
        offerItems = res.data || res || [];
      }

      if (!offerItems.length) {
        setSnackbar({ open: true, message: 'Offer has no items!', severity: 'warning' });
        return;
      }

      for (const item of offerItems) {
        const product = products.find(p => p.id === item.variant_id);
        if (product) {
          const offerPrice = Number(item.offer_price) || Number(product.retail_price) || 0;
          setCart(prev => [...prev, {
            id: Date.now() + Math.random(),
            variantId: product.id,
            productId: product.product_id,
            name: item.product_name || product.product_name || 'Offer Item',
            sku: item.sku || product.sku || '',
            qty: 1,
            price: offerPrice,
            total: offerPrice,
            discount: 0,
            discountType: 'amount',
            stock: Number(product.current_stock) || 0,
            isOfferItem: true,
            offerName: offer.name
          }]);
        }
      }

      setSnackbar({ open: true, message: `🎉 Offer "${offer.name}" added!`, severity: 'success' });
      setShowOffersDialog(false);
    } catch (err) {
      console.error('Apply offer error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
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
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ---- HOTKEYS ----
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (!['F1','F3','F5','F9','F10','F12','Escape'].includes(e.key)) return;
      }
      
      switch(e.key) {
        case 'F1': e.preventDefault(); searchRef.current?.focus(); break;
        case 'F3': e.preventDefault(); if (cart.length > 0) holdBill(); break;
        case 'F5': e.preventDefault(); setShowResumeDialog(true); break;
        case 'F9': e.preventDefault(); if (cart.length > 0) saveSale(); break;
        case 'F10': e.preventDefault(); if (cart.length > 0 && window.confirm('Clear cart?')) newBill(); else newBill(); break;
        case 'F12': e.preventDefault(); setShowPrinterSettings(true); break;
        case 'Escape': setShowReceipt(false); setShowHoldDialog(false); setShowResumeDialog(false); setShowOffersDialog(false); break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, saveSale]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5', overflow: 'hidden', pb: isMobile ? 6 : 0 }}>
      
      {/* HEADER */}
      <Paper sx={{ bgcolor: '#10b981', color: 'white', px: isMobile ? 1 : 2, py: isMobile ? 1 : 1.5, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 0, flexShrink: 0 }}>
        <Receipt sx={{ fontSize: isMobile ? 24 : 28 }} />
        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" sx={{ flex: 1, fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
          {isMobile ? 'POS' : 'Raath Terminal POS'}
        </Typography>
        
        {defaultPrinter && !isMobile && (
          <Chip icon={<PrintIcon />} label={defaultPrinter.length > 20 ? defaultPrinter.substring(0, 20) + '...' : defaultPrinter} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 1 }} onClick={() => setShowPrinterSettings(true)} />
        )}
        
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" startIcon={<Receipt />} onClick={() => setShowResumeDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Held (F5)</Button>
            <Button size="small" startIcon={<Pause />} onClick={() => setShowHoldDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Hold (F3)</Button>
            <Button size="small" startIcon={<LocalOffer />} onClick={() => setShowOffersDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Offers</Button>
            <Button size="small" startIcon={<PrintIcon />} onClick={() => setShowPrinterSettings(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Printer</Button>
            <Button size="small" startIcon={<KeyboardArrowDown />} onClick={() => setShowShortcuts(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">⌨️</Button>
          </Box>
        )}
        
        {isMobile && (
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => setMobileDrawer(true)}><MenuIcon /></IconButton>
        )}
      </Paper>

      {/* SHORTCUTS BAR */}
      {!isMobile && (
        <Paper sx={{ px: 2, py: 0.5, display: 'flex', gap: 2, borderRadius: 0, bgcolor: '#f8fafc', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
            ⌨️ <Chip label="F1" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5 }} /> Search
            <Chip label="F3" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5 }} /> Hold
            <Chip label="F5" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5 }} /> Held
            <Chip label="F9" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5, bgcolor: '#10b981', color: 'white' }} /> Save
            <Chip label="F10" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5, bgcolor: '#ef4444', color: 'white' }} /> New
            <Chip label="F12" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.5 }} /> Printer
          </Typography>
          {defaultPrinter && <Typography variant="caption" color="text.secondary">🖨️ {defaultPrinter}</Typography>}
        </Paper>
      )}

      {/* SEARCH & FILTERS */}
      <Paper sx={{ px: isMobile ? 1 : 1.5, py: isMobile ? 1 : 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {!isMobile && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select value={selectedCategory} label="Category" onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }}>
              <MenuItem value="">All</MenuItem>
              {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Autocomplete
          key={searchKey}
          freeSolo
          options={searchResults}
          getOptionLabel={(o) => typeof o === 'string' ? o : `${o.product_name || o.variant_name} (${o.current_stock || 0})`}
          inputValue={searchQuery}
          onInputChange={(e, v) => setSearchQuery(v)}
          onChange={(e, v) => { if (v && typeof v !== 'string') addToCart(v); }}
          sx={{ flex: 1, minWidth: isMobile ? 120 : 250 }}
          renderInput={(params) => (
            <TextField 
              {...params} 
              inputRef={searchRef}
              size="small" 
              placeholder={isMobile ? "Search/Scan..." : "Search or Scan Barcode (F1)"}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    {scanMode ? <QrCodeScanner sx={{ color: '#10b981', fontSize: 18 }} /> : <Search sx={{ color: '#10b981', fontSize: 18 }} />}
                  </InputAdornment>
                ),
                endAdornment: isMobile && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setScanMode(!scanMode)} color={scanMode ? 'success' : 'default'}>
                      <QrCodeScanner fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          )}
          renderOption={(props, option) => {
            const isOut = Number(option.current_stock || 0) <= 0;
            return (
              <li {...props} style={{ opacity: isOut ? 0.5 : 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.product_name || option.variant_name}
                      {isOut && <Chip label="OUT" size="small" color="error" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{option.sku}</Typography>
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

        {!isMobile && (
          <>
            <Button variant="contained" sx={{ bgcolor: '#10b981', minWidth: 'auto' }} onClick={() => searchResults[0] && addToCart(searchResults[0])}>
              <Add />
            </Button>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }}>
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{partyType === 'customer' ? 'Select Customer' : 'Select Supplier'}</InputLabel>
              <Select value={selectedParty?.id || ''} onChange={(e) => {
                const dataset = partyType === 'customer' ? customers : suppliers;
                const match = dataset.find(x => x.id === e.target.value);
                setSelectedParty(match || null);
              }} label={partyType === 'customer' ? 'Select Customer' : 'Select Supplier'}>
                <MenuItem value="">Walk-in</MenuItem>
                {(partyType === 'customer' ? customers : suppliers).map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name} (Bal: {p.current_balance || 0})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 130 }} />

            <Button size="small" variant={saleType === 'wholesale' ? 'contained' : 'outlined'} onClick={() => setSaleType(prev => prev === 'retail' ? 'wholesale' : 'retail')} sx={{ bgcolor: saleType === 'wholesale' ? '#10b981' : undefined, color: saleType === 'wholesale' ? 'white' : 'inherit' }}>
              {saleType === 'retail' ? 'Retail' : 'Wholesale'}
            </Button>
          </>
        )}
      </Paper>

      {/* MOBILE FILTERS */}
      {isMobile && (
        <Paper sx={{ px: 1, py: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', borderRadius: 0, flexShrink: 0 }}>
          <FormControl size="small" sx={{ minWidth: 80, flex: 1 }}>
            <Select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }} displayEmpty size="small">
              <MenuItem value="">All</MenuItem>
              {categories.slice(0, 5).map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 70 }}>
            <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }} size="small">
              <MenuItem value="customer">Cust</MenuItem>
              <MenuItem value="supplier">Supp</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 100 }} />
          <Button size="small" variant={saleType === 'wholesale' ? 'contained' : 'outlined'} onClick={() => setSaleType(prev => prev === 'retail' ? 'wholesale' : 'retail')} sx={{ bgcolor: saleType === 'wholesale' ? '#10b981' : undefined, color: saleType === 'wholesale' ? 'white' : 'inherit', fontSize: '0.6rem', px: 1, minWidth: 'auto' }}>
            {saleType === 'retail' ? 'Retail' : 'Whole'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowOffersDialog(true)} sx={{ fontSize: '0.6rem', px: 1, minWidth: 'auto' }}>
            <LocalOffer fontSize="small" />
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowPrinterSettings(true)} sx={{ fontSize: '0.6rem', px: 1, minWidth: 'auto' }}>
            <PrintIcon fontSize="small" />
          </Button>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1, p: 1, flexDirection: isMobile ? 'column' : 'row' }}>
        
        {/* CART */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: isMobile ? '50vh' : '100%' }}>
          {isMobile ? (
            <Box sx={{ flex: 1, overflow: 'auto', pb: 1 }}>
              {cart.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Search sx={{ fontSize: 60, color: '#d1d5db' }} />
                  <Typography color="text.secondary">Cart Empty</Typography>
                  <Typography variant="caption" color="text.secondary">Press F1 to search</Typography>
                </Box>
              ) : (
                cart.map((item, idx) => (
                  <MobileCartItem key={item.id} item={item} index={idx}
                    onQtyChange={handleQtyChange} onPriceChange={handlePriceChange}
                    onDiscountChange={handleItemDiscount} onRemove={removeItem} />
                ))
              )}
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>#</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>SKU</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>Item</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="center">Qty</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="right">Price</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="right">Total</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, idx) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>
                        {item.name}
                        {item.isOfferItem && <Chip label="OFFER" size="small" color="warning" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          id={`qty-${idx}`}
                          type="number" size="small" value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`price-${idx}`)?.focus(); } }}
                          inputProps={{ step: 0.001, style: { textAlign: 'center', width: 60 } }} sx={{ width: 70 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          id={`price-${idx}`}
                          type="number" size="small" value={item.price}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`discount-${idx}`)?.focus(); } }}
                          inputProps={{ style: { textAlign: 'right', width: 80 } }} sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="#10b981">{formatPKR(item.total)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removeItem(idx)}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                        <Search sx={{ fontSize: 40, color: '#d1d5db' }} />
                        <Typography color="text.secondary">Cart Empty — Press F1 to search</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* PAYMENT PANEL */}
        <Paper sx={{ width: isMobile ? '100%' : 300, p: isMobile ? 1.5 : 2, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto', flexShrink: 0, maxHeight: isMobile ? 'auto' : '100%' }}>
          <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold" color="#10b981">
            {isMobile ? '💳 Payment' : 'Payment Summary'}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Sub Total</Typography>
            <Typography fontWeight="bold">{formatPKR(calc.subtotal)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Item Discount</Typography>
            <Typography fontWeight="bold" color="error">-{formatPKR(calc.itemDiscount)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', pt: 1 }}>
            <Typography fontWeight="bold">Grand Total</Typography>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="#10b981">{formatPKR(calc.grandTotal)}</Typography>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 60 : 75, fontSize: '0.75rem', fontWeight: 500 }}>Discount</Typography>
            <TextField
              id="discount-input"
              size="small" type="number" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('paid-input')?.focus(); } }}
              sx={{ flex: 1 }} placeholder="0"
            />
            <Select size="small" value={billDiscountType} onChange={(e) => setBillDiscountType(e.target.value)} sx={{ width: 60 }}>
              <MenuItem value="amount">Rs</MenuItem>
              <MenuItem value="percent">%</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 60 : 75, fontSize: '0.75rem', fontWeight: 500 }}>Tax %</Typography>
            <Select size="small" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} fullWidth>
              <MenuItem value={0}>0%</MenuItem>
              <MenuItem value={5}>5%</MenuItem>
              <MenuItem value={17}>17%</MenuItem>
              <MenuItem value={18}>18%</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 60 : 75, fontSize: '0.75rem', fontWeight: 500 }}>Payment</Typography>
            <Select size="small" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} fullWidth>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="bank">Bank</MenuItem>
              <MenuItem value="easypaisa">EasyPaisa</MenuItem>
              <MenuItem value="jazzcash">JazzCash</MenuItem>
              <MenuItem value="credit">Credit</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 60 : 75, fontSize: '0.75rem', fontWeight: 700 }}>Paid</Typography>
            <TextField
              id="paid-input"
              size="small" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSale(); } }}
              fullWidth placeholder="0.00"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Chip label="Enter → Save" size="small" color="success" sx={{ height: 18, fontSize: '0.55rem' }} />
                  </InputAdornment>
                )
              }}
            />
          </Box>

          {calc.due > 0 && (
            <Box sx={{ bgcolor: '#fef2f2', p: 1, borderRadius: 1, border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="error" fontWeight="bold" fontSize="0.8rem">Due</Typography>
              <Typography color="error" fontWeight="bold">{formatPKR(calc.due)}</Typography>
            </Box>
          )}
          {calc.change > 0 && (
            <Box sx={{ bgcolor: '#f0fdf4', p: 1, borderRadius: 1, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="success" fontWeight="bold" fontSize="0.8rem">Change</Typography>
              <Typography color="success" fontWeight="bold">{formatPKR(calc.change)}</Typography>
            </Box>
          )}

          <Button fullWidth variant="contained" onClick={saveSale} sx={{ bgcolor: '#10b981', py: isMobile ? 1.5 : 1.2, fontWeight: 'bold', fontSize: isMobile ? '0.9rem' : '1rem', '&:hover': { bgcolor: '#059669' } }} disabled={cart.length === 0}>
            {isMobile ? '💳 Pay' : 'Process Payment'} {formatPKR(calc.grandTotal)}
          </Button>

          {isMobile && (
            <Grid container spacing={1}>
              <Grid item xs={6}><Button fullWidth variant="outlined" startIcon={<Save />} onClick={saveSale} size="small" disabled={cart.length === 0}>Save</Button></Grid>
              <Grid item xs={6}><Button fullWidth variant="outlined" color="error" startIcon={<Close />} onClick={newBill} size="small">Clear</Button></Grid>
            </Grid>
          )}
        </Paper>
      </Box>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, borderRadius: 0 }}>
          <BottomNavigation showLabels sx={{ bgcolor: 'white' }}>
            <BottomNavigationAction label="Cart" icon={<Badge badgeContent={cart.length} color="primary"><ShoppingCart /></Badge>} />
            <BottomNavigationAction label="Scan" icon={<QrCodeScanner />} onClick={() => setScanMode(!scanMode)} />
            <BottomNavigationAction label="Offers" icon={<LocalOffer />} onClick={() => setShowOffersDialog(true)} />
            <BottomNavigationAction label="Held" icon={<Receipt />} onClick={() => setShowResumeDialog(true)} />
            <BottomNavigationAction label="⌨️" icon={<KeyboardArrowDown />} onClick={() => setShowShortcuts(true)} />
          </BottomNavigation>
        </Paper>
      )}

      {/* RECEIPT DIALOG */}
      <Dialog open={showReceipt} onClose={() => setShowReceipt(false)} maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', py: 1 }}>
          Receipt {defaultPrinter && <Chip label={defaultPrinter} size="small" sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />}
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
          <Button onClick={() => setShowReceipt(false)}>Close</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} sx={{ bgcolor: '#10b981' }}>
            {defaultPrinter ? 'Auto Print' : 'Print'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* HELD BILLS DIALOG */}
      <Dialog open={showResumeDialog} onClose={() => setShowResumeDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Held Bills ({heldBills.length})</DialogTitle>
        <DialogContent>
          {heldBills.length === 0 ? <Alert severity="info">No held bills</Alert> : (
            <List>
              {heldBills.map(bill => (
                <Paper key={bill.id} sx={{ mb: 1 }}>
                  <ListItem secondaryAction={
                    <Box>
                      <IconButton edge="end" onClick={() => resumeBill(bill)} color="success"><CheckCircle /></IconButton>
                      <IconButton edge="end" onClick={() => deleteHeld(bill.id)} color="error"><Delete /></IconButton>
                    </Box>
                  }>
                    <ListItemIcon><Receipt /></ListItemIcon>
                    <ListItemText primary={bill.party?.name || 'Walk-in'} secondary={`${formatPKR(bill.total)} • ${new Date(bill.date).toLocaleString()}`} />
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResumeDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* HOLD DIALOG */}
      <Dialog open={showHoldDialog} onClose={() => setShowHoldDialog(false)}>
        <DialogTitle>Hold Current Bill?</DialogTitle>
        <DialogContent><Typography>{cart.length} items will be saved.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHoldDialog(false)}>Cancel</Button>
          <Button onClick={() => { holdBill(); setShowHoldDialog(false); }} variant="contained" sx={{ bgcolor: '#f59e0b' }}>Hold Bill</Button>
        </DialogActions>
      </Dialog>

      {/* OFFERS DIALOG */}
      <Dialog open={showOffersDialog} onClose={() => setShowOffersDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}><LocalOffer sx={{ verticalAlign: 'middle', mr: 1 }} />Active Offers</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {offers.filter(o => o.status === 'active').length === 0 ? <Alert severity="info">No active offers</Alert> : (
            <Grid container spacing={isMobile ? 1 : 2} sx={{ mt: 1 }}>
              {offers.filter(o => o.status === 'active').map(offer => (
                <Grid item xs={12} sm={6} key={offer.id}>
                  <Paper variant="outlined" sx={{ p: 2, borderLeft: '4px solid #10b981', cursor: 'pointer', '&:hover': { bgcolor: '#f0fdf4' } }} onClick={() => applyOffer(offer)}>
                    <Typography fontWeight="bold">{offer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{offer.description}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Original:</Typography>
                      <Typography variant="body2">Rs. {Number(offer.original_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Final:</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#10b981">Rs. {Number(offer.final_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Button fullWidth variant="contained" size="small" sx={{ mt: 1, bgcolor: '#10b981' }}>Add to Cart</Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOffersDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* PRINTER SETTINGS */}
      <PrinterSettingsDialog open={showPrinterSettings} onClose={() => setShowPrinterSettings(false)} onPrinterSelect={(printer) => setDefaultPrinter(printer)} />

      {/* SHORTCUTS HELP */}
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* MOBILE DRAWER */}
      <Drawer anchor="right" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ width: 280, p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setShowOffersDialog(true); setMobileDrawer(false); }}><ListItemIcon><LocalOffer /></ListItemIcon><ListItemText primary="Offers" /></ListItem>
            <ListItem button onClick={() => { setShowResumeDialog(true); setMobileDrawer(false); }}><ListItemIcon><Receipt /></ListItemIcon><ListItemText primary="Held Bills" /></ListItem>
            <ListItem button onClick={() => { setShowHoldDialog(true); setMobileDrawer(false); }}><ListItemIcon><Pause /></ListItemIcon><ListItemText primary="Hold Bill" /></ListItem>
            <ListItem button onClick={() => { setShowPrinterSettings(true); setMobileDrawer(false); }}><ListItemIcon><PrintIcon /></ListItemIcon><ListItemText primary="Printer" /></ListItem>
            <ListItem button onClick={() => { setShowShortcuts(true); setMobileDrawer(false); }}><ListItemIcon><KeyboardArrowDown /></ListItemIcon><ListItemText primary="Shortcuts" /></ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>Party Type</InputLabel>
                <Select value={partyType} onChange={(e) => setPartyType(e.target.value)} label="Party Type">
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="supplier">Supplier</MenuItem>
                </Select>
              </FormControl>
            </ListItem>
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>{partyType === 'customer' ? 'Customer' : 'Supplier'}</InputLabel>
                <Select value={selectedParty?.id || ''} onChange={(e) => {
                  const dataset = partyType === 'customer' ? customers : suppliers;
                  const match = dataset.find(x => x.id === e.target.value);
                  setSelectedParty(match || null);
                }} label={partyType === 'customer' ? 'Customer' : 'Supplier'}>
                  <MenuItem value="">Walk-in</MenuItem>
                  {(partyType === 'customer' ? customers : suppliers).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 7 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}