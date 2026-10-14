// ============================================================
//  ImeiLookupModal — IMEI search: full lifecycle history timeline,
//  repairs, warranty status.
// ============================================================
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, Alert, Chip, Divider, Grid,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

const STATUS_COLOR = { IN_STOCK: 'success', SOLD: 'error', RETURNED: 'warning' };

export default function ImeiLookupModal({ open, onClose }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const search = async () => {
    const clean = q.replace(/\D/g, '');
    if (!clean) return;
    setLoading(true); setErr(''); setData(null);
    try {
      const r = await api.get(`/imei/lookup/${clean}`);
      setData(r.data?.data);
    } catch (e) {
      setErr(e.response?.data?.error || 'IMEI not found');
    } finally {
      setLoading(false);
    }
  };

  const d = data?.device;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#1e40af', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">🔍 IMEI Lookup</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField fullWidth size="small" label="IMEI enter karo" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
          <Button variant="contained" onClick={search} disabled={loading}>
            {loading ? '...' : 'Search'}
          </Button>
        </Box>

        {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}

        {d && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                {d.imei1}
              </Typography>
              <Chip size="small" label={d.status} color={STATUS_COLOR[d.status] || 'default'} />
              <Chip size="small" label={d.condition_type} variant="outlined" />
            </Box>
            <Grid container spacing={1} sx={{ mt: 1 }}>
              <Grid item xs={6}><Typography variant="caption">Model: <b>{d.brand} {d.model}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Specs: <b>{d.ram}/{d.rom} {d.color}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Cost: <b>Rs. {Number(d.purchase_price).toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Sale: <b>Rs. {Number(d.sale_price).toLocaleString()}</b></Typography></Grid>
              {d.customer_name && (
                <Grid item xs={12}><Typography variant="caption">Customer: <b>{d.customer_name}</b></Typography></Grid>
              )}
              {data.warranty && (
                <Grid item xs={12}>
                  <Alert severity={data.warranty.active ? 'success' : 'warning'} sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      Warranty: {data.warranty.months} months ({data.warranty.start} → {data.warranty.end}) —
                      {data.warranty.active ? ' ACTIVE' : ' EXPIRED'}
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" fontWeight="bold">LIFECYCLE TIMELINE</Typography>
            <Box sx={{ mt: 1 }}>
              {(data.history || []).map((h, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.75, borderBottom: '1px solid #f1f5f9' }}>
                  <Chip size="small" label={h.action} sx={{ minWidth: 90 }} variant="outlined" />
                  <Box>
                    <Typography variant="caption" fontWeight="bold">
                      {h.from_status || '—'} → {h.to_status || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {h.customer_name ? `${h.customer_name} • ` : ''}Rs. {Number(h.amount).toLocaleString()} •
                      {' '}{new Date(h.created_at).toLocaleString('en-PK')}
                      {h.notes ? ` • ${h.notes}` : ''}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {(!data.history || data.history.length === 0) && (
                <Typography variant="caption" color="text.secondary">No history events.</Typography>
              )}
            </Box>

            {data.repairs && data.repairs.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" fontWeight="bold">REPAIR HISTORY ({data.repairs.length})</Typography>
                {data.repairs.map(r => (
                  <Box key={r.id} sx={{ py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="caption">
                      <b>{r.order_number}</b> — {r.problem_description} — {r.status} — Rs. {Number(r.total_amount).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
