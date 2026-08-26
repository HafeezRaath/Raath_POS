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
  FormControl, InputLabel, Select, Alert  // ← YEH ADD KIYA
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Person, Business, Phone,
  Email, LocationOn, AccountBalance, Save, Close, History,
  AttachMoney, LocalShipping, Warning, CheckCircle, Block,
  ExpandMore, Receipt, Payment, TrendingUp, TrendingDown,
  CalendarToday, Note, AccountBalanceWallet, Menu as MenuIcon,
  ArrowBack, MoreVert
} from '@mui/icons-material';
import db from '../database/db';

// 🛠️ FIXED: Defining formatDate globally at the top level to resolve ESLint 'no-undef' errors
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

  // Mobile drawer states
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      let sups = [], purchs = [], pays = [], ledg = [];

      try {
        sups = await db.getSuppliers();
        console.log('[SuppliersPage] Loaded suppliers:', sups?.length || 0, sups);
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

  useEffect(() => {
    console.log('[SuppliersPage] suppliers state updated:', suppliers.length, suppliers);
  }, [suppliers]);
  
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
  
  // Filter suppliers
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
  
  // Handlers
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
  
  const loadAccounts = async () => {
    try {
      const accs = await db.getAccounts ? await db.getAccounts({ status: 'active' }) : [];
      setAccounts(accs || []);
    } catch (err) {
      console.error('Load accounts error:', err);
    }
  };

  useEffect(() => {
    const acc = accounts.find(a => a.type === paymentMode);
    setSelectedAccount(acc || null);
  }, [accounts, paymentMode]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!viewSupplier || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      alert('Enter valid amount');
      return;
    }
    
    try {
      await db.addSupplierPayment({
        supplier_id: viewSupplier.id,
        purchase_id: paymentPurchaseId || null,
        amount: amount,
        payment_mode: paymentMode,
        note: paymentNote,
        date: new Date().toISOString()
      });
      
      await loadData();
      setPaymentDialog(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentMode('cash');
      setPaymentPurchaseId('');
      
      const updated = await db.getSupplierById(viewSupplier.id);
      setViewSupplier(updated);
    } catch (err) {
      alert('Payment failed: ' + err.message);
    }
  };
  
  const getSupplierPurchases = (supplierId) => purchases.filter(p => p.supplier_id === supplierId && !p.is_deleted);
  const getSupplierPayments = (supplierId) => payments.filter(p => p.supplier_id === supplierId);
  const getSupplierLedger = (supplierId) => ledger.filter(l => l.supplier_id === supplierId);
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'S';

  // Mobile Supplier Card Component
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

  // Mobile Stats Cards
  const StatsCards = () => (
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      <Grid item xs={6} sm={3}>
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                <Business fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" fontSize={isMobile ? '1rem' : '1.25rem'}>
                  {suppliers.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'error.main', fontSize: '0.875rem' }}>
                <AccountBalance fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" fontSize={isMobile ? '0.75rem' : '1.25rem'} color="error">
                  Rs. {totalPayable.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payable
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'success.main', fontSize: '0.875rem' }}>
                <CheckCircle fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" fontSize={isMobile ? '1rem' : '1.25rem'}>
                  {activeCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.main', fontSize: '0.875rem' }}>
                <Receipt fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" fontSize={isMobile ? '1rem' : '1.25rem'}>
                  {totalPurchases}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Purchases
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 }, 
      maxWidth: 1400, 
      mx: 'auto',
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      {/* Header */}
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
      
      {/* Stats Cards */}
      <StatsCards />
      
      {/* Tabs Menu */}
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
      
      {/* SUPPLIERS TAB PANEL */}
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
            
            {/* Desktop Table View */}
            {!isMobile ? (
              <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>VAT/NTN</TableCell>
                      <TableCell align="right">Opening Balance</TableCell>
                      <TableCell align="right">Current Balance</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              /* Mobile Card View */
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
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination 
                count={Math.ceil(filtered.length / rowsPerPage)} 
                page={page} 
                onChange={(e, v) => setPage(v)} 
                color="primary"
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                  }
                }}
              />
            </Box>
          </Box>
        </Fade>
      )}
      
      {/* LEDGER TAB PANEL */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                Supplier Ledger
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time outstanding accounting balances
              </Typography>
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
                        {getSupplierPurchases(supplier.id).length} transactions recorded
                      </Typography>
                    </Box>
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
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Date</TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Type</TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Description</TableCell>
                          <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Debit</TableCell>
                          <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Credit</TableCell>
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

      {/* ACTIVITY LOG PANEL */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      <LocalShipping color="primary" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Recent Purchases
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <List dense>
                      {purchases.slice(0, isMobile ? 5 : 10).map(p => (
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
                                <Typography fontWeight="bold" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                                  {p.purchase_no}
                                </Typography>
                                <Chip 
                                  size="small" 
                                  color={p.payment_status === 'paid' ? 'success' : 'warning'} 
                                  label={p.payment_status}
                                  sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                                />
                              </Stack>
                            } 
                            secondary={`Total: Rs. ${Number(p.grand_total).toLocaleString()} | ${formatDate(p.purchase_date)}`}
                            secondaryTypographyProps={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      <Payment color="success" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Recent Payments
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <List dense>
                      {payments.slice(0, isMobile ? 5 : 10).map(p => (
                        <ListItem 
                          key={p.id} 
                          divider 
                          onClick={() => setSelectedPayment(p)} 
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
                                <Typography color="success.main" fontWeight="bold" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                                  Rs. {Number(p.amount).toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(p.date)}
                                </Typography>
                              </Stack>
                            } 
                            secondary={p.note || 'Vendor Remittance'}
                            secondaryTypographyProps={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* FORM MASTER DIALOG - Full screen on mobile */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : 2,
            margin: isMobile ? 0 : 'auto',
          }
        }}
      >
        <form onSubmit={handleSave}>
          <DialogTitle sx={{ 
            bgcolor: 'primary.main', 
            color: 'white',
            py: isMobile ? 1.5 : 2,
            fontSize: { xs: '1rem', sm: '1.25rem' }
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
          <DialogContent sx={{ pt: 3 }}>
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
          <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" fullWidth={isMobile}>
              Save Vendor
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DETAILED LEDGER ACCORDION POPUP PANEL - Full screen on mobile */}
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
              {isMobile && (
                <IconButton 
                  onClick={() => setViewSupplier(null)} 
                  sx={{ color: 'white', mr: 1, float: 'left' }}
                >
                  <ArrowBack />
                </IconButton>
              )}
              {viewSupplier.name} - Statement
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
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Invoice</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Date</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Mode</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Paid</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Balance</TableCell>
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
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Date</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Mode</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Note</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Amount</TableCell>
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
                </TableContainer>
              )}
            </DialogContent>
            <DialogActions sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Button onClick={() => setViewSupplier(null)} variant="outlined" fullWidth={isMobile}>
                Close Statement
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* RECORD PAYMENT SUB PANEL POPUP - Full screen on mobile */}
      <Dialog 
        open={paymentDialog} 
        onClose={() => setPaymentDialog(false)} 
        maxWidth="xs" 
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : 2,
          }
        }}
      >
        <form onSubmit={handlePayment}>
          <DialogTitle sx={{ 
            bgcolor: 'success.main', 
            color: 'white',
            py: isMobile ? 1.5 : 2,
            fontSize: { xs: '1rem', sm: '1.25rem' }
          }}>
            {isMobile && (
              <IconButton 
                onClick={() => setPaymentDialog(false)} 
                sx={{ color: 'white', mr: 1, float: 'left' }}
              >
                <ArrowBack />
              </IconButton>
            )}
            Record Payment
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            {/* 🔴 PAYMENT MODE SELECTOR */}
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
                <MenuItem value="cash">💵 Cash in Hand</MenuItem>
                <MenuItem value="bank">🏦 Bank Account</MenuItem>
                <MenuItem value="easypaisa">📱 EasyPaisa</MenuItem>
                <MenuItem value="jazzcash">📲 JazzCash</MenuItem>
                <MenuItem value="cheque">📝 Cheque</MenuItem>
                <MenuItem value="other">🔹 Other</MenuItem>
              </Select>
            </FormControl>

            {selectedAccount && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1, bgcolor: 'grey.50' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{selectedAccount.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedAccount.type?.toUpperCase()} ACCOUNT</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="caption" color="text.secondary" display="block">Available Balance</Typography>
                    <Typography variant="body1" fontWeight="bold" color={Number(selectedAccount.current_balance) >= Number(paymentAmount || 0) ? 'success.main' : 'error.main'}>
                      Rs. {Number(selectedAccount.current_balance).toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
            {!selectedAccount && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
                No active account found for {paymentMode.toUpperCase()}. Please create one in Accounts page.
              </Alert>
            )}

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
                  .map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.purchase_no} — Rs. {Number(p.grand_total).toLocaleString()} 
                      (Due: Rs. {Number((p.grand_total || 0) - (p.paid_amount || 0)).toLocaleString()})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

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
              }}
            />
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
          <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
            <Button onClick={() => setPaymentDialog(false)} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="success" fullWidth={isMobile}>
              Process Payment
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* POPUP CORES VIEWERS - Bottom sheet on mobile */}
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