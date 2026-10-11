import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, Grid, Chip,
  IconButton, Stack, Tabs, Tab, Divider
} from '../ui/tailwind-mui';
import { Straighten, Close, CheckCircle } from '../ui/icons';

const RollCalculatorDialog = ({ open, onClose, item, onApplyLength }) => {
  const [unitMode, setUnitMode] = useState('inches'); // 'inches', 'meters', 'yards', 'feet'
  const [inches, setInches] = useState('');
  const [meters, setMeters] = useState('');
  const [yards, setYards] = useState('');
  const [feet, setFeet] = useState('');

  const baseRate = parseFloat(item?.price || item?.originalPrice || 0);
  const baseUnit = (item?.unit || 'Meter').toLowerCase();

  useEffect(() => {
    if (open && item) {
      const currentQty = parseFloat(item.qty || 1);
      if (baseUnit.includes('meter')) {
        updateFromMeters(currentQty);
      } else if (baseUnit.includes('yard') || baseUnit.includes('gaz')) {
        updateFromYards(currentQty);
      } else {
        updateFromInches(currentQty * 36);
      }
    }
  }, [open, item, baseUnit]);

  const updateFromInches = (val) => {
    const inc = parseFloat(val) || 0;
    setInches(val);
    setMeters(inc > 0 ? (inc * 0.0254).toFixed(3) : '');
    setYards(inc > 0 ? (inc / 36).toFixed(3) : '');
    setFeet(inc > 0 ? (inc / 12).toFixed(2) : '');
  };

  const updateFromMeters = (val) => {
    const m = parseFloat(val) || 0;
    setMeters(val);
    setInches(m > 0 ? (m * 39.3701).toFixed(1) : '');
    setYards(m > 0 ? (m * 1.09361).toFixed(3) : '');
    setFeet(m > 0 ? (m * 3.28084).toFixed(2) : '');
  };

  const updateFromYards = (val) => {
    const yd = parseFloat(val) || 0;
    setYards(val);
    setInches(yd > 0 ? (yd * 36).toFixed(1) : '');
    setMeters(yd > 0 ? (yd * 0.9144).toFixed(3) : '');
    setFeet(yd > 0 ? (yd * 3).toFixed(2) : '');
  };

  const updateFromFeet = (val) => {
    const ft = parseFloat(val) || 0;
    setFeet(val);
    setInches(ft > 0 ? (ft * 12).toFixed(1) : '');
    setMeters(ft > 0 ? (ft * 0.3048).toFixed(3) : '');
    setYards(ft > 0 ? (ft / 3).toFixed(3) : '');
  };

  const handleConfirm = () => {
    let finalQty = 1;
    if (baseUnit.includes('yard') || baseUnit.includes('gaz')) {
      finalQty = parseFloat(yards) || 1;
    } else if (baseUnit.includes('inch')) {
      finalQty = parseFloat(inches) || 1;
    } else {
      // Default Meter
      finalQty = parseFloat(meters) || 1;
    }

    onApplyLength(Math.round(finalQty * 1000) / 1000);
    onClose();
  };

  const displayTotal = () => {
    let qty = parseFloat(meters) || 0;
    if (baseUnit.includes('yard') || baseUnit.includes('gaz')) {
      qty = parseFloat(yards) || 0;
    } else if (baseUnit.includes('inch')) {
      qty = parseFloat(inches) || 0;
    }
    return Math.round(qty * baseRate);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#312e81', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Straighten sx={{ fontSize: 22 }} />
          <Typography variant="subtitle1" fontWeight="bold">📏 Sheet / Fabric Roll Calculator</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {/* Product Info */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#eef2ff', borderRadius: 2, border: '1px solid #c7d2fe' }}>
          <Typography variant="subtitle2" fontWeight="bold" color="#312e81" noWrap>
            {item?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Base Rate: <strong>Rs. {baseRate.toLocaleString('en-PK')} / {item?.unit || 'Meter'}</strong>
          </Typography>
        </Box>

        {/* Quick Presets */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            QUICK LENGTH PRESETS:
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap gap={0.75}>
            {[
              { label: '18" (0.5 yd)', inc: 18 },
              { label: '24" (2 ft)', inc: 24 },
              { label: '36" (1 Yard / Ghaz)', inc: 36 },
              { label: '1.5 Yard (54")', inc: 54 },
              { label: '2 Yards (72")', inc: 72 },
              { label: '1 Meter (39.4")', inc: 39.37 },
              { label: '2.5 Meters', inc: 98.42 }
            ].map(p => (
              <Chip
                key={p.label}
                label={p.label}
                clickable
                color={Math.abs(Number(inches) - p.inc) < 0.5 ? 'primary' : 'default'}
                variant={Math.abs(Number(inches) - p.inc) < 0.5 ? 'filled' : 'outlined'}
                onClick={() => updateFromInches(p.inc)}
                size="small"
                sx={{ fontWeight: 600, fontSize: '0.72rem' }}
              />
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* 4-Way Unit Converter Inputs */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Length in Inches (in)"
              type="number"
              value={inches}
              onChange={(e) => updateFromInches(e.target.value)}
              placeholder="e.g. 18"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Length in Yards (Ghaz)"
              type="number"
              value={yards}
              onChange={(e) => updateFromYards(e.target.value)}
              placeholder="e.g. 0.5"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Length in Meters (m)"
              type="number"
              value={meters}
              onChange={(e) => updateFromMeters(e.target.value)}
              placeholder="e.g. 1.0"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Length in Feet (ft)"
              type="number"
              value={feet}
              onChange={(e) => updateFromFeet(e.target.value)}
              placeholder="e.g. 1.5"
            />
          </Grid>
        </Grid>

        {/* Live Calculation Display */}
        <Box sx={{ 
          mt: 2, 
          p: 1.5, 
          borderRadius: 2, 
          bgcolor: '#eef2ff', 
          border: '1px solid #c7d2fe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box>
            <Typography variant="caption" color="#4338ca" fontWeight={600} display="block">
              CONVERTED LENGTH
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="#312e81">
              {inches || 0}" = {yards || 0} yd = {meters || 0} m
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="#4338ca" fontWeight={600} display="block">
              TOTAL PRICE
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="#312e81">
              Rs. {displayTotal().toLocaleString('en-PK')}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          sx={{ bgcolor: '#312e81', '&:hover': { bgcolor: '#222060' }, fontWeight: 'bold' }}
          startIcon={<CheckCircle />}
        >
          Apply to Cart ({inches ? `${inches}"` : 'Length'})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RollCalculatorDialog;
