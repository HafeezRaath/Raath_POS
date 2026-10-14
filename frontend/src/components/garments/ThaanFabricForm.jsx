// ============================================================
//  ThaanFabricForm — Garments: THAAN_FABRIC stock entry
//  Stock DB mein HAMESHA meters (Float) mein save hota hai.
//  Entry 2 tareeqon se: suits-per-thaan helper ya direct meters.
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Grid,
  FormControlLabel, Switch, Alert, Divider,
} from '../ui/tailwind-mui';
import { thaanToMeters, formatThaanStock } from '../../utils/stockFormat';

export default function ThaanFabricForm({
  color = '', onColorChange,
  costPerMeter = '', salePerMeter = '', minPerMeter = '',
  onPriceChange,
  onChange,
}) {
  const [suitMeters, setSuitMeters] = useState('4');
  const [bySuits, setBySuits] = useState(true);
  const [suitsPerThaan, setSuitsPerThaan] = useState('');
  const [numThaans, setNumThaans] = useState('');
  const [directMeters, setDirectMeters] = useState('');

  const meters = useMemo(() => {
    if (bySuits) return thaanToMeters(suitsPerThaan, suitMeters, numThaans);
    return Math.max(0, Number(directMeters) || 0);
  }, [bySuits, suitsPerThaan, suitMeters, numThaans, directMeters]);

  const sm = Number(suitMeters) > 0 ? Number(suitMeters) : 4;
  const costM = Number(costPerMeter) || 0;
  const saleM = Number(salePerMeter) || 0;
  const fmt = formatThaanStock(meters, sm);

  useEffect(() => {
    onChange && onChange({
      meters,
      suitMeters: sm,
      color,
      costPerMeter: costM,
      salePerMeter: saleM,
      minPerMeter: Number(minPerMeter) || 0,
    });
  }, [meters, sm, color, costM, saleM, minPerMeter, onChange]);

  return (
    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e9d5ff', bgcolor: '#faf5ff', mt: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" color="#6b21a8" sx={{ mb: 1.5 }}>
        Thaan / Roll Stock Entry (meters mein)
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Color" value={color}
            onChange={(e) => onColorChange && onColorChange(e.target.value)} placeholder="Navy Blue" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Standard Suit Cutting (meters)" type="number"
            value={suitMeters} onChange={(e) => setSuitMeters(e.target.value)} placeholder="4" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={<Switch checked={bySuits} onChange={(e) => setBySuits(e.target.checked)} color="secondary" />}
            label={<Typography variant="body2" fontWeight="bold">{bySuits ? 'By Suits in Thaan' : 'By Direct Meters'}</Typography>}
          />
        </Grid>
      </Grid>

      {bySuits ? (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth size="small" label="Suits per Thaan" type="number"
              value={suitsPerThaan} onChange={(e) => setSuitsPerThaan(e.target.value)} placeholder="28" />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth size="small" label="Number of Thaans" type="number"
              value={numThaans} onChange={(e) => setNumThaans(e.target.value)} placeholder="1" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Alert severity="success" sx={{ py: 0.5 }}>
              <Typography variant="caption" fontWeight="bold">
                = {meters} meters
                <Typography variant="caption" display="block" color="text.secondary">
                  {suitsPerThaan || 0} suits × {sm}m × {numThaans || 0} thaan
                </Typography>
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Meters (direct)" type="number"
              value={directMeters} onChange={(e) => setDirectMeters(e.target.value)} placeholder="112" />
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={2}>
        <Grid item xs={4}>
          <TextField fullWidth size="small" label="Cost / Meter" type="number"
            value={costPerMeter} onChange={(e) => onPriceChange && onPriceChange('costPerMeter', e.target.value)} />
          <Typography variant="caption" color="text.secondary">Per suit: Rs. {(costM * sm).toFixed(0)}</Typography>
        </Grid>
        <Grid item xs={4}>
          <TextField fullWidth size="small" label="Sale Price / Meter" type="number"
            value={salePerMeter} onChange={(e) => onPriceChange && onPriceChange('salePerMeter', e.target.value)} />
          <Typography variant="caption" color="text.secondary">Per suit: Rs. {(saleM * sm).toFixed(0)}</Typography>
        </Grid>
        <Grid item xs={4}>
          <TextField fullWidth size="small" label="Min Sale / Meter (bottom rate)" type="number"
            value={minPerMeter} onChange={(e) => onPriceChange && onPriceChange('minPerMeter', e.target.value)} />
          <Typography variant="caption" color="text.secondary">Bargaining lock</Typography>
        </Grid>
      </Grid>

      {meters > 0 && (
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: fmt.isCutPiece ? '#fef2f2' : '#f5f3ff', border: fmt.isCutPiece ? '1px solid #fecaca' : '1px solid #ddd6fe' }}>
          <Typography variant="body2" fontWeight="bold" color={fmt.isCutPiece ? '#b91c1c' : '#6d28d9'}>
            Stock: {fmt.text}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
