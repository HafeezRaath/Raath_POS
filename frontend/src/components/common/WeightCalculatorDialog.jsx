import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, Grid, Chip,
  IconButton, Stack, Tabs, Tab, Divider
} from '../ui/tailwind-mui';
import { Scale, Close, CheckCircle, AttachMoney } from '../ui/icons';

const WeightCalculatorDialog = ({ open, onClose, item, onApplyWeight }) => {
  const [calcMode, setCalcMode] = useState('grams'); // 'grams' or 'amount'
  const [grams, setGrams] = useState('');
  const [amount, setAmount] = useState('');

  const unitPrice = parseFloat(item?.price || item?.originalPrice || 0);

  useEffect(() => {
    if (open && item) {
      const currentQty = parseFloat(item.qty || 1);
      // If current qty is less than 5, might be fractional KG
      if (currentQty < 5 && currentQty > 0) {
        setGrams(String(Math.round(currentQty * 1000)));
        setAmount(String(Math.round(currentQty * unitPrice)));
      } else {
        setGrams('500');
        setAmount(String(Math.round(0.5 * unitPrice)));
      }
    }
  }, [open, item, unitPrice]);

  const handleGramsChange = (val) => {
    setGrams(val);
    const g = parseFloat(val) || 0;
    const kg = g / 1000;
    setAmount(g > 0 ? (kg * unitPrice).toFixed(1) : '');
  };

  const handleAmountChange = (val) => {
    setAmount(val);
    const amt = parseFloat(val) || 0;
    if (amt > 0 && unitPrice > 0) {
      const kg = amt / unitPrice;
      setGrams((kg * 1000).toFixed(0));
    } else {
      setGrams('');
    }
  };

  const handlePresetClick = (presetGrams) => {
    setGrams(String(presetGrams));
    const kg = presetGrams / 1000;
    setAmount((kg * unitPrice).toFixed(1));
  };

  const handleConfirm = () => {
    const g = parseFloat(grams) || 0;
    const kg = Math.round((g / 1000) * 1000) / 1000; // 3 decimal places
    if (kg > 0) {
      onApplyWeight(kg);
      onClose();
    }
  };

  const calculatedKg = (parseFloat(grams) || 0) / 1000;
  const calculatedTotal = calculatedKg * unitPrice;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#065f46', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Scale sx={{ fontSize: 22 }} />
          <Typography variant="subtitle1" fontWeight="bold">⚖️ Loose Weight Calculator</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {/* Product Info */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
          <Typography variant="subtitle2" fontWeight="bold" color="#065f46" noWrap>
            {item?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rate: <strong>Rs. {unitPrice.toLocaleString('en-PK')} / KG</strong>
          </Typography>
        </Box>

        {/* Calculation Mode Tabs */}
        <Tabs
          value={calcMode}
          onChange={(e, v) => setCalcMode(v)}
          variant="fullWidth"
          sx={{ mb: 2, '& .MuiTab-root': { fontSize: '0.8rem', minHeight: 38 } }}
        >
          <Tab value="grams" label="Weight in Grams" />
          <Tab value="amount" label="By Rupee Amount" />
        </Tabs>

        {/* Quick Weight Preset Buttons */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            POPULAR WEIGHTS:
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap gap={0.75}>
            {[
              { label: '100g', g: 100 },
              { label: '200g', g: 200 },
              { label: '250g (Pao)', g: 250 },
              { label: '400g', g: 400 },
              { label: '500g (Aadha KG)', g: 500 },
              { label: '750g', g: 750 },
              { label: '1 KG', g: 1000 },
              { label: '2 KG', g: 2000 }
            ].map(p => (
              <Chip
                key={p.g}
                label={p.label}
                clickable
                color={Number(grams) === p.g ? 'success' : 'default'}
                variant={Number(grams) === p.g ? 'filled' : 'outlined'}
                onClick={() => handlePresetClick(p.g)}
                size="small"
                sx={{ fontWeight: 600, fontSize: '0.72rem' }}
              />
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Inputs */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Weight (Grams)"
              type="number"
              value={grams}
              onChange={(e) => handleGramsChange(e.target.value)}
              placeholder="e.g. 200"
              helperText={`${calculatedKg.toFixed(3)} KG`}
              autoFocus={calcMode === 'grams'}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Target Amount (Rs.)"
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="e.g. 150"
              helperText="Auto-converts to weight"
              autoFocus={calcMode === 'amount'}
            />
          </Grid>
        </Grid>

        {/* Live Calculation Display */}
        <Box sx={{ 
          mt: 2, 
          p: 1.5, 
          borderRadius: 2, 
          bgcolor: '#ecfdf5', 
          border: '1px solid #a7f3d0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box>
            <Typography variant="caption" color="#047857" fontWeight={600} display="block">
              NET QUANTITY
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="#065f46">
              {grams ? `${grams}g (${calculatedKg.toFixed(3)} KG)` : '0.000 KG'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="#047857" fontWeight={600} display="block">
              TOTAL PRICE
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="#065f46">
              Rs. {Math.round(calculatedTotal).toLocaleString('en-PK')}
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
          color="success"
          disabled={!calculatedKg || calculatedKg <= 0}
          startIcon={<CheckCircle />}
          sx={{ fontWeight: 'bold' }}
        >
          Apply to Cart ({calculatedKg.toFixed(3)} KG)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WeightCalculatorDialog;
