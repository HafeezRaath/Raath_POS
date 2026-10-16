// ============================================================
//  EmiCollectionDashboard — due today / overdue / pending collections
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Button, Alert,
} from '../ui/tailwind-mui';
import api from '../../api/apiClient';

export default function EmiCollectionDashboard({ onCollect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/emi/collection-dashboard');
      setData(r.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Typography variant="caption">Loading dashboard...</Typography>;
  if (!data) return <Alert severity="error">Dashboard load failed</Alert>;

  const cards = [
    { label: 'Due Today', count: data.dueToday.count, amt: data.dueToday.amount, color: '#0284c7', bg: '#f0f9ff' },
    { label: 'Overdue', count: data.overdue.count, amt: data.overdue.amount, color: '#dc2626', bg: '#fef2f2', sub: `${data.overdue.agreements} agreements` },
    { label: 'Total Pending', count: data.pending.count, amt: data.pending.amount, color: '#7c3aed', bg: '#faf5ff' },
  ];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {cards.map(c => (
          <Grid item xs={12} sm={4} key={c.label}>
            <Paper sx={{ p: 2, bgcolor: c.bg, border: `1px solid ${c.color}33` }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">{c.label.toUpperCase()}</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ color: c.color }}>
                Rs. {Number(c.amt).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.count} installments {c.sub ? `• ${c.sub}` : ''}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>🔴 Overdue Accounts</Typography>
          <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell><b>Customer</b></TableCell>
                <TableCell align="right"><b>Overdue</b></TableCell>
                <TableCell align="right"><b>Days</b></TableCell>
                <TableCell></TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(data.overdueList || []).map(o => (
                  <TableRow key={o.emi_id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">{o.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.application_no} • since {o.oldest_due}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#dc2626', fontWeight: 'bold' }}>
                      Rs. {Number(o.overdue_amt).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={`${o.days_overdue}d`} color="error" />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => onCollect && onCollect(o.emi_id)}>Collect</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(data.overdueList || []).length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center">Koi overdue nahi 🎉</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>📅 Due Today ({data.today})</Typography>
          <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell><b>Customer</b></TableCell>
                <TableCell><b>Inst #</b></TableCell>
                <TableCell align="right"><b>Amount</b></TableCell>
                <TableCell></TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(data.dueTodayList || []).map((o, i) => (
                  <TableRow key={`${o.emi_id}-${i}`}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">{o.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.application_no}</Typography>
                    </TableCell>
                    <TableCell>#{o.installment_no}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Rs. {Number(o.planned_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => onCollect && onCollect(o.emi_id)}>Collect</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(data.dueTodayList || []).length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center">Aaj koi due nahi</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
