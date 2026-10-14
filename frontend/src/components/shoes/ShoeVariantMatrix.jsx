// ============================================================
//  ShoeVariantMatrix — Shoes shop: Color x Size variant grid
//  + Dual-mode stock entry (Loose Pairs vs Carton Assortment)
//  Auto-SKU: ARTICLE-COLORCODE-SIZE  (e.g. ND502-BLK-42)
// ============================================================
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Chip, Switch,
  FormControlLabel, Grid, IconButton, Tooltip, Divider, Alert,
} from '@mui/material';
import { Add, Delete, GridOn } from '@mui/icons-material';
import { applyCartonAssortment, formatShoeStock } from '../../utils/stockFormat';

const SIZE_PRESETS = {
  'Gents 39-44': ['39', '40', '41', '42', '43', '44'],
  'Ladies 36-41': ['36', '37', '38', '39', '40', '41'],
  'Kids 28-35': ['28', '29', '30', '31', '32', '33', '34', '35'],
};

const colorCode = (name) => (name || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CLR';
const cellKey = (ci, size) => `${ci}::${size}`;

export default function ShoeVariantMatrix({
  articleNo = '',
  purchasePrice = 0,
  salePrice = 0,
  minPrice = 0,
  lowStockDefault = 2,
  onChange,
}) {
  const [colors, setColors] = useState([{ name: 'Black', code: 'BLK' }]);
  const [newColor, setNewColor] = useState('');
  const [sizes, setSizes] = useState(SIZE_PRESETS['Gents 39-44']);
  const [newSize, setNewSize] = useState('');
  const [cartonMode, setCartonMode] = useState(false);
  const [pairsPerCarton, setPairsPerCarton] = useState('');
  const [numCartons, setNumCartons] = useState('');
  // cells: ratio-per-carton (carton mode) ya direct pairs (loose mode)
  const [cells, setCells] = useState({});
  // extra loose pairs (sirf carton mode mein)
  const [extraLoose, setExtraLoose] = useState({});
  // manual SKU overrides
  const [skuOverrides, setSkuOverrides] = useState({});

  const setCell = useCallback((key, val, setter) => {
    const n = val === '' ? '' : Math.max(0, Math.floor(Number(val) || 0));
    setter(prev => ({ ...prev, [key]: n }));
  }, []);

  const addColor = () => {
    const name = newColor.trim();
    if (!name) return;
    if (colors.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    setColors(prev => [...prev, { name, code: colorCode(name) }]);
    setNewColor('');
  };
  const removeColor = (idx) => {
    setColors(prev => prev.filter((_, i) => i !== idx));
  };
  const addSize = () => {
    const s = newSize.trim();
    if (!s || sizes.includes(s)) return;
    setSizes(prev => [...prev, s]);
    setNewSize('');
  };
  const removeSize = (s) => setSizes(prev => prev.filter(x => x !== s));

  const autoSku = useCallback((colorObj, size) => {
    const art = (articleNo || 'ART').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `${art}-${colorObj.code || colorCode(colorObj.name)}-${size}`;
  }, [articleNo]);

  // Har variant ka final qty + SKU compute karo
  const variants = useMemo(() => {
    const list = [];
    const ppc = Math.floor(Number(pairsPerCarton) || 0);
    const nc = Math.floor(Number(numCartons) || 0);
    colors.forEach((c, ci) => {
      sizes.forEach(size => {
        const key = cellKey(ci, size);
        const ratio = Math.floor(Number(cells[key]) || 0);
        const loose = Math.floor(Number(extraLoose[key]) || 0);
        const qty = cartonMode ? ratio * nc + loose : ratio;
        if (qty <= 0 && !skuOverrides[key]) return; // khaali cells skip
        const sku = skuOverrides[key] || autoSku(c, size);
        list.push({
          key,
          color: c.name,
          size,
          qty,
          ratioPerCarton: cartonMode ? ratio : null,
          extraLoose: cartonMode ? loose : 0,
          sku,
          barcode: sku,
          variant_name: `${c.name} / Size ${size}`,
          article_no: articleNo || null,
          purchase_price: Number(purchasePrice) || 0,
          retail_price: Number(salePrice) || 0,
          sale_price: Number(salePrice) || 0,
          minimum_retail_price: Number(minPrice) || 0,
          stock: qty,
          current_stock: qty,
          stock_alert_quantity: lowStockDefault,
        });
      });
    });
    return list;
  }, [colors, sizes, cells, extraLoose, cartonMode, pairsPerCarton, numCartons, skuOverrides, autoSku, articleNo, purchasePrice, salePrice, minPrice, lowStockDefault]);

  useEffect(() => {
    onChange && onChange(variants, {
      cartonMode,
      pairsPerCarton: Math.floor(Number(pairsPerCarton) || 0),
      numCartons: Math.floor(Number(numCartons) || 0),
    });
  }, [variants, cartonMode, pairsPerCarton, numCartons, onChange]);

  const totalPairs = variants.reduce((s, v) => s + v.qty, 0);
  const ppcNum = Math.floor(Number(pairsPerCarton) || 0);

  const renderMatrix = (values, setter, title, subtitle, showTotals) => (
    <Box sx={{ overflowX: 'auto', mt: 1 }}>
      <Typography variant="caption" fontWeight="bold" color="text.secondary">{title}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>{subtitle}</Typography>}
      <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: '#64748b' }}>Color \ Size</th>
            {sizes.map(s => (
              <th key={s} style={{ padding: '6px 4px', fontSize: 12, color: '#1e293b', minWidth: 64 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {s}
                  <IconButton size="small" sx={{ p: 0.25 }} onClick={() => removeSize(s)}><Delete sx={{ fontSize: 12 }} /></IconButton>
                </Box>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colors.map((c, ci) => (
            <tr key={ci}>
              <td style={{ padding: '4px 8px', fontSize: 13, fontWeight: 600 }}>
                <Chip size="small" label={c.name} onDelete={() => removeColor(ci)} sx={{ fontWeight: 'bold' }} />
              </td>
              {sizes.map(size => {
                const key = cellKey(ci, size);
                const ratio = Math.floor(Number(cells[key]) || 0);
                const nc = Math.floor(Number(numCartons) || 0);
                const loose = Math.floor(Number(extraLoose[key]) || 0);
                const computed = cartonMode && setter === setCells ? ratio * nc + loose : null;
                return (
                  <td key={size} style={{ padding: 4 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={values[key] ?? ''}
                      onChange={(e) => setCell(key, e.target.value, setter)}
                      placeholder="0"
                      inputProps={{ min: 0, style: { textAlign: 'center', padding: '6px 4px' } }}
                      sx={{ width: 64, bgcolor: 'white' }}
                    />
                    {showTotals && computed !== null && (
                      <Typography variant="caption" display="block" textAlign="center" color={computed > 0 ? '#059669' : 'text.disabled'} fontWeight="bold">
                        = {computed}
                      </Typography>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );

  return (
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#f8fafc', mt: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <GridOn fontSize="small" color="primary" />
        Color × Size Variant Matrix
      </Typography>

      {/* Colors editor */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        {colors.map((c, i) => (
          <Chip key={i} label={`${c.name} (${c.code})`} onDelete={() => removeColor(i)} color="primary" variant="outlined" size="small" />
        ))}
        <TextField size="small" placeholder="Add color (e.g. Tan)" value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addColor()}
          sx={{ width: 170 }} />
        <Button size="small" variant="outlined" startIcon={<Add />} onClick={addColor}>Add</Button>
      </Box>

      {/* Size presets */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">Size presets:</Typography>
        {Object.keys(SIZE_PRESETS).map(p => (
          <Button key={p} size="small" variant={JSON.stringify(sizes) === JSON.stringify(SIZE_PRESETS[p]) ? 'contained' : 'outlined'}
            onClick={() => setSizes(SIZE_PRESETS[p])}>{p}</Button>
        ))}
        <TextField size="small" placeholder="Custom size" value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSize()}
          sx={{ width: 110 }} />
        <Button size="small" variant="outlined" startIcon={<Add />} onClick={addSize}>Add</Button>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Carton toggle */}
      <FormControlLabel
        control={<Switch checked={cartonMode} onChange={(e) => setCartonMode(e.target.checked)} color="success" />}
        label={<Typography variant="body2" fontWeight="bold">{cartonMode ? 'CARTON ASSORTMENT MODE' : 'LOOSE PAIRS MODE'}</Typography>}
      />
      {cartonMode && (
        <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Pairs Per Carton *" type="number"
              value={pairsPerCarton} onChange={(e) => setPairsPerCarton(e.target.value)} placeholder="10" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Number of Cartons *" type="number"
              value={numCartons} onChange={(e) => setNumCartons(e.target.value)} placeholder="5" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                Har size ka ratio × cartons = auto total. Manual multiply karne ki zaroorat nahi.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      )}

      {renderMatrix(
        cells, setCells,
        cartonMode ? 'Assortment Ratio per Carton (har 1 carton mein kitne pairs)' : 'Quantity (Pairs) per Color & Size',
        cartonMode ? 'Neeche green number = final pairs (ratio × cartons + loose)' : null,
        cartonMode
      )}

      {cartonMode && (
        <Box sx={{ mt: 2 }}>
          {renderMatrix(extraLoose, setExtraLoose, 'Extra Loose Pairs (optional)', 'Kharab/khule pairs jo carton ke bahar hain', false)}
        </Box>
      )}

      {/* Summary */}
      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" fontWeight="bold" color="#065f46">
          Total: {cartonMode && ppcNum > 0 ? formatShoeStock(totalPairs, ppcNum) : `${totalPairs} Pairs`} • Variants: {variants.length}
        </Typography>
        <Typography variant="caption" color="#047857">
          SKU pattern: {articleNo || 'ART'}-<b>BLK</b>-<b>42</b> (auto, override possible below)
        </Typography>
      </Box>

      {/* SKU overrides */}
      {variants.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">Variant Barcodes / SKUs (click to override):</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {variants.map(v => (
              <Tooltip key={v.key} title={`${v.color} / Size ${v.size} — ${v.qty} pairs`}>
                <TextField
                  size="small"
                  value={skuOverrides[v.key] ?? v.sku}
                  onChange={(e) => setSkuOverrides(prev => ({ ...prev, [v.key]: e.target.value }))}
                  sx={{ width: 150 }}
                  inputProps={{ style: { fontSize: 12 } }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
