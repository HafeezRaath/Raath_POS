// ============================================================
//  BulkImeiForm — Mobile shop: Bulk IMEI Scan stock-in
//  Common specs once + continuous IMEI scan/paste -> N rows.
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  Divider, Alert, Chip, IconButton, List, ListItem, ListItemText,
} from '../ui/tailwind-mui';
import { Add, Delete, QrCodeScanner } from '../ui/icons';
import api from '../../api/apiClient';

export default function BulkImeiForm({ productId = null, productVariantId = null, onDone }) {
  // common specs
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [ram, setRam] = useState('');
  const [rom, setRom] = useState('');
  const [color, setColor] = useState('');
  const [conditionType, setConditionType] = useState('new');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [notes, setNotes] = useState('');
  const [sellerName, setSellerName] = useState('');
  // scan list
  const [scanInput, setScanInput] = useState('');
  const [imeis, setImeis] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const addScan = () => {
    const raw = scanInput.trim().replace(/\D/g, '');
    if (!raw) return;
    if (imeis.some(i => i.imei1 === raw)) {
      setMsg({ t: 'error', m: `Duplicate in this batch: ${raw}` });
      return;
    }
    // IMEI2: allow "imei1,imei2" paste
    const parts = scanInput.trim().split(/[,;\s]+/).map(s => s.replace(/\D/g, '')).filter(Boolean);
    setImeis(prev => [...prev, { imei1: parts[0] || raw, imei2: parts[1] || '' }]);
    setScanInput('');
    setMsg(null);
  };

  const removeImei = (idx) => setImeis(prev => prev.filter((_, i) => i !== idx));

  const canSave = useMemo(() =>
    model.trim() !== '' && Number(salePrice) > 0 && imeis.length > 0 && !saving,
  [model, salePrice, imeis, saving]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/imei/bulk', {
        product_id: productId, product_variant_id: productVariantId,
        product_name: `${brand} ${model}`.trim(),
        brand, model, ram, rom, color, condition_type: conditionType,
        purchase_price: Number(purchasePrice) || 0,
        sale_price: Number(salePrice) || 0,
        warranty_months: Number(warrantyMonths) || 0,
        notes: sellerName.trim() ? `Seller: ${sellerName.trim()}${notes.trim() ? ' | ' + notes.trim() : ''}` : notes,
        imeis,
      });
      setMsg({ t: 'success', m: res.data?.message || `${imeis.length} units added` });
      setImeis([]);
      setSellerName('');
      onDone && onDone(res.data);
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
      <Typography variant="subtitle2" fontWeight="bold" color="#1e40af" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <QrCodeScanner fontSize="small" /> Bulk IMEI Scan Mode
        <Chip size="small" label={`${imeis.length} scanned`} color="primary" sx={{ ml: 'auto' }} />
      </Typography>

      <Typography variant="caption" fontWeight="bold" color="text.secondary">COMMON SPECS (ek dafa)</Typography>
      <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Apple" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Model *" value={model} onChange={(e) => setModel(e.target.value)} placeholder="iPhone 12" />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="RAM" value={ram} onChange={(e) => setRam(e.target.value)} placeholder="4GB" />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="ROM" value={rom} onChange={(e) => setRom(e.target.value)} placeholder="128GB" />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Black" />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" select label="Condition" value={conditionType}
            onChange={(e) => setConditionType(e.target.value)}>
            <option value="new">New Box Pack</option>
            <option value="used">Used</option>
            <option value="kit">Kit (no box)</option>
          </TextField>
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="Cost (Rs)" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="Sale Price (Rs) *" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField fullWidth size="small" label="Warranty (mo)" type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth size="small" label="Seller Name (optional)" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Used phone bechne wala" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="caption" fontWeight="bold" color="text.secondary">SCAN / PASTE IMEI (Enter dabao)</Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
        <TextField fullWidth size="small" label="Scan IMEI barcode ya paste karo" value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addScan(); } }}
          placeholder="356938035643809" autoFocus />
        <Button variant="contained" onClick={addScan} startIcon={<Add />}>Add</Button>
      </Box>
      <Typography variant="caption" color="text.secondary">Tip: "imei1,imei2" paste karne pe dono save honge.</Typography>

      {imeis.length > 0 && (
        <List dense sx={{ mt: 1, maxHeight: 180, overflow: 'auto', bgcolor: 'white', borderRadius: 2, border: '1px solid #dbeafe' }}>
          {imeis.map((it, i) => (
            <ListItem key={i} secondaryAction={
              <IconButton edge="end" size="small" onClick={() => removeImei(i)}><Delete fontSize="small" /></IconButton>
            }>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{it.imei1}</Typography>}
                secondary={it.imei2 ? `IMEI2: ${it.imei2}` : 'IMEI2: —'} />
            </ListItem>
          ))}
        </List>
      )}

      {msg && <Alert severity={msg.t} sx={{ mt: 1.5 }}>{msg.m}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" color="primary" disabled={!canSave} onClick={handleSave}>
          {saving ? 'Saving...' : `Save ${imeis.length} Units to Stock`}
        </Button>
      </Box>
    </Paper>
  );
}
