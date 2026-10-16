// ============================================================
//  EmiWizardModal — Advanced EMI / BNPL agreement creation wizard
//  Step 1: Product source (inventory / external / +IMEI for mobile shop)
//  Step 2: Finance (down payment, 35% interest, fixed months or monthly target)
//  Step 3: Customer + Guarantor (existing / new / CNIC-only)
//  Step 4: Review schedule + create
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, Chip, Divider, List,
  ListItem, ListItemText, Table,
  TableHead, TableRow, TableCell, TableBody, Paper,
} from '../ui/tailwind-mui';
import { Add } from '../ui/icons';
import api from '../../api/apiClient';
import ImeiPickerModal from '../mobile/ImeiPickerModal';

const STEPS = ['Product', 'Finance', 'Customer & Guarantor', 'Review'];

export default function EmiWizardModal({ open, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  // Step 1
  const [sourceMode, setSourceMode] = useState('inventory');
  const [variants, setVariants] = useState([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [productName, setProductName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [imeiDevice, setImeiDevice] = useState(null);
  const [imeiPickerOpen, setImeiPickerOpen] = useState(false);
  // Step 2
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('35');
  const [tenureMode, setTenureMode] = useState('fixed_months');
  const [totalMonths, setTotalMonths] = useState('12');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  // Step 3
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [guarantorMode, setGuarantorMode] = useState('none');
  const [guarantors, setGuarantors] = useState([]);
  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [selectedGuarantor, setSelectedGuarantor] = useState(null);
  const [newG, setNewG] = useState({ name: '', phone: '', cnic: '', address: '', occupation: '', monthly_income: '', relation_to_customer: '' });
  const [notes, setNotes] = useState('');
  // misc
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setMsg(null);
    api.get('/products/variants').then(r => setVariants(r.data?.data || r.data || [])).catch(() => {});
    api.get('/customers').then(r => setCustomers(r.data || [])).catch(() => {});
    api.get('/emi/guarantors').then(r => setGuarantors(r.data || [])).catch(() => {});
  }, [open ]);

  // ---- finance math (live) ----
  const fin = useMemo(() => {
    const total = Number(salePrice) || 0;
    const down = Math.min(Number(downPayment) || 0, total);
    const rate = Number(interestRate) || 0;
    const remaining = +(total - down).toFixed(2);
    const interest = +(remaining * rate / 100).toFixed(2);
    const payable = +(remaining + interest).toFixed(2);
    let months = parseInt(totalMonths, 10) || 12;
    if (tenureMode === 'monthly_target') {
      const tgt = Number(monthlyTarget) || 0;
      months = tgt > 0 ? Math.max(1, Math.ceil(payable / tgt)) : 0;
    }
    const schedule = [];
    if (months > 0 && payable > 0) {
      const base = Math.floor(payable / months);
      const last = +(payable - base * (months - 1)).toFixed(2);
      const d0 = new Date(startDate || new Date().toISOString().slice(0, 10));
      for (let i = 1; i <= months; i++) {
        const d = new Date(d0); d.setMonth(d.getMonth() + i);
        schedule.push({ no: i, due: d.toISOString().slice(0, 10), amount: i === months ? last : base });
      }
    }
    return { total, down, rate, remaining, interest, payable, months, schedule };
  }, [salePrice, downPayment, interestRate, tenureMode, totalMonths, monthlyTarget, startDate]);

  const variantResults = useMemo(() => {
    const q = variantSearch.trim().toLowerCase();
    if (!q) return [];
    return variants.filter(v =>
      String(v.variant_name || v.product_name || '').toLowerCase().includes(q) ||
      String(v.sku || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [variantSearch, variants]);

  const customerResults = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.phone || '').includes(q) ||
      String(c.cnic || '').includes(q)
    ).slice(0, 8);
  }, [customerSearch, customers]);

  const guarantorResults = useMemo(() => {
    const q = guarantorSearch.trim().toLowerCase();
    if (!q) return guarantors.slice(0, 8);
    return guarantors.filter(g =>
      String(g.name || '').toLowerCase().includes(q) ||
      String(g.cnic || '').includes(q) ||
      String(g.phone || '').includes(q)
    ).slice(0, 8);
  }, [guarantorSearch, guarantors]);

  const pickVariant = (v) => {
    setSelectedVariant(v);
    setProductName(v.variant_name || v.product_name || '');
    setSalePrice(String(v.retail_price || v.sale_price || ''));
    setCostPrice(String(v.purchase_price || ''));
    setVariantSearch('');
  };

  const canNext1 = sourceMode === 'external'
    ? (productName.trim() !== '' && Number(salePrice) > 0)
    : !!selectedVariant;
  const canNext2 = fin.total > 0 && fin.months > 0;
  const canNext3 = !!selectedCustomer && (guarantorMode !== 'existing' || !!selectedGuarantor) &&
    (guarantorMode !== 'new' || newG.name.trim() !== '');

  const handleCreate = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.post('/emi/advanced', {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        source_mode: sourceMode,
        product_variant_id: sourceMode === 'inventory' ? selectedVariant.id : null,
        product_id: sourceMode === 'inventory' ? selectedVariant.product_id : null,
        product_name: productName,
        cost_price: Number(costPrice) || 0,
        sale_price: fin.total,
        device_imei_id: imeiDevice?.id || null,
        down_payment: fin.down,
        interest_rate: fin.rate,
        tenure_mode: tenureMode,
        total_months: fin.months,
        monthly_target: tenureMode === 'monthly_target' ? Number(monthlyTarget) : 0,
        start_date: startDate,
        notes,
        guarantor_mode: guarantorMode,
        guarantor_id: guarantorMode === 'existing' ? selectedGuarantor?.id : null,
        new_guarantor: guarantorMode === 'new' ? newG : null,
      });
      setMsg({ t: 'success', m: r.data?.message || 'EMI created' });
      onCreated && onCreated(r.data);
      setTimeout(() => { reset(); onClose(); }, 1200);
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Create failed' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(0); setSelectedVariant(null); setProductName(''); setCostPrice(''); setSalePrice('');
    setImeiDevice(null); setDownPayment(''); setInterestRate('35'); setTenureMode('fixed_months');
    setTotalMonths('12'); setMonthlyTarget(''); setSelectedCustomer(null); setGuarantorMode('none');
    setSelectedGuarantor(null); setNewG({ name: '', phone: '', cnic: '', address: '', occupation: '', monthly_income: '', relation_to_customer: '' });
    setNotes(''); setMsg(null);
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#7c3aed', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">📋 New EMI Agreement (Advanced)</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <Chip key={s} size="small" label={`${i + 1}. ${s}`}
              color={i === step ? 'primary' : i < step ? 'success' : 'default'}
              variant={i === step ? 'filled' : 'outlined'} />
          ))}
        </Box>

        {msg && <Alert severity={msg.t} sx={{ mb: 1.5 }}>{msg.m}</Alert>}

        {/* ============ STEP 1: PRODUCT ============ */}
        {step === 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button size="small" variant={sourceMode === 'inventory' ? 'contained' : 'outlined'}
                onClick={() => setSourceMode('inventory')}>📦 Existing Inventory</Button>
              <Button size="small" variant={sourceMode === 'external' ? 'contained' : 'outlined'}
                onClick={() => setSourceMode('external')}>🏪 External / Market</Button>
            </Box>

            {sourceMode === 'inventory' ? (
              <>
                <TextField fullWidth size="small" label="Inventory item search (name / SKU)" value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)} />
                {variantResults.length > 0 && (
                  <List dense sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mt: 0.5, maxHeight: 160, overflow: 'auto' }}>
                    {variantResults.map(v => (
                      <ListItem key={v.id} button onClick={() => pickVariant(v)}>
                        <ListItemText primary={v.variant_name || v.product_name}
                          secondary={`Stock: ${v.current_stock ?? v.stock} • Sale: Rs. ${Number(v.retail_price || v.sale_price || 0).toLocaleString()}`} />
                        <Add fontSize="small" />
                      </ListItem>
                    ))}
                  </List>
                )}
                {selectedVariant && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Selected: <b>{productName}</b> — Sale Rs. {Number(salePrice).toLocaleString()} (stock se -1 hoga)
                  </Alert>
                )}
              </>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Product Name *" value={productName}
                    onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Honda CD 70 (market se)" />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Cost Price (Rs)" type="number" value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Agreed Sale Price (Rs) *" type="number" value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    External item — inventory se stock deduct nahi hoga.
                  </Typography>
                </Grid>
              </Grid>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" fontWeight="bold">MOBILE SHOP: IMEI link (optional)</Typography>
              <Button size="small" variant="outlined" onClick={() => setImeiPickerOpen(true)}>
                {imeiDevice ? 'Change IMEI' : '📱 Select IMEI'}
              </Button>
              {imeiDevice && (
                <Chip label={`${imeiDevice.brand} ${imeiDevice.model} [${imeiDevice.imei1}]`}
                  onDelete={() => setImeiDevice(null)} color="primary" size="small" />
              )}
            </Box>
          </>
        )}

        {/* ============ STEP 2: FINANCE ============ */}
        {step === 1 && (
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Total Sale Price (Rs)" type="number" value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Down Payment (Rs)" type="number" value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Interest Rate %" type="number" value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)} helperText="Default 35%" />
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 1.5, bgcolor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                <Grid container spacing={1}>
                  <Grid item xs={6} sm={3}><Typography variant="caption">Remaining Principal<br /><b>Rs. {fin.remaining.toLocaleString()}</b></Typography></Grid>
                  <Grid item xs={6} sm={3}><Typography variant="caption">Total Interest ({fin.rate}%)<br /><b>Rs. {fin.interest.toLocaleString()}</b></Typography></Grid>
                  <Grid item xs={6} sm={3}><Typography variant="caption">Total Payable<br /><b style={{ color: '#7c3aed' }}>Rs. {fin.payable.toLocaleString()}</b></Typography></Grid>
                  <Grid item xs={6} sm={3}><Typography variant="caption">Tenure<br /><b>{fin.months} months</b></Typography></Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button size="small" variant={tenureMode === 'fixed_months' ? 'contained' : 'outlined'}
                  onClick={() => setTenureMode('fixed_months')}>Fixed Tenure</Button>
                <Button size="small" variant={tenureMode === 'monthly_target' ? 'contained' : 'outlined'}
                  onClick={() => setTenureMode('monthly_target')}>Custom Monthly Amount</Button>
              </Box>
            </Grid>
            {tenureMode === 'fixed_months' ? (
              <Grid item xs={6} sm={4}>
                <TextField fullWidth size="small" label="Months" type="number" value={totalMonths}
                  onChange={(e) => setTotalMonths(e.target.value)} />
              </Grid>
            ) : (
              <Grid item xs={6} sm={4}>
                <TextField fullWidth size="small" label="Monthly Target (Rs)" type="number" value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)} placeholder="5000"
                  helperText={fin.months > 0 ? `= ${fin.months} months auto` : 'Amount likho'} />
              </Grid>
            )}
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Start Date" type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            {fin.schedule.length > 0 && fin.schedule.length <= 24 && (
              <Grid item xs={12}>
                <Typography variant="caption" fontWeight="bold">SCHEDULE PREVIEW</Typography>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell><b>#</b></TableCell><TableCell><b>Due Date</b></TableCell><TableCell align="right"><b>Amount</b></TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {fin.schedule.map(s => (
                      <TableRow key={s.no}>
                        <TableCell>{s.no}</TableCell><TableCell>{s.due}</TableCell>
                        <TableCell align="right">Rs. {s.amount.toLocaleString()}{s.no === fin.months && fin.schedule.length > 1 ? ' *' : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Typography variant="caption" color="text.secondary">* last month mein rounding remainder adjust hota hai</Typography>
              </Grid>
            )}
          </Grid>
        )}

        {/* ============ STEP 3: CUSTOMER + GUARANTOR ============ */}
        {step === 2 && (
          <>
            <Typography variant="caption" fontWeight="bold">CUSTOMER *</Typography>
            <TextField fullWidth size="small" label="Customer search (name / phone / CNIC)" value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)} sx={{ mt: 0.5 }} />
            {customerResults.length > 0 && (
              <List dense sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mt: 0.5, maxHeight: 140, overflow: 'auto' }}>
                {customerResults.map(c => (
                  <ListItem key={c.id} button onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}>
                    <ListItemText primary={c.name} secondary={`${c.phone || ''} ${c.cnic ? `• ${c.cnic}` : ''}`} />
                  </ListItem>
                ))}
              </List>
            )}
            {selectedCustomer && (
              <Alert severity="success" sx={{ mt: 1 }}>Customer: <b>{selectedCustomer.name}</b>
                <Chip size="small" label="change" onClick={() => setSelectedCustomer(null)} sx={{ ml: 1 }} /></Alert>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" fontWeight="bold">GUARANTOR</Typography>
            <Box sx={{ display: 'flex', gap: 1, my: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant={guarantorMode === 'none' ? 'contained' : 'outlined'}
                onClick={() => setGuarantorMode('none')}>CNIC-Only (no guarantor)</Button>
              <Button size="small" variant={guarantorMode === 'existing' ? 'contained' : 'outlined'}
                onClick={() => setGuarantorMode('existing')}>Existing Guarantor</Button>
              <Button size="small" variant={guarantorMode === 'new' ? 'contained' : 'outlined'}
                onClick={() => setGuarantorMode('new')}>New Guarantor</Button>
            </Box>

            {guarantorMode === 'existing' && (
              <>
                <TextField fullWidth size="small" label="Guarantor search (name / CNIC / phone)" value={guarantorSearch}
                  onChange={(e) => setGuarantorSearch(e.target.value)} />
                <List dense sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mt: 0.5, maxHeight: 140, overflow: 'auto' }}>
                  {guarantorResults.map(g => (
                    <ListItem key={g.id} button onClick={() => setSelectedGuarantor(g)}
                      selected={selectedGuarantor?.id === g.id}>
                      <ListItemText primary={g.name}
                        secondary={`${g.cnic || ''} ${g.phone || ''} • ${g.agreements_count || 0} agreements`} />
                    </ListItem>
                  ))}
                </List>
                <Typography variant="caption" color="text.secondary">Ek guarantor multiple customers ke liye use ho sakta hai.</Typography>
              </>
            )}

            {guarantorMode === 'new' && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}><TextField fullWidth size="small" label="Name *" value={newG.name} onChange={(e) => setNewG({ ...newG, name: e.target.value })} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="CNIC" value={newG.cnic} onChange={(e) => setNewG({ ...newG, cnic: e.target.value })} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="Phone" value={newG.phone} onChange={(e) => setNewG({ ...newG, phone: e.target.value })} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="Occupation" value={newG.occupation} onChange={(e) => setNewG({ ...newG, occupation: e.target.value })} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="Monthly Income" type="number" value={newG.monthly_income} onChange={(e) => setNewG({ ...newG, monthly_income: e.target.value })} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="Relation" value={newG.relation_to_customer} onChange={(e) => setNewG({ ...newG, relation_to_customer: e.target.value })} /></Grid>
                <Grid item xs={12}><TextField fullWidth size="small" label="Address" value={newG.address} onChange={(e) => setNewG({ ...newG, address: e.target.value })} /></Grid>
              </Grid>
            )}

            {guarantorMode === 'none' && (
              <Alert severity="info" sx={{ mt: 1 }}>CNIC-Only financing — guarantor ke baghair agreement banega.</Alert>
            )}

            <TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mt: 1.5 }} />
          </>
        )}

        {/* ============ STEP 4: REVIEW ============ */}
        {step === 3 && (
          <Paper sx={{ p: 2, bgcolor: '#faf5ff' }}>
            <Grid container spacing={1}>
              <Grid item xs={6}><Typography variant="caption">Customer<br /><b>{selectedCustomer?.name}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Product<br /><b>{productName}</b> ({sourceMode})</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Guarantor<br /><b>{guarantorMode === 'none' ? 'CNIC-Only' : guarantorMode === 'existing' ? selectedGuarantor?.name : newG.name}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">IMEI<br /><b>{imeiDevice ? imeiDevice.imei1 : '—'}</b></Typography></Grid>
              <Grid item xs={4}><Typography variant="caption">Sale Price<br /><b>Rs. {fin.total.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={4}><Typography variant="caption">Down Payment<br /><b>Rs. {fin.down.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={4}><Typography variant="caption">Interest ({fin.rate}%)<br /><b>Rs. {fin.interest.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="subtitle2">Total Payable<br /><b style={{ color: '#7c3aed' }}>Rs. {fin.payable.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="subtitle2">Tenure<br /><b>{fin.months} months × ~Rs. {fin.schedule[0]?.amount.toLocaleString()}</b></Typography></Grid>
            </Grid>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
        {step > 0 && <Button onClick={() => setStep(s => s - 1)}>Back</Button>}
        {step < 3 && (
          <Button variant="contained"
            disabled={(step === 0 && !canNext1) || (step === 1 && !canNext2) || (step === 2 && !canNext3)}
            onClick={() => setStep(s => s + 1)}>Next</Button>
        )}
        {step === 3 && (
          <Button variant="contained" color="success" disabled={saving} onClick={handleCreate}>
            {saving ? 'Creating...' : 'Create EMI Agreement'}
          </Button>
        )}
      </DialogActions>

      <ImeiPickerModal open={imeiPickerOpen} onClose={() => setImeiPickerOpen(false)}
        onSelect={(u) => { setImeiDevice(u); setImeiPickerOpen(false); }} />
    </Dialog>
  );
}
