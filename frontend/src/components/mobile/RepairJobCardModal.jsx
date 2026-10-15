// ============================================================
//  RepairJobCardModal — Repair job intake + token
//  Photos (before/after), condition, passcode (encrypted server-side),
//  parts deduction from inventory, labor-only commission preview.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  Divider, Alert, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemText,
  Avatar,
} from '../ui/tailwind-mui';
import { Add, Delete, CameraAlt, Print, History } from '../ui/icons';
import api from '../../api/apiClient';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

export default function RepairJobCardModal({ open, onClose, onSaved }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');
  const [imeiHistory, setImeiHistory] = useState(null);
  const [fault, setFault] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [passcode, setPasscode] = useState('');
  const [laborAmount, setLaborAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [notes, setNotes] = useState('');
  // parts
  const [variants, setVariants] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [parts, setParts] = useState([]);
  // photos
  const [photoBefore, setPhotoBefore] = useState(null);
  const [photoAfter, setPhotoAfter] = useState(null);
  const [photoBeforePrev, setPhotoBeforePrev] = useState('');
  const [photoAfterPrev, setPhotoAfterPrev] = useState('');
  // refs
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [createdJob, setCreatedJob] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Load services - try multiple response formats
    api.get('/services').then(r => {
      const data = r.data?.data || r.data || [];
      setServices(Array.isArray(data) ? data : []);
    }).catch((err) => {
      console.error('Failed to load services:', err);
      setServices([]);
    });
    api.get('/services/staff/list').then(r => {
      const data = r.data?.data || r.data || [];
      setStaffList(Array.isArray(data) ? data : []);
    }).catch((err) => {
      console.error('Failed to load staff:', err);
      setStaffList([]);
    });
    api.get('/products/variants').then(r => setVariants(r.data?.data || r.data || [])).catch(() => {});
    setCreatedJob(null); setMsg(null);
  }, [open ]);

  const partResults = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    if (!q) return [];
    return variants.filter(v =>
      String(v.variant_name || v.product_name || '').toLowerCase().includes(q) ||
      String(v.sku || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [partSearch, variants]);

  const addPart = (v) => {
    if (parts.some(p => p.product_variant_id === v.id)) return;
    setParts(prev => [...prev, {
      product_variant_id: v.id,
      part_name: v.variant_name || v.product_name,
      qty: 1,
      cost_price: Number(v.purchase_price || 0),
      stock: Number(v.current_stock || 0),
    }]);
    setPartSearch('');
  };

  const lookupImei = async () => {
    const clean = imei.replace(/\D/g, '');
    if (!clean) return;
    try {
      const r = await api.get(`/imei/lookup/${clean}`);
      setImeiHistory(r.data?.data || null);
    } catch (e) {
      setImeiHistory({ notFound: true });
    }
  };

  const handlePhoto = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    if (kind === 'before') { setPhotoBefore(b64); setPhotoBeforePrev(b64); }
    else { setPhotoAfter(b64); setPhotoAfterPrev(b64); }
  };

  const partsTotal = useMemo(() => parts.reduce((s, p) => s + p.cost_price * p.qty, 0), [parts]);
  const grandTotal = (Number(laborAmount) || 0) + partsTotal;
  const staffCommPct = useMemo(() => {
    const s = staffList.find(x => String(x.id) === String(staffId));
    return Number(s?.commission_rate) || 0;
  }, [staffId, staffList]);
  const commPreview = +((Number(laborAmount) || 0) * staffCommPct / 100).toFixed(2);

  const handleSave = async () => {
    if (!customerName.trim()) { setMsg({ t: 'error', m: 'Customer name zaroori hai' }); return; }
    if (!fault.trim()) { setMsg({ t: 'error', m: 'Reported fault zaroori hai' }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await api.post('/repairs', {
        service_id: serviceId || null, staff_id: staffId || null,
        customer_name: customerName, customer_phone: customerPhone,
        device_model: deviceModel, imei: imei.replace(/\D/g, '') || null,
        problem_description: fault, condition_notes: conditionNotes, passcode,
        labor_amount: Number(laborAmount) || 0,
        advance_amount: Number(advanceAmount) || 0,
        notes,
        parts: parts.map(p => ({ product_variant_id: p.product_variant_id, qty: p.qty })),
      });
      const job = res.data?.data;
      // upload photos
      for (const [kind, b64] of [['before', photoBefore], ['after', photoAfter]]) {
        if (b64) {
          try { await api.post('/repairs/upload-photo', { job_id: job.id, kind, image: b64 }); } catch (e) {}
        }
      }
      setCreatedJob(job);
      setMsg({ t: 'success', m: `Job token ${job.order_number} created` });
      onSaved && onSaved(job);
    } catch (e) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || e.message || 'Save failed';
      setMsg({ t: 'error', m: `Save failed: ${errMsg}` });
      console.error('Repair job save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const printToken = () => {
    if (!createdJob) return;
    window.open(`/api/repairs/${createdJob.id}/token`, '_blank');
  };

  const reset = () => {
    setCustomerName(''); setCustomerPhone(''); setDeviceModel(''); setImei('');
    setImeiHistory(null); setFault(''); setConditionNotes(''); setPasscode('');
    setLaborAmount(''); setAdvanceAmount(''); setServiceId(''); setStaffId('');
    setNotes(''); setParts([]); setPhotoBefore(null); setPhotoAfter(null);
    setPhotoBeforePrev(''); setPhotoAfterPrev(''); setCreatedJob(null); setMsg(null);
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#7c3aed', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight="bold">🔧 Repair Job Card</Typography>
        {createdJob && <Chip label={createdJob.order_number} sx={{ bgcolor: 'white', fontWeight: 'bold' }} />}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {createdJob ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h5" fontWeight="bold" color="#7c3aed">{createdJob.order_number}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {customerName} • {deviceModel} • Total Rs. {Number(createdJob.total_amount).toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Balance: Rs. {(Number(createdJob.total_amount) - (Number(advanceAmount) || 0)).toLocaleString()}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button variant="outlined" startIcon={<Print />} onClick={printToken}>Print Token</Button>
              <Button variant="contained" onClick={() => { reset(); }}>New Job Card</Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Customer + device */}
            <Typography variant="caption" fontWeight="bold" color="text.secondary">CUSTOMER & DEVICE</Typography>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Customer Name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Mobile Model" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="iPhone 12" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <TextField fullWidth size="small" label="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="3569..." />
                  <IconButton size="small" onClick={lookupImei} title="IMEI history"><History /></IconButton>
                </Box>
              </Grid>
              {imeiHistory && !imeiHistory.notFound && imeiHistory.device && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="caption">
                      {imeiHistory.device.brand} {imeiHistory.device.model} — Status: <b>{imeiHistory.device.status}</b> •
                      History: {imeiHistory.history?.length || 0} events •
                      {imeiHistory.warranty?.active ? `Warranty active till ${imeiHistory.warranty.end}` : 'No active warranty'}
                    </Typography>
                  </Alert>
                </Grid>
              )}
              {imeiHistory?.notFound && (
                <Grid item xs={12}><Alert severity="warning">Ye IMEI system mein registered nahi hai.</Alert></Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Reported Fault *" value={fault} onChange={(e) => setFault(e.target.value)} placeholder="Touch not working" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Pre-Check Condition" value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} placeholder="Scratches on back, broken corner" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Passcode / Pattern" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Encrypted save hoga" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" select label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">— Select —</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} (Rs. {s.base_price})</option>)}
                </TextField>
                {services.length === 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    No services found. Add services in Services tab first.
                  </Typography>
                )}
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" select label="Technician" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">— Select —</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.commission_rate ? ` (${s.commission_rate}%)` : ''}</option>)}
                </TextField>
                {staffList.length === 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    No staff found. Add technicians in Staff tab first.
                  </Typography>
                )}
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Photos */}
            <Typography variant="caption" fontWeight="bold" color="text.secondary">BEFORE / AFTER PHOTOS</Typography>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {[
                { k: 'before', prev: photoBeforePrev, label: 'Photo Before Repair' },
                { k: 'after', prev: photoAfterPrev, label: 'Photo After Repair' },
              ].map(p => (
                <Grid item xs={6} key={p.k}>
                  <Box sx={{ border: '1px dashed #c4b5fd', borderRadius: 2, p: 1, textAlign: 'center' }}>
                    {p.prev
                      ? <Avatar src={p.prev} variant="rounded" sx={{ width: '100%', height: 90, mx: 'auto' }} />
                      : <CameraAlt sx={{ fontSize: 36, color: '#c4b5fd' }} />}
                    <Button size="small" component="label" sx={{ mt: 0.5 }}>
                      {p.label}
                      <input type="file" accept="image/*" hidden onChange={(e) => handlePhoto(e, p.k)} />
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Parts */}
            <Typography variant="caption" fontWeight="bold" color="text.secondary">SPARE PARTS (inventory se auto-deduct)</Typography>
            <TextField fullWidth size="small" label="Part search karo (name / SKU)" value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)} sx={{ mt: 0.5 }} />
            {partResults.length > 0 && (
              <List dense sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mt: 0.5, maxHeight: 150, overflow: 'auto' }}>
                {partResults.map(v => (
                  <ListItem key={v.id} button onClick={() => addPart(v)}>
                    <ListItemText primary={v.variant_name || v.product_name}
                      secondary={`Stock: ${v.current_stock} • Cost: Rs. ${v.purchase_price}`} />
                    <Add fontSize="small" />
                  </ListItem>
                ))}
              </List>
            )}
            {parts.length > 0 && (
              <List dense sx={{ mt: 0.5 }}>
                {parts.map((p, i) => (
                  <ListItem key={i} secondaryAction={
                    <IconButton size="small" onClick={() => setParts(prev => prev.filter((_, x) => x !== i))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  }>
                    <ListItemText primary={p.part_name}
                      secondary={`Qty ${p.qty} × Rs. ${p.cost_price} = Rs. ${p.qty * p.cost_price} (stock: ${p.stock})`} />
                    <TextField size="small" type="number" value={p.qty} sx={{ width: 70 }}
                      onChange={(e) => setParts(prev => prev.map((x, xi) => xi === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                  </ListItem>
                ))}
              </List>
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* Money */}
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="Labor Amount (Rs)" type="number" value={laborAmount} onChange={(e) => setLaborAmount(e.target.value)} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="Advance Received (Rs)" type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
              </Grid>
              <Grid item xs={4}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption" fontWeight="bold">
                    Total: Rs. {grandTotal.toLocaleString()} (Parts {partsTotal.toLocaleString()})
                  </Typography>
                  {staffCommPct > 0 && (
                    <Typography variant="caption" display="block">
                      Technician commission ({staffCommPct}% of labor): Rs. {commPreview.toLocaleString()}
                    </Typography>
                  )}
                </Alert>
              </Grid>
            </Grid>

            {msg && <Alert severity={msg.t} sx={{ mt: 1.5 }}>{msg.m}</Alert>}
          </>
        )}
      </DialogContent>
      {!createdJob && (
        <DialogActions>
          <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="contained" color="secondary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Create Job Token'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
