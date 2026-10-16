// ============================================================
//  EarlySettlementModal — close EMI account early with optional
//  discount / unearned-interest waiver. ACTIVE -> COMPLETED.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, Grid, Paper,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

export default function EarlySettlementModal({ open, onClose, emi, onSettled }) {
  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (open && emi) {
      setDiscount(''); setNotes(''); setMsg(null); setDetail(null);
      api.get(`/emi/${emi.id}`).then(r => setDetail(r.data)).catch(() => {});
    }
  }, [open, emi]);

  const calc = (() => {
    if (!detail) return null;
    const base = Number(detail.total_payable) || Number(detail.remaining_amount) || 0;
    const paidDown = (detail.payments || [])
      .filter(p => p.notes === 'Down payment')
      .reduce((s, p) => s + Number(p.total_received || 0), 0);
    const paidInst = (detail.payments || [])
      .filter(p => p.notes !== 'Down payment')
      .reduce((s, p) => s + Number(p.total_received || 0), 0);
    const downAlready = paidDown || Number(detail.down_payment) || 0;
    const outstanding = Math.max(0, +(base - downAlready - paidInst).toFixed(2));
    const disc = Math.min(Number(discount) || 0, outstanding);
    return { base, downAlready, paidInst, outstanding, disc, final: +(outstanding - disc).toFixed(2) };
  })();

  const handleSettle = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.post(`/emi/${emi.id}/early-settlement`, {
        discount_amount: Number(discount) || 0,
        payment_mode: paymentMode,
        notes,
      });
      setMsg({ t: 'success', m: r.data?.message });
      onSettled && onSettled(r.data);
      setTimeout(onClose, 1500);
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Settlement failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#059669', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">✅ Early Settlement — {emi?.application_no}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {calc && (
          <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: '#f0fdf4' }}>
            <Grid container spacing={1}>
              <Grid item xs={6}><Typography variant="caption">Total Payable<br /><b>Rs. {calc.base.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Already Paid<br /><b>Rs. {(calc.downAlready + calc.paidInst).toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Outstanding<br /><b>Rs. {calc.outstanding.toLocaleString()}</b></Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Final After Discount<br /><b style={{ color: '#059669' }}>Rs. {calc.final.toLocaleString()}</b></Typography></Grid>
            </Grid>
          </Paper>
        )}
        <TextField fullWidth size="small" label="Discount / Interest Waiver (Rs)" type="number" value={discount}
          onChange={(e) => setDiscount(e.target.value)} sx={{ mb: 1 }}
          helperText="Unearned future interest yahan waive karo" />
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" select label="Payment Mode" value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzcash">JazzCash</option>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Grid>
        </Grid>
        {msg && <Alert severity={msg.t} sx={{ mt: 1.5 }}>{msg.m}</Alert>}
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          <Typography variant="caption">
            Settle karne pe status <b>ACTIVE → COMPLETED</b> ho jayega aur baqi schedule close.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" disabled={saving || !calc} onClick={handleSettle}>
          {saving ? 'Settling...' : `Settle Rs. ${calc ? calc.final.toLocaleString() : 0}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
