// ============================================================
//  BundleManager — Bookshop: "Class Complete Set" bundles
//  One-click bundle: name + barcode + bundle price + component items
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Chip, Grid,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  IconButton, Divider, Autocomplete,
} from '../ui/tailwind-mui';
import { Add, Delete, Edit } from '../ui/icons';
import api from '../../api/apiClient';

export default function BundleManager({ open, onClose }) {
  const [bundles, setBundles] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editBundle, setEditBundle] = useState(null);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [variantResults, setVariantResults] = useState([]);
  const [itemQty, setItemQty] = useState('1');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/bundles');
      setBundles(r.data || []);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const searchVariants = async (q) => {
    setVariantSearch(q);
    if (q.length < 2) { setVariantResults([]); return; }
    try {
      const r = await api.get('/products/variants');
      const all = r.data?.data || r.data || [];
      const needle = q.toLowerCase();
      const filtered = all.filter(v =>
        String(v.product_name || '').toLowerCase().includes(needle) ||
        String(v.variant_name || '').toLowerCase().includes(needle) ||
        String(v.sku || '').toLowerCase().includes(needle) ||
        String(v.barcode || '').toLowerCase().includes(needle)
      );
      setVariantResults(filtered.slice(0, 15));
    } catch (e) { setVariantResults([]); }
  };

  const addItem = (v) => {
    if (!v || items.some(i => i.product_variant_id === v.id)) return;
    setItems(prev => [...prev, {
      product_variant_id: v.id,
      variant_name: v.variant_name,
      product_name: v.product_name,
      qty: parseInt(itemQty) || 1,
    }]);
    setVariantSearch(''); setVariantResults([]); setItemQty('1');
  };

  const openForm = (b = null) => {
    setEditBundle(b);
    setName(b?.name || '');
    setClassName(b?.class_name || '');
    setBarcode(b?.barcode || '');
    setPrice(b?.bundle_price || '');
    setNotes(b?.notes || '');
    setItems((b?.items || []).map(i => ({
      product_variant_id: i.product_variant_id,
      variant_name: i.variant_name,
      product_name: i.product_name,
      qty: i.qty,
    })));
    setMsg(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !items.length) { setMsg({ t: 'error', m: 'Name + at least 1 item required' }); return; }
    try {
      const payload = { name: name.trim(), class_name: className.trim(), barcode: barcode.trim(), bundle_price: Number(price) || 0, notes, items };
      if (editBundle) await api.put(`/bundles/${editBundle.id}`, payload);
      else await api.post('/bundles', payload);
      setFormOpen(false); load();
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Save failed' });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this bundle?')) return;
    await api.delete(`/bundles/${id}`);
    load();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#7c3aed', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">📚 Class Bundles (Complete Sets)</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => openForm()} sx={{ mb: 1.5 }}>
          New Bundle
        </Button>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell><b>Bundle</b></TableCell>
            <TableCell><b>Class</b></TableCell>
            <TableCell align="right"><b>Price</b></TableCell>
            <TableCell><b>Items</b></TableCell>
            <TableCell><b>Status</b></TableCell>
            <TableCell></TableCell>
          </TableRow></TableHead>
          <TableBody>
            {bundles.map(b => (
              <TableRow key={b.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{b.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{b.barcode || 'no barcode'}</Typography>
                </TableCell>
                <TableCell>{b.class_name || '—'}</TableCell>
                <TableCell align="right"><b>Rs. {Number(b.bundle_price).toLocaleString()}</b></TableCell>
                <TableCell>
                  <Chip size="small" label={`${b.items?.length || 0} items`}
                    color={b.can_fulfill ? 'success' : 'warning'} />
                </TableCell>
                <TableCell>{b.is_active ? <Chip size="small" label="Active" color="success" /> : <Chip size="small" label="Off" />}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openForm(b)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => remove(b.id)}><Delete fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {bundles.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                <Typography variant="caption" color="text.secondary">No bundles yet — e.g. "Class 5 Complete Set"</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {/* Bundle form */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editBundle ? 'Edit Bundle' : 'New Class Bundle'}</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Grid container spacing={1} sx={{ mb: 1.5 }}>
              <Grid item xs={12}><TextField fullWidth size="small" label="Bundle Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 5 Complete Set" /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="Class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class 5" /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="Barcode (scan at POS)" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="Bundle Price (Rs)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Grid>
            </Grid>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Items in bundle</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField size="small" label="Search product/variant" value={variantSearch}
                onChange={(e) => searchVariants(e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="Qty" type="number" value={itemQty}
                onChange={(e) => setItemQty(e.target.value)} sx={{ width: 80 }} />
            </Box>
            {variantResults.length > 0 && (
              <Paper sx={{ maxHeight: 150, overflow: 'auto', mb: 1 }}>
                {variantResults.map(v => (
                  <Box key={v.id} sx={{ p: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f3f4f6' } }}
                    onClick={() => addItem(v)}>
                    <Typography variant="body2">{v.product_name} — {v.variant_name}</Typography>
                    <Typography variant="caption" color="text.secondary">Stock: {v.stock ?? v.current_stock ?? v.quantity ?? 0}</Typography>
                  </Box>
                ))}
              </Paper>
            )}
            {items.map((i, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{i.product_name} — {i.variant_name}</Typography>
                <Chip size="small" label={`x${i.qty}`} />
                <IconButton size="small" onClick={() => setItems(prev => prev.filter((_, j) => j !== idx))}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            {msg && <Alert severity={msg.t} sx={{ mt: 1 }}>{msg.m}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={save}>Save Bundle</Button>
          </DialogActions>
        </Dialog>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
