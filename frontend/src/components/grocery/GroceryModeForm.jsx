// ============================================================
//  GroceryModeForm — Grocery / Super Mart: 3 selling modes
//  WEIGHT_LOOSE: stock HAMESHA grams (Int) mein
//  PACKED_UNIT: stock smallest pack (Int) mein
//  FRESH_BAKERY: pieces (Int) + expiry presets
// ============================================================
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  Divider, Alert, IconButton, Chip,
} from '../ui/tailwind-mui';
import { Add, Delete } from '../ui/icons';
import { formatLooseWeightStock } from '../../utils/stockFormat';

const MODES = [
  { v: 'WEIGHT_LOOSE', l: 'Loose Weight (daal/cheeni)' },
  { v: 'PACKED_UNIT', l: 'Packed Unit (box/pet)' },
  { v: 'FRESH_BAKERY', l: 'Fresh Bakery (expiry)' },
];

const EXPIRY_PRESETS = [
  { l: '+2 Days', d: 2 }, { l: '+3 Days', d: 3 }, { l: '+5 Days', d: 5 }, { l: '+7 Days', d: 7 },
];
const datePlus = (days) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function GroceryModeForm({ onChange }) {
  const [mode, setMode] = useState('WEIGHT_LOOSE');
  const [barcode, setBarcode] = useState('');
  const [urduName, setUrduName] = useState('');
  const [aisle, setAisle] = useState('');
  // weight
  const [sackKg, setSackKg] = useState('50');
  const [numSacks, setNumSacks] = useState('');
  const [extraLooseKg, setExtraLooseKg] = useState('');
  const [costPerSack, setCostPerSack] = useState('');
  const [retailPerKg, setRetailPerKg] = useState('');
  const [wholesalePerKg, setWholesalePerKg] = useState('');
  // packed
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [numBoxes, setNumBoxes] = useState('');
  const [looseUnits, setLooseUnits] = useState('');
  const [costPerBox, setCostPerBox] = useState('');
  const [retailPerUnit, setRetailPerUnit] = useState('');
  const [wholesaleBoxPrice, setWholesaleBoxPrice] = useState('');
  const [quickVariants, setQuickVariants] = useState([]);
  const [qvLabel, setQvLabel] = useState('');
  const [qvBarcode, setQvBarcode] = useState('');
  const [qvPrice, setQvPrice] = useState('');
  const [qvQty, setQvQty] = useState('');
  // bakery
  const [bakeryQty, setBakeryQty] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const num = (v) => Math.max(0, Number(v) || 0);

  const weight = useMemo(() => {
    const sackG = Math.round(num(sackKg) * 1000);
    const totalGrams = Math.round(num(numSacks) * sackG + num(extraLooseKg) * 1000);
    const costKg = num(sackKg) > 0 ? +(num(costPerSack) / num(sackKg)).toFixed(2) : 0;
    return { sackG, totalGrams, costKg };
  }, [sackKg, numSacks, extraLooseKg, costPerSack]);

  const packed = useMemo(() => {
    const upb = Math.floor(num(unitsPerBox));
    const totalUnits = Math.floor(num(numBoxes)) * upb + Math.floor(num(looseUnits));
    const costUnit = upb > 0 ? +(num(costPerBox) / upb).toFixed(2) : 0;
    return { upb, totalUnits, costUnit };
  }, [unitsPerBox, numBoxes, looseUnits, costPerBox]);

  useEffect(() => {
    onChange && onChange({
      mode, barcode, urduName, aisle,
      // weight
      sackKg: num(sackKg), numSacks: num(numSacks), extraLooseKg: num(extraLooseKg),
      totalGrams: weight.totalGrams, gramsPerSack: weight.sackG,
      costPerSack: num(costPerSack), costPerKg: weight.costKg,
      retailPerKg: num(retailPerKg), wholesalePerKg: num(wholesalePerKg),
      // packed
      unitsPerBox: packed.upb, numBoxes: Math.floor(num(numBoxes)), looseUnits: Math.floor(num(looseUnits)),
      totalUnits: packed.totalUnits, costPerBox: num(costPerBox), costPerUnit: packed.costUnit,
      retailPerUnit: num(retailPerUnit), wholesaleBoxPrice: num(wholesaleBoxPrice),
      quickVariants,
      // bakery
      bakeryQty: Math.floor(num(bakeryQty)), expiryDate: expiryDate || null,
    });
  }, [mode, barcode, urduName, aisle, sackKg, numSacks, extraLooseKg, costPerSack, retailPerKg,
      wholesalePerKg, unitsPerBox, numBoxes, looseUnits, costPerBox, retailPerUnit,
      wholesaleBoxPrice, quickVariants, bakeryQty, expiryDate, weight, packed, onChange]);

  const addQuickVariant = () => {
    if (!qvLabel.trim() || !(num(qvPrice) > 0)) return;
    setQuickVariants(prev => [...prev, {
      label: qvLabel.trim(), barcode: qvBarcode.trim(), price: num(qvPrice), qty: Math.floor(num(qvQty)),
    }]);
    setQvLabel(''); setQvBarcode(''); setQvPrice(''); setQvQty('');
  };

  const rkg = num(retailPerKg);

  return (
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #fed7aa', bgcolor: '#fff7ed', mt: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" color="#9a3412" sx={{ mb: 1.5 }}>
        Grocery / Mart — Selling Mode
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <Button key={m.v} size="small" variant={mode === m.v ? 'contained' : 'outlined'}
            color="warning" onClick={() => setMode(m.v)}>{m.l}</Button>
        ))}
      </Box>

      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Barcode / EAN-13 / PLU" value={barcode}
            onChange={(e) => setBarcode(e.target.value)} placeholder="101" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Urdu Name (receipt)" value={urduName}
            onChange={(e) => setUrduName(e.target.value)} placeholder="دال چنا" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth size="small" label="Aisle / Rack Location" value={aisle}
            onChange={(e) => setAisle(e.target.value)} placeholder="Aisle 2 - Rack B" />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {mode === 'WEIGHT_LOOSE' && (
        <>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">SACK / BORA STOCK ENTRY (grams mein save hoga)</Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Sack Size (Kg)" type="number" value={sackKg} onChange={(e) => setSackKg(e.target.value)} />
            </Grid>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Number of Sacks" type="number" value={numSacks} onChange={(e) => setNumSacks(e.target.value)} placeholder="2" />
            </Grid>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Extra Loose (Kg)" type="number" value={extraLooseKg} onChange={(e) => setExtraLooseKg(e.target.value)} placeholder="0" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Alert severity="success" sx={{ py: 0.5 }}>
                <Typography variant="caption" fontWeight="bold">= {formatLooseWeightStock(weight.totalGrams, weight.sackG)}</Typography>
              </Alert>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Purchase Cost / Sack" type="number" value={costPerSack} onChange={(e) => setCostPerSack(e.target.value)} />
              <Typography variant="caption" color="text.secondary">Cost/Kg: Rs. {weight.costKg}</Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Retail Sale Price / Kg *" type="number" value={retailPerKg} onChange={(e) => setRetailPerKg(e.target.value)} placeholder="300" />
              <Typography variant="caption" color="text.secondary">
                250g = Rs. {(rkg * 0.25).toFixed(0)} • 500g = Rs. {(rkg * 0.5).toFixed(0)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Wholesale / Kg (5kg+)" type="number" value={wholesalePerKg} onChange={(e) => setWholesalePerKg(e.target.value)} />
            </Grid>
          </Grid>
        </>
      )}

      {mode === 'PACKED_UNIT' && (
        <>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">MULTI-PACK CALCULATOR (smallest pack mein save hoga)</Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Units per Box / Pet" type="number" value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} placeholder="12" />
            </Grid>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Number of Boxes" type="number" value={numBoxes} onChange={(e) => setNumBoxes(e.target.value)} placeholder="5" />
            </Grid>
            <Grid item xs={4} sm={3}>
              <TextField fullWidth size="small" label="Loose Units" type="number" value={looseUnits} onChange={(e) => setLooseUnits(e.target.value)} placeholder="0" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Alert severity="success" sx={{ py: 0.5 }}>
                <Typography variant="caption" fontWeight="bold">= {packed.totalUnits} Units</Typography>
              </Alert>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Cost Price / Box" type="number" value={costPerBox} onChange={(e) => setCostPerBox(e.target.value)} />
              <Typography variant="caption" color="text.secondary">Cost/unit: Rs. {packed.costUnit}</Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Retail / Unit (MRP) *" type="number" value={retailPerUnit} onChange={(e) => setRetailPerUnit(e.target.value)} placeholder="30" />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Full Box Wholesale Price" type="number" value={wholesaleBoxPrice} onChange={(e) => setWholesaleBoxPrice(e.target.value)} placeholder="340" />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary">
              QUICK ADD PRICE/SIZE VARIANTS (e.g. Sooper Rs. 10 / Rs. 30 / Rs. 50 — ek saath)
            </Typography>
            <Grid container spacing={1} sx={{ mt: 0.5 }} alignItems="center">
              <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Label" value={qvLabel} onChange={(e) => setQvLabel(e.target.value)} placeholder="Rs. 30" /></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Barcode" value={qvBarcode} onChange={(e) => setQvBarcode(e.target.value)} /></Grid>
              <Grid item xs={4} sm={2}><TextField fullWidth size="small" label="Price" type="number" value={qvPrice} onChange={(e) => setQvPrice(e.target.value)} /></Grid>
              <Grid item xs={4} sm={2}><TextField fullWidth size="small" label="Qty" type="number" value={qvQty} onChange={(e) => setQvQty(e.target.value)} /></Grid>
              <Grid item xs={4} sm={2}><Button size="small" variant="outlined" startIcon={<Add />} onClick={addQuickVariant}>Add</Button></Grid>
            </Grid>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {quickVariants.map((qv, i) => (
                <Chip key={i} label={`${qv.label} — Rs.${qv.price} × ${qv.qty}`}
                  onDelete={() => setQuickVariants(prev => prev.filter((_, x) => x !== i))}
                  color="warning" variant="outlined" size="small" />
              ))}
            </Box>
          </Box>
        </>
      )}

      {mode === 'FRESH_BAKERY' && (
        <>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">SHORT-EXPIRY STOCK (pieces mein)</Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Quantity (Pieces) *" type="number" value={bakeryQty} onChange={(e) => setBakeryQty(e.target.value)} placeholder="30" />
              <Typography variant="caption" color="text.secondary">Eggs: 1 Tray = 30</Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" label="Expiry Date *" type="date" value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={5}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', height: '100%' }}>
                {EXPIRY_PRESETS.map(p => (
                  <Button key={p.l} size="small" variant={expiryDate === datePlus(p.d) ? 'contained' : 'outlined'}
                    color="warning" onClick={() => setExpiryDate(datePlus(p.d))}>{p.l}</Button>
                ))}
              </Box>
            </Grid>
          </Grid>
          <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
            <Typography variant="caption">Expiry par "Return / Replace with Vendor" batch manager se hoga.</Typography>
          </Alert>
        </>
      )}
    </Paper>
  );
}
