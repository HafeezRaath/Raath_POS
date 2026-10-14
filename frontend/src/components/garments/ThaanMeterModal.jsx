// ============================================================
//  ThaanMeterModal — Billing: THAAN_FABRIC ke liye meter select
//  Quick presets + custom decimal input. Line total = m × Rs/m.
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Grid, TextField, Chip,
} from '../ui/tailwind-mui';

export default function ThaanMeterModal({ open, product, onClose, onConfirm }) {
  const [custom, setCustom] = useState('');

  const suitM = useMemo(() => {
    try {
      const d = typeof product?.description === 'string' ? JSON.parse(product.description) : (product?.description || {});
      return Number(d.thaan_suit_meters) > 0 ? Number(d.thaan_suit_meters) : 4;
    } catch { return 4; }
  }, [product]);

  const priceM = Number(product?.retail_price || product?.sale_price || 0);
  const stockM = Number(product?.current_stock || 0);

  const presets = [
    { label: `1 Full Suit (${suitM}m)`, meters: suitM },
    { label: `Big Suit (${(suitM + 0.5).toFixed(1)}m)`, meters: +(suitM + 0.5).toFixed(2) },
    { label: `1.5 Suit (${(suitM * 1.5).toFixed(1)}m)`, meters: +(suitM * 1.5).toFixed(2) },
    { label: 'Kid Suit (3m)', meters: 3 },
    { label: 'Shalwar / Trouser (2m)', meters: 2 },
  ];

  const pick = (meters) => {
    const m = Number(meters) || 0;
    if (m <= 0) return;
    if (m > stockM) {
      onConfirm && onConfirm({ error: `Sirf ${stockM}m stock hai` });
      return;
    }
    onConfirm && onConfirm({ meters: m });
    setCustom('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        {product?.product_name || 'Fabric'}
        <Typography variant="caption" display="block" color="text.secondary">
          Rs. {priceM}/meter • Stock: {stockM}m <Chip size="small" label={`${suitM}m = 1 suit`} sx={{ ml: 1, height: 18, fontSize: 10 }} />
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1}>
          {presets.map(p => (
            <Grid item xs={6} key={p.label}>
              <Button fullWidth variant="outlined" onClick={() => pick(p.meters)}
                sx={{ flexDirection: 'column', py: 1.2, textTransform: 'none' }}>
                <Typography variant="body2" fontWeight="bold">{p.label}</Typography>
                <Typography variant="caption" color="success.main" fontWeight="bold">
                  Rs. {(p.meters * priceM).toFixed(0)}
                </Typography>
              </Button>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <TextField fullWidth size="small" label="Custom meters (e.g. 3.75)" type="number"
            value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pick(custom)} />
          <Button variant="contained" onClick={() => pick(custom)}>Add</Button>
        </Box>
        {custom && Number(custom) > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }} fontWeight="bold" color="success.main">
            {custom}m × Rs. {priceM} = Rs. {(Number(custom) * priceM).toFixed(0)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
