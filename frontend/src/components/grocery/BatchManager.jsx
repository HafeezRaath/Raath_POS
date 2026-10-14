// ============================================================
//  BatchManager — Batch-wise pricing + expiry (Grocery/Pharmacy)
//  - Har purchase pe nayi batch; purani price overwrite nahi hoti
//  - Sync toggle: purani batches ka salePrice naye MRP pe
//  - Vendor return: expired stock wapis
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Grid, TextField, Chip,
  FormControlLabel, Checkbox, Table, TableHead, TableRow,
  TableCell, TableBody, Alert, Divider,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

const fmtDate = (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return d || '-'; } };
const daysLeft = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date().setHours(0, 0, 0, 0)) / 86400000);
};
const expiryChip = (d) => {
  const dl = daysLeft(d);
  if (dl === null) return <Typography variant="caption" color="text.secondary">—</Typography>;
  if (dl < 0) return <Chip size="small" color="error" label={`Expired (${-dl}d ago)`} sx={{ height: 20, fontSize: 11, fontWeight: 'bold' }} />;
  if (dl <= 3) return <Chip size="small" color="warning" label={`${dl}d left`} sx={{ height: 20, fontSize: 11, fontWeight: 'bold' }} />;
  return <Chip size="small" color="success" label={fmtDate(d)} variant="outlined" sx={{ height: 20, fontSize: 11 }} />;
};

export default function BatchManager({ open, onClose, product, onChanged }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ batch_no: '', expiry_date: '', qty: '', cost_price: '', sale_price: '', sync_old_price: false });

  const load = useCallback(async () => {
    if (!product?.product_id && !product?.id) return;
    setLoading(true);
    try {
      const pid = product.product_id || product.id;
      const res = await api.get(`/products/${pid}/batches`);
      setBatches(res.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [product]);

  useEffect(() => { if (open) { load(); setForm({ batch_no: '', expiry_date: '', qty: '', cost_price: '', sale_price: '', sync_old_price: false }); } }, [open, load]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addBatch = async () => {
    const q = parseFloat(form.qty) || 0;
    if (q <= 0) return;
    try {
      const pid = product.product_id || product.id;
      await api.post(`/products/${pid}/batches`, {
        batch_no: form.batch_no || null,
        expiry_date: form.expiry_date || null,
        qty: q,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        sync_old_price: !!form.sync_old_price,
      });
      setForm({ batch_no: '', expiry_date: '', qty: '', cost_price: '', sale_price: '', sync_old_price: false });
      await load();
      onChanged && onChanged();
    } catch (e) { alert('Batch add failed: ' + (e.response?.data?.error || e.message)); }
  };

  const vendorReturn = async (b) => {
    if (!window.confirm(`Batch ${b.batch_no || b.id} vendor ko wapis? Bachi stock (${b.qty_remaining}) minus hogi.`)) return;
    try {
      await api.post(`/products/batches/${b.id}/vendor-return`);
      await load();
      onChanged && onChanged();
    } catch (e) { alert('Vendor return failed: ' + (e.response?.data?.error || e.message)); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Batches — {product?.product_name || product?.name}
        <Typography variant="caption" display="block" color="text.secondary">
          Batch-wise pricing • FEFO deduction • Expiry tracking
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {/* Add batch */}
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>New Stock Batch (purchase)</Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={2.4}>
            <TextField fullWidth size="small" label="Batch No" value={form.batch_no} onChange={(e) => set('batch_no', e.target.value)} placeholder="B-01" />
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <TextField fullWidth size="small" label="Expiry" type="date" value={form.expiry_date}
              onChange={(e) => set('expiry_date', e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={4} sm={2.4}>
            <TextField fullWidth size="small" label="Qty *" type="number" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
          </Grid>
          <Grid item xs={4} sm={2.4}>
            <TextField fullWidth size="small" label="Cost Price" type="number" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} />
          </Grid>
          <Grid item xs={4} sm={2.4}>
            <TextField fullWidth size="small" label="Sale Price" type="number" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox size="small" checked={form.sync_old_price} onChange={(e) => set('sync_old_price', e.target.checked)} />}
              label={<Typography variant="caption">Purani batches ka sale price bhi is naye price pe update karo? (cost intact rahega)</Typography>}
            />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" size="small" onClick={addBatch} disabled={!(parseFloat(form.qty) > 0)}>
              Add Batch + Stock
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Batch list */}
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Active Batches (FEFO order)</Typography>
        {loading ? <Typography variant="caption">Loading...</Typography> : batches.length === 0 ? (
          <Alert severity="info" sx={{ py: 0.5 }}><Typography variant="caption">Koi batch nahi — pehli purchase yahin se add karein.</Typography></Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><b>Batch</b></TableCell>
                <TableCell><b>Expiry</b></TableCell>
                <TableCell><b>Left</b></TableCell>
                <TableCell><b>Cost</b></TableCell>
                <TableCell><b>Sale</b></TableCell>
                <TableCell align="right"><b>Action</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batches.map(b => (
                <TableRow key={b.id}>
                  <TableCell>{b.batch_no || `#${b.id}`}</TableCell>
                  <TableCell>{expiryChip(b.expiry_date)}</TableCell>
                  <TableCell><b>{b.qty_remaining}</b> <Typography variant="caption" color="text.secondary">/ {b.qty_received}</Typography></TableCell>
                  <TableCell>Rs. {b.cost_price}</TableCell>
                  <TableCell>Rs. {b.sale_price}</TableCell>
                  <TableCell align="right">
                    <Button size="small" color="warning" variant="outlined"
                      onClick={() => vendorReturn(b)} sx={{ fontSize: 11 }}>
                      Vendor Return
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export { expiryChip, daysLeft };
