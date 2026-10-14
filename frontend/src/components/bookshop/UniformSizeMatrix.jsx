// ============================================================
//  UniformSizeMatrix — Bookshop: SIZE_MATRIX uniforms
//  School Name + Item (Shirt/Trouser/Blazer/...) x Size (24..34) grid
//  Auto-SKU: SCHOOLCODE-ITEM-SIZE
// ============================================================
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Chip, Grid,
  IconButton, Tooltip, Divider, Alert, Table, TableHead, TableRow,
  TableCell, TableBody,
} from '../ui/tailwind-mui';
import { Add, Delete } from '../ui/icons';

const DEFAULT_SIZES = ['24', '26', '28', '30', '32', '34'];
const UNIFORM_ITEMS = ['Shirt', 'Trouser', 'Blazer', 'Sweater', 'Tie', 'Belt', 'Socks', 'Frock', 'Dupatta', 'Cap'];

const cellKey = (size) => `size::${size}`;
const schoolCode = (name) => (name || '').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
const itemCode = (item) => (item || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'UNI';

export default function UniformSizeMatrix({
  schoolName = '',
  itemName = 'Shirt',
  purchasePrice = 0,
  salePrice = 0,
  minPrice = 0,
  lowStockDefault = 2,
  onChange,
}) {
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [newSize, setNewSize] = useState('');
  const [cells, setCells] = useState({});
  const [skuOverrides, setSkuOverrides] = useState({});

  const setCell = useCallback((key, val) => {
    const n = val === '' ? '' : Math.max(0, Math.floor(Number(val) || 0));
    setCells(prev => ({ ...prev, [key]: n }));
  }, []);

  const addSize = () => {
    const s = newSize.trim();
    if (!s || sizes.includes(s)) return;
    setSizes(prev => [...prev, s]);
    setNewSize('');
  };

  const removeSize = (s) => {
    if (sizes.length <= 1) return;
    setSizes(prev => prev.filter(x => x !== s));
    setCells(prev => { const n = { ...prev }; delete n[cellKey(s)]; return n; });
  };

  const totalQty = useMemo(() =>
    sizes.reduce((s, sz) => s + (Number(cells[cellKey(sz)]) || 0), 0), [sizes, cells]);

  const variants = useMemo(() =>
    sizes
      .filter(sz => (Number(cells[cellKey(sz)]) || 0) > 0)
      .map(sz => {
        const k = cellKey(sz);
        return {
          variant_name: `${itemName} - Size ${sz}`,
          size: sz,
          school: schoolName,
          item: itemName,
          sku: skuOverrides[k] || `${schoolCode(schoolName)}-${itemCode(itemName)}-${sz}`,
          sku_auto: !skuOverrides[k],
          quantity: Number(cells[k]) || 0,
          purchase_price: Number(purchasePrice) || 0,
          sale_price: Number(salePrice) || 0,
          min_price: Number(minPrice) || 0,
          low_stock_threshold: Number(lowStockDefault) || 2,
          attributes: { school: schoolName, item: itemName, size: sz, uniform: true },
        };
      }), [sizes, cells, schoolName, itemName, purchasePrice, salePrice, minPrice, lowStockDefault, skuOverrides]);

  useEffect(() => { onChange && onChange(variants, totalQty); }, [variants, totalQty, onChange]);

  return (
    <Paper sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #7dd3fc' }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        👔 Uniform Size Matrix — {schoolName || 'School'} / {itemName}
        <Chip size="small" label={`${totalQty} total`} color="info" sx={{ ml: 1 }} />
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><b>Size</b></TableCell>
            <TableCell><b>Qty</b></TableCell>
            <TableCell><b>SKU</b></TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sizes.map(sz => {
            const k = cellKey(sz);
            return (
              <TableRow key={sz}>
                <TableCell><Chip size="small" label={sz} color="primary" /></TableCell>
                <TableCell sx={{ width: 110 }}>
                  <TextField size="small" type="number" value={cells[k] ?? ''}
                    onChange={(e) => setCell(k, e.target.value)}
                    inputProps={{ min: 0, step: 1 }} sx={{ width: 100 }} />
                </TableCell>
                <TableCell sx={{ width: 200 }}>
                  <TextField size="small" placeholder={`${schoolCode(schoolName)}-${itemCode(itemName)}-${sz}`}
                    value={skuOverrides[k] || ''}
                    onChange={(e) => setSkuOverrides(p => ({ ...p, [k]: e.target.value }))}
                    sx={{ width: 190 }} />
                </TableCell>
                <TableCell sx={{ width: 40 }}>
                  <Tooltip title="Remove size">
                    <IconButton size="small" onClick={() => removeSize(sz)}><Delete fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
        <TextField size="small" label="Add size" value={newSize} onChange={(e) => setNewSize(e.target.value)}
          sx={{ width: 110 }} />
        <Button size="small" variant="outlined" startIcon={<Add />} onClick={addSize}>Add</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          SKU auto: {schoolCode(schoolName)}-{itemCode(itemName)}-SIZE
        </Typography>
      </Box>
      {totalQty > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="caption">{variants.length} variants, {totalQty} pieces total</Typography>
        </Alert>
      )}
    </Paper>
  );
}
