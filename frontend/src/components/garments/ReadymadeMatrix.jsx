// ============================================================
//  ReadymadeMatrix — Garments: READYMADE_STITCHED (Kurta/Suits)
//  Color x Size (S,M,L,XL) grid + Master Box assortment mode
//  Auto-SKU: ARTICLE-BLK-L
// ============================================================
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Chip, Switch,
  FormControlLabel, Grid, IconButton, Tooltip, Divider, Alert,
} from '../ui/tailwind-mui';
import { Add, Delete } from '../ui/icons';
import { applyCartonAssortment, formatKurtaStock } from '../../utils/stockFormat';

const SIZE_PRESETS = {
  'S - XL': ['S', 'M', 'L', 'XL'],
  'S - XXL': ['S', 'M', 'L', 'XL', 'XXL'],
  'Kids': ['2Y', '4Y', '6Y', '8Y', '10Y'],
};

const colorCode = (name) => (name || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CLR';
const cellKey = (ci, size) => `${ci}::${size}`;

export default function ReadymadeMatrix({
  articleNo = '',
  purchasePrice = 0,
  salePrice = 0,
  minPrice = 0,
  lowStockDefault = 2,
  onChange,
}) {
  const [colors, setColors] = useState([{ name: 'Black', code: 'BLK' }]);
  const [newColor, setNewColor] = useState('');
  const [sizes, setSizes] = useState(SIZE_PRESETS['S - XL']);
  const [newSize, setNewSize] = useState('');
  const [boxMode, setBoxMode] = useState(false);
  const [piecesPerBox, setPiecesPerBox] = useState('');
  const [numBoxes, setNumBoxes] = useState('');
  const [cells, setCells] = useState({});
  const [extraLoose, setExtraLoose] = useState({});
  const [skuOverrides, setSkuOverrides] = useState({});

  const setCell = useCallback((key, val, setter) => {
    const n = val === '' ? '' : Math.max(0, Math.floor(Number(val) || 0));
    setter(prev => ({ ...prev, [key]: n }));
  }, []);

  const addColor = () => {
    const name = newColor.trim();
    if (!name || colors.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    setColors(prev => [...prev, { name, code: colorCode(name) }]);
    setNewColor('');
  };
  const removeColor = (idx) => setColors(prev => prev.filter((_, i) => i !== idx));
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

  const variants = useMemo(() => {
    const list = [];
    const nb = Math.floor(Number(numBoxes) || 0);
    colors.forEach((c, ci) => {
      sizes.forEach(size => {
        const key = cellKey(ci, size);
        const ratio = Math.floor(Number(cells[key]) || 0);
        const loose = Math.floor(Number(extraLoose[key]) || 0);
        const qty = boxMode ? ratio * nb + loose : ratio;
        if (qty <= 0 && !skuOverrides[key]) return;
        const sku = skuOverrides[key] || autoSku(c, size);
        list.push({
          key, color: c.name, size, qty,
          ratioPerBox: boxMode ? ratio : null,
          sku, barcode: sku,
          variant_name: `${c.name} / Size ${size}`,
          article_no: articleNo || null,
          purchase_price: Number(purchasePrice) || 0,
          retail_price: Number(salePrice) || 0,
          sale_price: Number(salePrice) || 0,
          minimum_retail_price: Number(minPrice) || 0,
          stock: qty, current_stock: qty,
          stock_alert_quantity: lowStockDefault,
        });
      });
    });
    return list;
  }, [colors, sizes, cells, extraLoose, boxMode, numBoxes, skuOverrides, autoSku, articleNo, purchasePrice, salePrice, minPrice, lowStockDefault]);

  useEffect(() => {
    onChange && onChange(variants, {
      boxMode,
      piecesPerBox: Math.floor(Number(piecesPerBox) || 0),
      numBoxes: Math.floor(Number(numBoxes) || 0),
    });
  }, [variants, boxMode, piecesPerBox, numBoxes, onChange]);

  const totalPieces = variants.reduce((s, v) => s + v.qty, 0);
  const ppbNum = Math.floor(Number(piecesPerBox) || 0);

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
                const nb = Math.floor(Number(numBoxes) || 0);
                const loose = Math.floor(Number(extraLoose[key]) || 0);
                const computed = boxMode && setter === setCells ? ratio * nb + loose : null;
                return (
                  <td key={size} style={{ padding: 4 }}>
                    <TextField size="small" type="number" value={values[key] ?? ''}
                      onChange={(e) => setCell(key, e.target.value, setter)} placeholder="0"
                      inputProps={{ min: 0, style: { textAlign: 'center', padding: '6px 4px' } }}
                      sx={{ width: 64, bgcolor: 'white' }} />
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
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e9d5ff', bgcolor: '#faf5ff', mt: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" color="#6b21a8" sx={{ mb: 1.5 }}>
        Color × Size Variant Matrix (Readymade)
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        {colors.map((c, i) => (
          <Chip key={i} label={`${c.name} (${c.code})`} onDelete={() => removeColor(i)} color="secondary" variant="outlined" size="small" />
        ))}
        <TextField size="small" placeholder="Add color" value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addColor()} sx={{ width: 150 }} />
        <Button size="small" variant="outlined" startIcon={<Add />} onClick={addColor}>Add</Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">Size presets:</Typography>
        {Object.keys(SIZE_PRESETS).map(p => (
          <Button key={p} size="small" variant={JSON.stringify(sizes) === JSON.stringify(SIZE_PRESETS[p]) ? 'contained' : 'outlined'}
            onClick={() => setSizes(SIZE_PRESETS[p])}>{p}</Button>
        ))}
        <TextField size="small" placeholder="Custom" value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSize()} sx={{ width: 100 }} />
        <Button size="small" variant="outlined" startIcon={<Add />} onClick={addSize}>Add</Button>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <FormControlLabel
        control={<Switch checked={boxMode} onChange={(e) => setBoxMode(e.target.checked)} color="secondary" />}
        label={<Typography variant="body2" fontWeight="bold">{boxMode ? 'MASTER BOX / SET MODE' : 'LOOSE PIECES MODE'}</Typography>}
      />
      {boxMode && (
        <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Pieces Per Box *" type="number"
              value={piecesPerBox} onChange={(e) => setPiecesPerBox(e.target.value)} placeholder="8" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Number of Boxes *" type="number"
              value={numBoxes} onChange={(e) => setNumBoxes(e.target.value)} placeholder="4" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              <Typography variant="caption">Har size ka ratio × boxes = auto total. Manual multiply nahi karna.</Typography>
            </Alert>
          </Grid>
        </Grid>
      )}

      {renderMatrix(cells, setCells,
        boxMode ? 'Size Ratio per Box (har 1 box mein kitne pieces)' : 'Quantity (Pieces) per Color & Size',
        boxMode ? 'Neeche green number = final pieces (ratio × boxes + loose)' : null, boxMode)}

      {boxMode && (
        <Box sx={{ mt: 2 }}>
          {renderMatrix(extraLoose, setExtraLoose, 'Extra Loose Pieces (optional)', null, false)}
        </Box>
      )}

      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" fontWeight="bold" color="#6d28d9">
          Total: {boxMode && ppbNum > 0 ? formatKurtaStock(totalPieces, ppbNum) : `${totalPieces} Pieces`} • Variants: {variants.length}
        </Typography>
        <Typography variant="caption" color="#7c3aed">
          SKU: {articleNo || 'ART'}-<b>BLK</b>-<b>L</b> (auto)
        </Typography>
      </Box>

      {variants.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">Variant Barcodes / SKUs:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {variants.map(v => (
              <Tooltip key={v.key} title={`${v.color} / Size ${v.size} — ${v.qty} pcs`}>
                <TextField size="small" value={skuOverrides[v.key] ?? v.sku}
                  onChange={(e) => setSkuOverrides(prev => ({ ...prev, [v.key]: e.target.value }))}
                  sx={{ width: 150 }} inputProps={{ style: { fontSize: 12 } }} />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
