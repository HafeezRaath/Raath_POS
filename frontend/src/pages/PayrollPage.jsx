// ============================================================
//  PayrollPage — Staff monthly salary slips
//  Net = Base Salary + Labor-only commission − deductions
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '../components/ui/tailwind-mui';
import api from '../api/apiClient';

export default function PayrollPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState([]);
  const [slips, setSlips] = useState([]);
  const [msg, setMsg] = useState(null);
  const [deductions, setDeductions] = useState({});
  const [slipOpen, setSlipOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.get('/payroll/labor-summary', { month }),
        api.get('/payroll', { month }),
      ]);
      setSummary(s.data?.data || []);
      setSlips(p.data?.data || []);
    } catch (e) {
      setMsg({ t: 'error', m: 'Load failed' });
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    try {
      const r = await api.post('/payroll/generate', { month, deductions });
      setMsg({ t: 'success', m: r.data?.message });
      load();
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.error || 'Generate failed' });
    }
  };

  const handlePay = async (id) => {
    try {
      await api.put(`/payroll/${id}/pay`);
      setMsg({ t: 'success', m: 'Slip marked paid' });
      load();
    } catch (e) {
      setMsg({ t: 'error', m: 'Failed' });
    }
  };

  const printSlip = (s) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><head><title>Salary Slip ${s.month}</title></head><body style="font-family:monospace;padding:20px">
      <h3 style="text-align:center">SALARY SLIP — ${s.month}</h3>
      <p><b>${s.staff_name}</b> (${s.role})</p><hr/>
      <p>Base Salary: Rs. ${Number(s.base_salary).toLocaleString()}</p>
      <p>Services Labor: Rs. ${Number(s.labor_total).toLocaleString()}</p>
      <p>Commission (${s.commission_percent}% of labor): Rs. ${Number(s.commission_amount).toLocaleString()}</p>
      <p>Deductions: Rs. ${Number(s.deductions).toLocaleString()} ${s.deduction_note ? `(${s.deduction_note})` : ''}</p>
      <hr/><h3>Net Pay: Rs. ${Number(s.net_pay).toLocaleString()}</h3>
      <p>Status: ${s.status.toUpperCase()}</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>💰 Staff Payroll</Typography>
      {msg && <Alert severity={msg.t} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.m}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" type="month" label="Month" value={month}
            onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={handleGenerate}>Generate Slips</Button>
          <Typography variant="caption" color="text.secondary">
            Commission sirf services labor pe — inventory sales pe nahi.
          </Typography>
        </Box>
      </Paper>

      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Labor Summary ({month})</Typography>
      <Paper sx={{ mb: 3, overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><b>Staff</b></TableCell>
              <TableCell align="right"><b>Base Salary</b></TableCell>
              <TableCell align="right"><b>Labor (services)</b></TableCell>
              <TableCell align="right"><b>Comm %</b></TableCell>
              <TableCell align="right"><b>Commission</b></TableCell>
              <TableCell align="right"><b>Deduction</b></TableCell>
              <TableCell align="right"><b>Net Pay</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.map(s => (
              <TableRow key={s.staff_id}>
                <TableCell>{s.staff_name} <Typography variant="caption" color="text.secondary">({s.jobs_done} jobs)</Typography></TableCell>
                <TableCell align="right">{Number(s.base_salary).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(s.labor_total).toLocaleString()}</TableCell>
                <TableCell align="right">{s.commission_percent}%</TableCell>
                <TableCell align="right">{Number(s.commission_amount).toLocaleString()}</TableCell>
                <TableCell align="right" sx={{ minWidth: 110 }}>
                  <TextField size="small" type="number" placeholder="0" sx={{ width: 90 }}
                    value={deductions[s.staff_id]?.amount || ''}
                    onChange={(e) => setDeductions(prev => ({ ...prev, [s.staff_id]: { ...prev[s.staff_id], amount: e.target.value } }))} />
                </TableCell>
                <TableCell align="right"><b>{Number(s.net_pay).toLocaleString()}</b></TableCell>
              </TableRow>
            ))}
            {summary.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">No staff found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Salary Slips ({month})</Typography>
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><b>Staff</b></TableCell>
              <TableCell align="right"><b>Base</b></TableCell>
              <TableCell align="right"><b>Labor</b></TableCell>
              <TableCell align="right"><b>Commission</b></TableCell>
              <TableCell align="right"><b>Deductions</b></TableCell>
              <TableCell align="right"><b>Net Pay</b></TableCell>
              <TableCell><b>Status</b></TableCell>
              <TableCell><b>Actions</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slips.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.staff_name}</TableCell>
                <TableCell align="right">{Number(s.base_salary).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(s.labor_total).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(s.commission_amount).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(s.deductions).toLocaleString()}</TableCell>
                <TableCell align="right"><b>{Number(s.net_pay).toLocaleString()}</b></TableCell>
                <TableCell>
                  <Chip size="small" label={s.status} color={s.status === 'paid' ? 'success' : 'warning'} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button size="small" variant="outlined" onClick={() => printSlip(s)}>Print</Button>
                    {s.status !== 'paid' && (
                      <Button size="small" variant="contained" color="success" onClick={() => handlePay(s.id)}>Pay</Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {slips.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center">No slips yet — Generate dabao.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Repair job entry point */}
      <Paper sx={{ p: 2, mt: 2, bgcolor: '#faf5ff', border: '1px solid #e9d5ff' }}>
        <Typography variant="caption" color="text.secondary">
          Repair job cards <b>Work Orders</b> page se banayein — labor yahan auto-count hoga jab job complete/delivered hogi.
        </Typography>
      </Paper>
    </Box>
  );
}
