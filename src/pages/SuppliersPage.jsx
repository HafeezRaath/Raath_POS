import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Chip, Stack,
  Card, CardContent, Divider, InputAdornment, Tooltip, Fade,
  Tabs, Tab, List, ListItem, ListItemText, Avatar, Badge,
  Accordion, AccordionSummary, AccordionDetails,
  Pagination, MenuItem
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Person, Business, Phone,
  Email, LocationOn, AccountBalance, Save, Close, History,
  AttachMoney, LocalShipping, Warning, CheckCircle, Block,
  ExpandMore, Receipt, Payment, TrendingUp, TrendingDown,
  CalendarToday, Note, AccountBalanceWallet
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
  
  // Detail view dialogs for Activity Log
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState(0);
  const [detailTab, setDetailTab] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sups, purchs, pays, ledg] = await Promise.all([
        db.getSuppliers(),
        db.getPurchases(),
        db.getPayments ? db.getPayments() : Promise.resolve([]),
        db.getLedger ? db.getLedger() : Promise.resolve([])
      ]);
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
    if (paymentDialog) {
      setPaymentAmount('');
      setPaymentNote('');
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
  }, [filtered, page]);
  
  // Stats
  const totalPayable = useMemo(() => suppliers.reduce((sum, s) => sum + (Number(s.current_balance) || 0), 0), [suppliers]);
  const activeCount = useMemo(() => suppliers.filter(s => s.status === 'active').length, [suppliers]);
  const totalPurchases = purchases.length;
  
  // Handlers
  const handleOpen = (supplier = null) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
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
  
  const handlePayment = async (e) => {
    e.preventDefault();
    if (!viewSupplier || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      alert('Enter valid amount');
      return;
    }
    
    try {
      const payRes = await db.addPayment({
        supplier_id: viewSupplier.id,
        amount: amount,
        note: paymentNote,
        date: new Date().toISOString(),
        type: 'payment'
      });
      
      await db.updateSupplierBalance(viewSupplier.id, -amount);
      
      await db.addLedgerEntry({
        supplier_id: viewSupplier.id,
        type: 'payment',
        amount: amount,
        description: paymentNote || 'Cash Paid to Supplier',
        date: new Date().toISOString()
      });
      
      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger('supplier_payment', payRes?.lastInsertRowid || viewSupplier.id, amount, 0, `Payment to ${viewSupplier.name} via ${paymentNote || 'Cash'}`);
      }
      
      await loadData();
      setPaymentDialog(false);
      setPaymentAmount('');
      setPaymentNote('');
      
      const updated = await db.getSupplierById(viewSupplier.id);
      setViewSupplier(updated);
    } catch (err) {
      alert('Payment execution failed: ' + err.message);
    }
  };
  
  const getSupplierPurchases = (supplierId) => purchases.filter(p => p.supplier_id === supplierId && !p.is_deleted);
  const getSupplierPayments = (supplierId) => payments.filter(p => p.supplier_id === supplierId);
  const getSupplierLedger = (supplierId) => ledger.filter(l => l.supplier_id === supplierId);
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'S';

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Suppliers & Vendors
      </Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}><Business /></Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{suppliers.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Suppliers</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'error.main' }}><AccountBalance /></Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold" color="error">Rs. {totalPayable.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Payable</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'success.main' }}><CheckCircle /></Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{activeCount}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Suppliers</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'warning.main' }}><Receipt /></Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{totalPurchases}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Purchases</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs Menu */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="fullWidth">
          <Tab icon={<Business />} label="Suppliers" iconPosition="start" />
          <Tab icon={<AccountBalance />} label="Ledger" iconPosition="start" />
          <Tab icon={<History />} label="Activity Log" iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* SUPPLIERS TAB PANEL */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" placeholder="Search by name, company, phone or VAT..." value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>Add Supplier</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
            
            <TableContainer component={Paper}>
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
                            <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: isDue ? 'warning.main' : 'success.main' }}>{getInitials(supplier.name)}</Avatar>
                            <Box>
                              <Typography fontWeight={600}>{supplier.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{supplier.company_name || 'No Company'}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{supplier.phone}</Typography>
                          <Typography variant="caption" color="text.secondary">{supplier.email}</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" label={supplier.vat_ntn_number || 'N/A'} variant="outlined" /></TableCell>
                        <TableCell align="right">Rs. {Number(supplier.opening_balance).toLocaleString()}</TableCell>
                        <TableCell align="right"><Typography fontWeight="bold" color={isDue ? 'error' : 'success'}>Rs. {balance.toLocaleString()}</Typography></TableCell>
                        <TableCell><Chip size="small" color={supplier.status === 'active' ? 'success' : 'default'} label={supplier.status?.toUpperCase()} /></TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="info" onClick={() => setViewSupplier(supplier)}><History fontSize="small" /></IconButton>
                          <IconButton size="small" color="primary" onClick={() => handleOpen(supplier)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(supplier.id)}><Delete fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={Math.ceil(filtered.length / rowsPerPage)} page={page} onChange={(e, v) => setPage(v)} color="primary" />
            </Box>
          </Box>
        </Fade>
      )}
      
      {/* LEDGER TAB PANEL */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom><AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />Supplier Ledger</Typography>
              <Typography variant="body2" color="text.secondary">Real-time outstanding accounting balances</Typography>
            </Paper>
            {suppliers.map(supplier => (
              <Accordion key={supplier.id} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 12 }}>{getInitials(supplier.name)}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight="bold">{supplier.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{getSupplierPurchases(supplier.id).length} transactions recorded</Typography>
                    </Box>
                    <Typography fontWeight="bold" color={Number(supplier.current_balance) > 0 ? 'error' : 'success'}>Rs. {Number(supplier.current_balance).toLocaleString()}</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Debit</TableCell>
                          <TableCell align="right">Credit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow><TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Opening Balance</TableCell><TableCell align="right">-</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>Rs. {Number(supplier.opening_balance).toLocaleString()}</TableCell></TableRow>
                        {getSupplierPurchases(supplier.id).map(p => (
                          <TableRow key={p.id} hover onClick={() => setSelectedPurchase(p)} style={{ cursor: 'pointer' }}>
                            <TableCell>{formatDate(p.purchase_date)}</TableCell>
                            <TableCell><Chip size="small" color="error" label="PURCHASE" /></TableCell>
                            <TableCell>{p.purchase_no}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>Rs. {Number(p.grand_total).toLocaleString()}</TableCell>
                            <TableCell align="right">-</TableCell>
                          </TableRow>
                        ))}
                        {getSupplierPayments(supplier.id).map(pay => (
                          <TableRow key={pay.id} hover onClick={() => setSelectedPayment(pay)} style={{ cursor: 'pointer' }}>
                            <TableCell>{formatDate(pay.date)}</TableCell>
                            <TableCell><Chip size="small" color="success" label="PAYMENT" /></TableCell>
                            <TableCell>{pay.note || 'Cash Settlement'}</TableCell>
                            <TableCell align="right">-</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main' }}>Rs. {Number(pay.amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Fade>
      )}

      {/* ACTIVITY LOG PANEL */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card><CardContent>
                  <Typography variant="h6" gutterBottom><LocalShipping color="primary" sx={{ mr: 1 }} />Recent Purchases</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List dense>
                    {purchases.slice(0, 10).map(p => (
                      <ListItem key={p.id} divider onClick={() => setSelectedPurchase(p)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, mb: 0.5 }}>
                        <ListItemText primary={<Stack direction="row" justifyContent="space-between"><strong>{p.purchase_no}</strong><Chip size="small" color="warning" label={p.payment_status} /></Stack>} secondary={`Total: Rs. ${Number(p.grand_total).toLocaleString()} | ${formatDate(p.purchase_date)}`} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card><CardContent>
                  <Typography variant="h6" gutterBottom><Payment color="success" sx={{ mr: 1 }} />Recent Payments</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List dense>
                    {payments.slice(0, 10).map(p => (
                      <ListItem key={p.id} divider onClick={() => setSelectedPayment(p)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, mb: 0.5 }}>
                        <ListItemText primary={<Stack direction="row" justifyContent="space-between"><span style={{ color: 'green', fontWeight: 'bold' }}>Rs. {Number(p.amount).toLocaleString()}</span><small>{formatDate(p.date)}</small></Stack>} secondary={p.note || 'Vendor Remittance'} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent></Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* FORM MASTER DIALOG */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}><TextField name="name" label="Supplier Name *" fullWidth required defaultValue={editingSupplier?.name} /></Grid>
              <Grid item xs={12} md={6}><TextField name="company_name" label="Company Name" fullWidth defaultValue={editingSupplier?.company_name} /></Grid>
              <Grid item xs={12} md={4}><TextField name="phone" label="Phone *" fullWidth required defaultValue={editingSupplier?.phone} /></Grid>
              <Grid item xs={12} md={4}><TextField name="email" label="Email" fullWidth defaultValue={editingSupplier?.email} /></Grid>
              <Grid item xs={12} md={4}><TextField name="vat_ntn_number" label="VAT / NTN" fullWidth defaultValue={editingSupplier?.vat_ntn_number} /></Grid>
              <Grid item xs={12}><TextField name="address" label="Address" fullWidth multiline rows={2} defaultValue={editingSupplier?.address} /></Grid>
              <Grid item xs={12} md={6}><TextField name="opening_balance" label="Opening Balance" type="number" fullWidth defaultValue={editingSupplier?.opening_balance || 0} disabled={!!editingSupplier} /></Grid>
              <Grid item xs={12} md={6}><TextField name="status" label="Status" select fullWidth defaultValue={editingSupplier?.status || 'active'}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save Vendor</Button></DialogActions>
        </form>
      </Dialog>

      {/* DETAILED LEDGER ACCORDION POPUP PANEL */}
      <Dialog open={!!viewSupplier} onClose={() => setViewSupplier(null)} maxWidth="lg" fullWidth>
        {viewSupplier && (
          <>
            <DialogTitle><strong>{viewSupplier.name}</strong> - Detailed Statement</DialogTitle>
            <DialogContent>
              <Tabs value={detailTab} onChange={(e, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab label="Profile" /><Tab label="Purchases" /><Tab label="Payments" /><Tab label="Ledger Matrix" />
              </Tabs>
              {detailTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography>Phone: {viewSupplier.phone}</Typography><Typography>Address: {viewSupplier.address || 'N/A'}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography fontWeight="bold">Net Outstanding Balance: Rs. {Number(viewSupplier.current_balance).toLocaleString()}</Typography>{Number(viewSupplier.current_balance) > 0 && <Button variant="contained" color="success" onClick={() => setPaymentDialog(true)} sx={{ mt: 1 }}>Clear Outstanding Balance</Button>}</Paper></Grid>
                </Grid>
              )}
              {detailTab === 1 && (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableBody>{getSupplierPurchases(viewSupplier.id).map(p => (<TableRow key={p.id}><TableCell>Invoice: {p.purchase_no}</TableCell><TableCell>Grand Total: Rs. {Number(p.grand_total).toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></TableContainer>
              )}
              {detailTab === 2 && (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableBody>{getSupplierPayments(viewSupplier.id).map(p => (<TableRow key={p.id}><TableCell>Date: {formatDate(p.date)}</TableCell><TableCell sx={{ color: 'green', fontWeight: 'bold' }}>Rs. {Number(p.amount).toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></TableContainer>
              )}
              {detailTab === 3 && (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableBody><TableRow><TableCell><b>Net Current Balance Statement</b></TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: 'red' }}>Rs. {Number(viewSupplier.current_balance).toLocaleString()}</TableCell></TableRow></TableBody></Table></TableContainer>
              )}
            </DialogContent>
            <DialogActions><Button onClick={() => setViewSupplier(null)}>Close Statement</Button></DialogActions>
          </>
        )}
      </Dialog>

      {/* RECORD PAYMENT SUB PANEL POPUP */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handlePayment}>
          <DialogTitle>Record Voucher Payment</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Amount (Rs.) *" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required sx={{ mt: 1 }} />
            <TextField fullWidth label="Reference Note" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} sx={{ mt: 2 }} />
          </DialogContent>
          <DialogActions><Button onClick={() => setPaymentDialog(false)}>Cancel</Button><Button type="submit" variant="contained" color="success">Process Remittance</Button></DialogActions>
        </form>
      </Dialog>

      {/* POPUP CORES VIEWERS */}
      <Dialog open={!!selectedPurchase} onClose={() => setSelectedPurchase(null)} maxWidth="xs" fullWidth>
        {selectedPurchase && (
          <DialogContent><Typography variant="h6" gutterBottom>Bill Snapshot</Typography><Divider/><Typography sx={{ mt: 1 }}>Invoice: {selectedPurchase.purchase_no}</Typography><Typography>Grand Total: Rs. {Number(selectedPurchase.grand_total || 0).toLocaleString()}</Typography><Button onClick={() => setSelectedPurchase(null)} sx={{ mt: 2 }} fullWidth variant="outlined">Close</Button></DialogContent>
        )}
      </Dialog>
      <Dialog open={!!selectedPayment} onClose={() => setSelectedPayment(null)} maxWidth="xs" fullWidth>
        {selectedPayment && (
          <DialogContent><Typography variant="h6" gutterBottom>Voucher Snapshot</Typography><Divider/><Typography sx={{ mt: 1 }}>Disbursed Amount: Rs. {Number(selectedPayment.amount).toLocaleString()}</Typography><Typography>Remarks: {selectedPayment.note || 'N/A'}</Typography><Button onClick={() => setSelectedPayment(null)} sx={{ mt: 2 }} fullWidth variant="outlined">Close</Button></DialogContent>
        )}
      </Dialog>
    </Box>
  );
}