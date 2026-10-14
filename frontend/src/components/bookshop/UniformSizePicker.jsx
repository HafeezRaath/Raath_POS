// ============================================================
//  UniformSizePicker — Bookshop POS: uniform select → size picker
//  Shows available stock per size badge, one tap to add to cart.
// ============================================================
import React from 'react';
import {
  Box, Typography, Button, Chip, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '../ui/tailwind-mui';

export default function UniformSizePicker({ open, onClose, school = '', item = '', variants = [], onPick }) {
  const sorted = [...(variants || [])].sort((a, b) =>
    Number(a.size || 0) - Number(b.size || 0) || String(a.size).localeCompare(String(b.size)));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0284c7', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">👔 {school} — {item}</Typography>
        <Typography variant="caption">Size select karo</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={1.5}>
          {sorted.map(v => {
            const stock = Number(v.current_stock ?? v.quantity ?? 0);
            const out = stock <= 0;
            return (
              <Grid item xs={4} key={v.id}>
                <Button
                  fullWidth
                  variant={out ? 'outlined' : 'contained'}
                  disabled={out}
                  onClick={() => onPick(v)}
                  sx={{ py: 1.5, flexDirection: 'column', gap: 0.5,
                    bgcolor: out ? undefined : '#0284c7' }}
                >
                  <Typography variant="h6" fontWeight="bold">Size {v.size}</Typography>
                  <Chip size="small" label={out ? 'Out' : `${stock} pcs`}
                    color={out ? 'default' : stock <= 2 ? 'warning' : 'success'}
                    sx={{ height: 20, fontSize: '0.65rem' }} />
                  <Typography variant="caption">Rs. {Number(v.sale_price || v.retail_price || 0).toLocaleString()}</Typography>
                </Button>
              </Grid>
            );
          })}
        </Grid>
        {sorted.length === 0 && (
          <Typography variant="caption" color="text.secondary">No sizes available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
