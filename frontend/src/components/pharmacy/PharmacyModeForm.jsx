// ============================================================
//  PharmacyModeForm — Pharmacy: 3-level unit conversion
//  THREE_LEVEL: Box -> Strip -> Tablet (stock: tablets Int)
//  TWO_LEVEL: Box -> Piece (stock: pieces Int)
//  SINGLE_UNIT: bottle/pack (stock: units Int)
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  Divider, Alert, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Checkbox, Switch,
} from '../ui/tailwind-mui';
import { formatPharmacyStock } from '../../utils/stockFormat';

const MODES = [
  { v: 'THREE_LEVEL', l: 'Box → Strip → Tablet' },
  { v: 'TWO_LEVEL', l: 'Box → Piece' },
  { v: 'SINGLE_UNIT', l: 'Single Unit (bottle/pack)' },
];

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Infusion/Drip', 'Sachet',
  'Ointment/Cream', 'Drops', 'Surgical', 'Baby Care', 'Equipment', 'Supplements/General'];

export default function PharmacyModeForm({ onChange }) {
  const [mode, setMode] = useState('THREE_LEVEL');
  // master
  const [genericName, setGenericName] = useState('');
  const [dosageForm, setDosageForm] = useState('Tablet');
  const [strength, setStrength] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [rack, setRack] = useState('');
  const [coldChain, setColdChain] = useState(false);
  const [rxRequired, setRxRequired] = useState(false);
  const [barcode, setBarcode] = useState('');
  // packing
  const [boxesPerCarton, setBoxesPerCarton] = useState('');
  const [stripsPerBox, setStripsPerBox] = useState('');
  const [unitsPerStrip, setUnitsPerStrip] = useState('');
  // stock entry
  const [byCarton, setByCarton] = useState(false);
  const [numCartons, setNumCartons] = useState('');
  const [numBoxes, setNumBoxes] = useState('');
  const [looseStrips, setLooseStrips] = useState('');
  const [looseUnits, setLooseUnits] = useState('');
  // batch + pricing
  const [batchNo, setBatchNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [costPerBox, setCostPerBox] = useState('');
  const [salePerBox, setSalePerBox] = useState('');
  const [syncOldPrice, setSyncOldPrice] = useState(false);

  const num = (v) => Math.max(0, Number(v) || 0);

  const pack = useMemo(() => {
    const spb = Math.floor(num(stripsPerBox));
    const ups = Math.floor(num(unitsPerStrip));
    const bpc = Math.floor(num(boxesPerCarton));
    let unitsPerBox = 0;
    if (mode === 'THREE_LEVEL') unitsPerBox = spb * ups;
    else if (mode === 'TWO_LEVEL') unitsPerBox = ups;
    else unitsPerBox = 1;
    return { spb, ups, bpc, unitsPerBox };
  }, [mode, stripsPerBox, unitsPerStrip, boxesPerCarton]);

  const stock = useMemo(() => {
    if (byCarton && pack.bpc > 0 && pack.unitsPerBox > 0) {
      return Math.floor(num(numCartons)) * pack.bpc * pack.unitsPerBox
        + Math.floor(num(numBoxes)) * pack.unitsPerBox
        + Math.floor(num(looseStrips)) * (mode === 'THREE_LEVEL' ? pack.ups : 1)
        + Math.floor(num(looseUnits));
    }
    return Math.floor(num(numBoxes)) * pack.unitsPerBox
      + Math.floor(num(looseStrips)) * (mode === 'THREE_LEVEL' ? pack.ups : 1)
      + Math.floor(num(looseUnits));
  }, [byCarton, numCartons, numBoxes, looseStrips, looseUnits, pack, mode]);

  const price = useMemo(() => {
    const cpb = num(costPerBox), spb2 = num(salePerBox);
    const upb = pack.unitsPerBox;
    return {
      costPerStrip: pack.spb > 0 ? +(cpb / pack.spb).toFixed(2) : 0,
      salePerStrip: pack.spb > 0 ? +(spb2 / pack.spb).toFixed(2) : 0,
      costPerUnit: upb > 0 ? +(cpb / upb).toFixed(2) : 0,
      salePerUnit: upb > 0 ? +(spb2 / upb).toFixed(2) : 0,
    };
  }, [costPerBox, salePerBox, pack]);

  useEffect(() => {
    onChange && onChange({
      mode, genericName, dosageForm, strength, manufacturer, rack,
      coldChain, rxRequired, barcode,
      boxesPerCarton: pack.bpc, stripsPerBox: pack.spb, unitsPerStrip: pack.ups,
      unitsPerBox: pack.unitsPerBox,
      totalUnits: stock,
      batchNo, expiry: expiry || null,
      costPerBox: num(costPerBox), salePerBox: num(salePerBox),
      costPerUnit: price.costPerUnit, salePerUnit: price.salePerUnit,
      costPerStrip: price.costPerStrip, salePerStrip: price.salePerStrip,
      syncOldPrice,
    });
  }, [mode, genericName, dosageForm, strength, manufacturer, rack, coldChain, rxRequired,
      barcode, pack, stock, batchNo, expiry, costPerBox, salePerBox, syncOldPrice, price, onChange]);

  const unitLabel = mode === 'THREE_LEVEL' ? 'Tablets' : mode === 'TWO_LEVEL' ? 'Pieces' : 'Units';

  return (
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #fecdd3', bgcolor: '#fff1f2', mt: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" color="#9f1239" sx={{ mb: 1.5 }}>
        Pharmacy — Unit & Batch Setup
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <Button key={m.v} size="small" variant={mode === m.v ? 'contained' : 'outlined'}
            color="error" onClick={() => setMode(m.v)}>{m.l}</Button>
        ))}
      </Box>

      {/* Master fields */}
      <Typography variant="caption" fontWeight="bold" color="text.secondary">MASTER DETAILS</Typography>
      <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Generic / Salt *" value={genericName}
            onChange={(e) => setGenericName(e.target.value)} placeholder="Paracetamol" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Dosage Form</InputLabel>
            <Select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} label="Dosage Form">
              {DOSAGE_FORMS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Strength / Size" value={strength}
            onChange={(e) => setStrength(e.target.value)} placeholder="500mg / 120ml / 22G" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Manufacturer" value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)} placeholder="GSK, Getz, Abbott" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Rack / Cabinet" value={rack}
            onChange={(e) => setRack(e.target.value)} placeholder="Rack A-2 / Fridge-1" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Barcode / SKU" value={barcode}
            onChange={(e) => setBarcode(e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <FormControlLabel control={<Checkbox size="small" checked={coldChain} onChange={(e) => setColdChain(e.target.checked)} />}
            label={<Typography variant="caption">Fridge Item (cold chain)</Typography>} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <FormControlLabel control={<Checkbox size="small" checked={rxRequired} onChange={(e) => setRxRequired(e.target.checked)} />}
            label={<Typography variant="caption">Prescription Required</Typography>} />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {/* Packing config */}
      <Typography variant="caption" fontWeight="bold" color="text.secondary">PACKING CONFIGURATION</Typography>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Boxes per Carton (optional)" type="number"
            value={boxesPerCarton} onChange={(e) => setBoxesPerCarton(e.target.value)} placeholder="24" />
        </Grid>
        {mode === 'THREE_LEVEL' && (
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Strips per Box *" type="number"
              value={stripsPerBox} onChange={(e) => setStripsPerBox(e.target.value)} placeholder="20" />
          </Grid>
        )}
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small"
            label={mode === 'THREE_LEVEL' ? 'Tablets per Strip *' : mode === 'TWO_LEVEL' ? 'Pieces per Box *' : 'Units (1)'}
            type="number" value={unitsPerStrip} onChange={(e) => setUnitsPerStrip(e.target.value)}
            placeholder={mode === 'SINGLE_UNIT' ? '1' : '10'} disabled={mode === 'SINGLE_UNIT'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption" fontWeight="bold">= {pack.unitsPerBox} {unitLabel}/Box</Typography>
          </Alert>
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {/* Stock entry */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" fontWeight="bold" color="text.secondary">STOCK ENTRY (smallest unit mein save hoga)</Typography>
        <FormControlLabel
          control={<Switch size="small" checked={byCarton} onChange={(e) => setByCarton(e.target.checked)} color="error" />}
          label={<Typography variant="caption" fontWeight="bold">By Master Carton</Typography>} />
      </Box>
      <Grid container spacing={2}>
        {byCarton && (
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Number of Cartons" type="number"
              value={numCartons} onChange={(e) => setNumCartons(e.target.value)} placeholder="2" />
          </Grid>
        )}
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Boxes" type="number"
            value={numBoxes} onChange={(e) => setNumBoxes(e.target.value)} placeholder="5" />
        </Grid>
        {mode === 'THREE_LEVEL' && (
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Loose Strips" type="number"
              value={looseStrips} onChange={(e) => setLooseStrips(e.target.value)} placeholder="0" />
          </Grid>
        )}
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label={mode === 'THREE_LEVEL' ? 'Loose Tablets' : 'Loose Pieces'} type="number"
            value={looseUnits} onChange={(e) => setLooseUnits(e.target.value)} placeholder="0" />
        </Grid>
        <Grid item xs={12}>
          <Alert severity="success" sx={{ py: 0.5 }}>
            <Typography variant="caption" fontWeight="bold">
              = {formatPharmacyStock(stock, mode, pack.spb, pack.ups)}
            </Typography>
          </Alert>
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {/* Batch + pricing */}
      <Typography variant="caption" fontWeight="bold" color="text.secondary">BATCH & PRICING (per box)</Typography>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Batch No" value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)} placeholder="B-01" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Expiry Date *" type="date" value={expiry}
            onChange={(e) => setExpiry(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Cost / Box (trade)" type="number"
            value={costPerBox} onChange={(e) => setCostPerBox(e.target.value)} />
          <Typography variant="caption" color="text.secondary">
            {mode === 'THREE_LEVEL' ? `Per strip: ${price.costPerStrip} • Per tab: ${price.costPerUnit}` : `Per unit: ${price.costPerUnit}`}
          </Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Sale / Box (MRP) *" type="number"
            value={salePerBox} onChange={(e) => setSalePerBox(e.target.value)} />
          <Typography variant="caption" color="text.secondary">
            {mode === 'THREE_LEVEL' ? `Per strip: ${price.salePerStrip} • Per tab: ${price.salePerUnit}` : `Per unit: ${price.salePerUnit}`}
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox size="small" checked={syncOldPrice} onChange={(e) => setSyncOldPrice(e.target.checked)} />}
            label={<Typography variant="caption">Purani batches ka sale price bhi is naye MRP pe update karo? (cost intact)</Typography>} />
        </Grid>
      </Grid>
    </Paper>
  );
}
