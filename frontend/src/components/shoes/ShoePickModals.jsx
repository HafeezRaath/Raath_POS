// ============================================================
//  ShoePickModals — Shoes vertical billing helpers
//  1) ArticlePickerModal: article search → color/size quick pick
//  2) SizeExchangeModal: return +1 / issue -1 size exchange
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Grid, TextField, Alert,
} from '../ui/tailwind-mui';
import db from '../../database/db';

// ---------- 1) Article -> Color/Size picker ----------
export function ArticlePickerModal({ open, article, variants, onPick, onClose }) {
  const byColor = useMemo(() => {
    const map = {};
    (variants || []).forEach(v => {
      const c = v.variant_color || 'Standard';
      if (!map[c]) map[c] = [];
      map[c].push(v);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      String(a.variant_size).localeCompare(String(b.variant_size), undefined, { numeric: true })));
    return map;
  }, [variants]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Article: {article}
        <Typography variant="caption" display="block" color="text.secondary">
          Color aur Size select karein
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {Object.entries(byColor).map(([color, list]) => (
          <Box key={color} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              <Chip size="small" label={color} color="primary" variant="outlined" />
            </Typography>
            <Grid container spacing={1}>
              {list.map(v => {
                const stock = Number(v.current_stock) || 0;
                const out = stock <= 0;
                return (
                  <Grid item key={v.id} xs={4} sm={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      disabled={out}
                      onClick={() => onPick(v)}
                      sx={{
                        flexDirection: 'column', py: 1,
                        borderColor: out ? '#fecaca' : undefined,
                        opacity: out ? 0.55 : 1,
                      }}
                    >
                      <Typography variant="body2" fontWeight="bold">Size {v.variant_size || '-'}</Typography>
                      <Typography variant="caption" color={out ? 'error' : 'text.secondary'}>
                        {out ? 'Out' : `${stock} pairs`}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10, color: '#94a3b8' }}>{v.sku}</Typography>
                    </Button>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}
        {Object.keys(byColor).length === 0 && (
          <Typography color="text.secondary">Koi variant nahi mila.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Band karein</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- 2) Size exchange: wapis +1 / naya -1 ----------
export function SizeExchangeModal({ open, onClose, products, showSnackbar, onDone }) {
  const [q, setQ] = useState('');
  const [returnId, setReturnId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return (products || []).filter(p => {
      const art = String(p.article_no || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      const bc = String(p.barcode || '').toLowerCase();
      return art.includes(query) || sku.includes(query) || bc.includes(query);
    }).slice(0, 30);
  }, [q, products]);

  const label = (v) => `${v.variant_color || ''} / Size ${v.variant_size || '-'} — ${v.sku} (${v.current_stock || 0} pairs)`;

  const confirm = async () => {
    const ret = matches.find(v => String(v.id) === String(returnId));
    const iss = matches.find(v => String(v.id) === String(issueId));
    if (!ret || !iss) { showSnackbar('Dono variants select karein', 'warning'); return; }
    if (String(ret.id) === String(iss.id)) { showSnackbar('Wapis aur naya size alag hon', 'warning'); return; }
    if (Number(iss.current_stock) <= 0) { showSnackbar('Naya size out of stock hai', 'error'); return; }
    setBusy(true);
    try {
      await db.updateVariant(ret.id, { current_stock: Number(ret.current_stock || 0) + 1 });
      await db.updateVariant(iss.id, { current_stock: Number(iss.current_stock || 0) - 1 });
      showSnackbar(`Exchange done: ${ret.sku} +1, ${iss.sku} -1`, 'success');
      onDone && onDone();
      setQ(''); setReturnId(''); setIssueId('');
      onClose();
    } catch (e) {
      showSnackbar('Exchange failed: ' + e.message, 'error');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>Size Exchange</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth size="small" label="Article / SKU / Barcode search"
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ND-502" sx={{ mb: 2 }}
        />
        {matches.length > 0 && (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" fontWeight="bold" color="error">WAPIS (customer ne diya) +1</Typography>
              <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #fecaca', borderRadius: 1, p: 0.5 }}>
                {matches.map(v => (
                  <Button key={v.id} fullWidth size="small"
                    variant={String(returnId) === String(v.id) ? 'contained' : 'text'}
                    color="error"
                    onClick={() => setReturnId(v.id)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 0.25 }}>
                    <Typography variant="caption">{label(v)}</Typography>
                  </Button>
                ))}
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" fontWeight="bold" color="success.main">NAYA (customer ko diya) -1</Typography>
              <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #a7f3d0', borderRadius: 1, p: 0.5 }}>
                {matches.map(v => (
                  <Button key={v.id} fullWidth size="small"
                    variant={String(issueId) === String(v.id) ? 'contained' : 'text'}
                    color="success"
                    disabled={Number(v.current_stock) <= 0}
                    onClick={() => setIssueId(v.id)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 0.25 }}>
                    <Typography variant="caption">{label(v)}</Typography>
                  </Button>
                ))}
              </Box>
            </Grid>
          </Grid>
        )}
        {q.trim() && matches.length === 0 && (
          <Alert severity="info">Koi variant nahi mila.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" disabled={busy || !returnId || !issueId} onClick={confirm}>
          Exchange Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
