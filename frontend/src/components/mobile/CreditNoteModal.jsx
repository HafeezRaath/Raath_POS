// ============================================================
//  CreditNoteModal — Supplier Credit Note / Rebate
//  Post-purchase price drop: history intact, supplier payable
//  reduced, amount booked to Purchase Discount / Rebate account.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, List, ListItem, ListItemText,
  Chip, Divider,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

export default function CreditNoteModal({ open, onClose, supplier, onApplied }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [noteNo, setNoteNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (open && supplier) {
      setMsg(null); setAmount(''); setReason(''); setNoteNo('');
      api.get('/credit-notes', { params: { supplier_id: supplier.id } })
        .then(r => setHistory(r.data?.data || []))
        .catch(() => setHistory([]));
    }
  }, [open, supplier]);

  const handleSave = async () => {
    if (!(Number(amount) > 0)) { setMsg({ t: 'error', m: 'Amount zaroori hai' }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await api.post('/credit-notes', {
        supplier_id: supplier.id,
        amount: Number(amount),
        reason,
        note_no: noteNo || undefined,
      });
      setMsg({ t: 'success', m: r.data?.message });
      onApplied && onApplied();
      const h = await api.get('/credit-notes', { params: { supplier_id: supplier.id } });
      setHistory(h.data?.data || []);
      setAmount(''); setReason(''); setNoteNo('');
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (id) => {
    if (!window.confirm('Ye credit note void karke reverse karna hai?')) return;
    try {
      const r = await api.put(`/credit-notes/${id}/void`);
      setMsg({ t: 'success', m: r.data?.message });
      onApplied && onApplied();
      const h = await api.get('/credit-notes', { params: { supplier_id: supplier.id } });
      setHistory(h.data?.data || []);
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Failed' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0f766e', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          🧾 Supplier Credit Note — {supplier?.name}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          <Typography variant="caption">
            Company ne price drop diya? Purani purchase <b>edit nahi</b> hogi — ye amount supplier
            payable se minus hokar <b>Purchase Discount / Rebate</b> account mein profit ban kar jayega.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField size="small" label="Amount (Rs) *" type="number" value={amount}
            onChange={(e) => setAmount(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
          <TextField size="small" label="Note No (optional)" value={noteNo}
            onChange={(e) => setNoteNo(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
        </Box>
        <TextField fullWidth size="small" label="Reason" value={reason}
          onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }}
          placeholder="e.g. Company price revision: Rs. 7500 → Rs. 7200" />

        {msg && <Alert severity={msg.t} sx={{ mt: 1.5 }}>{msg.m}</Alert>}

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" fontWeight="bold">PREVIOUS CREDIT NOTES</Typography>
        <List dense>
          {history.map(h => (
            <ListItem key={h.id} sx={{ border: '1px solid #f1f5f9', borderRadius: 1, mb: 0.5 }}
              secondaryAction={
                h.status !== 'void' && (
                  <Button size="small" color="error" onClick={() => handleVoid(h.id)}>Void</Button>
                )
              }>
              <ListItemText
                primary={<Typography variant="body2" fontWeight="bold">{h.note_no} — Rs. {Number(h.amount).toLocaleString()}</Typography>}
                secondary={`${h.reason || ''} • ${new Date(h.created_at).toLocaleDateString('en-PK')}`} />
              <Chip size="small" label={h.status} color={h.status === 'void' ? 'default' : 'success'} sx={{ mr: 1 }} />
            </ListItem>
          ))}
          {history.length === 0 && (
            <Typography variant="caption" color="text.secondary">Koi credit note nahi hai.</Typography>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" sx={{ bgcolor: '#0f766e' }} disabled={saving} onClick={handleSave}>
          {saving ? 'Applying...' : 'Apply Credit Note'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
