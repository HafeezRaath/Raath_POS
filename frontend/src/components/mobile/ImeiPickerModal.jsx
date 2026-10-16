// ============================================================
//  ImeiPickerModal — POS: model search -> available IN_STOCK units.
//  Select a unit -> added to cart as serialized line.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, List, ListItem, ListItemText, Chip, Alert,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

export default function ImeiPickerModal({ open, onClose, onSelect }) {
  const [q, setQ] = useState('');
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState('');
  const [loadErr, setLoadErr] = useState('');

  const load = async (search = '') => {
    setLoading(true); setLoadErr('');
    try {
      const r = await api.get('/imei/picker', { search });
      setUnits(r.data?.data || []);
      setTenant(r.data?.debug_tenant || '');
      if (!r.data?.data) setLoadErr(`DBG raw: ${JSON.stringify(r.data).slice(0, 200)}`);
    } catch (e) {
      setUnits([]);
      setLoadErr(`DBG err: ${e.response?.status || '?'} ${e.response?.data?.error || e.message || ''}`.slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) { setQ(''); load(''); } }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#1e40af', color: 'white' }}>
        <Typography variant="subtitle1" fontWeight="bold">📱 Select IMEI Unit (In Stock)</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField fullWidth size="small" label="Model / brand / IMEI search" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); load(q); } }} />
          <Button variant="contained" onClick={() => load(q)}>Search</Button>
        </Box>
        {loading && <Typography variant="caption" sx={{ mt: 1 }}>Loading...</Typography>}
        {!loading && units.length === 0 && (
          <Alert severity="info" sx={{ mt: 1.5 }}>Koi IN_STOCK unit nahi mili.{tenant ? ` (tenant: ${tenant})` : ''}{loadErr ? ` ${loadErr}` : ''}</Alert>
        )}
        <List dense sx={{ mt: 1, maxHeight: 320, overflow: 'auto' }}>
          {units.map(u => (
            <ListItem key={u.id} button onClick={() => onSelect(u)}
              sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mb: 0.5 }}>
              <ListItemText
                primary={<Typography variant="body2" fontWeight="bold">{u.brand} {u.model} <Chip size="small" label={u.condition_type} sx={{ ml: 0.5 }} /></Typography>}
                secondary={
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {u.imei1}{u.imei2 ? ` / ${u.imei2}` : ''} • {u.ram}/{u.rom} {u.color}
                  </Typography>
                } />
              <Typography variant="body2" fontWeight="bold" color="#1e40af">
                Rs. {Number(u.sale_price).toLocaleString()}
              </Typography>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
