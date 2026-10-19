import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, TextField, Grid,
  MenuItem, Select, FormControl, InputLabel, Chip, Stack,
  Switch, FormControlLabel, Alert, Tooltip, Divider, Paper
} from '../ui/tailwind-mui';
import {
  Close, Print, LocalPrintshop, Settings, CheckCircle,
  Add, Remove, QrCode, ContentCopy, AutoAwesome, Refresh
} from '../ui/icons';
import {
  DEFAULT_BARCODE_SETTINGS,
  BARCODE_PRESETS,
  getSavedBarcodeSettings,
  calculateBarcodeLayout,
  generateCode128Svg,
  printBarcodeJob
} from '../../utils/barcodeGenerator';
import { getEffectiveShopProfile } from '../../utils/receiptGenerator';
import db from '../../database/db';

const BarcodePrintModal = ({
  open,
  onClose,
  product,
  items,
  onSuccess
}) => {
  // Current active product or items list
  const activeProduct = useMemo(() => {
    if (product) return product;
    if (items && items.length > 0) return items[0];
    return null;
  }, [product, items]);

  const [settings, setSettings] = useState(() => getSavedBarcodeSettings());
  const [quantity, setQuantity] = useState(1);
  const [startColumn, setStartColumn] = useState(1);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [feedback, setFeedback] = useState(null);

  // Sync settings when modal opens
  useEffect(() => {
    if (open) {
      const saved = getSavedBarcodeSettings();
      setSettings(saved);
      // Default quantity to 1 or default copies
      setQuantity(saved.copies || 1);
      setStartColumn(1);
      setFeedback(null);
      fetchPrinters();
    }
  }, [open, activeProduct]);

  // Fetch printers from Electron if available
  const fetchPrinters = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getPrinters) {
        const list = await window.electronAPI.getPrinters();
        if (list && list.length > 0) {
          setAvailablePrinters(list);
          // If printer is not already selected, auto-select thermal barcode printer
          if (!settings.printerName) {
            const detected = list.find(p => /tsc|xprinter|zebra|barcode|label|365|244|gprinter/i.test(p.name)) || list.find(p => p.isDefault) || list[0];
            if (detected) {
              setSettings(prev => ({ ...prev, printerName: detected.name }));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch system printers:', e);
    }
  };

  // Handle Preset change
  const handlePresetChange = (presetId) => {
    const found = BARCODE_PRESETS.find(p => p.id === presetId);
    if (found) {
      setSettings(prev => ({
        ...prev,
        labelPreset: presetId,
        labelWidth: found.width,
        labelHeight: found.height,
        columns: found.columns,
        gapMm: found.gap
      }));
    } else if (presetId === 'custom') {
      setSettings(prev => ({ ...prev, labelPreset: 'custom' }));
    }
  };

  // Handle Columns change (1, 2, or 3)
  const handleColumnsChange = (cols) => {
    const numCols = Math.min(3, Math.max(1, cols));
    // Find a matching preset if available
    let presetMatch = settings.labelPreset;
    if (numCols === 1 && !presetMatch.includes('1col')) {
      presetMatch = '50x30mm_1col';
    } else if (numCols === 2 && !presetMatch.includes('2col')) {
      presetMatch = '38x25mm_2col';
    } else if (numCols === 3 && !presetMatch.includes('3col')) {
      presetMatch = '30x20mm_3col';
    }

    const found = BARCODE_PRESETS.find(p => p.id === presetMatch);
    setSettings(prev => ({
      ...prev,
      columns: numCols,
      labelPreset: presetMatch,
      labelWidth: found ? found.width : prev.labelWidth,
      labelHeight: found ? found.height : prev.labelHeight,
      gapMm: numCols > 1 ? (prev.gapMm || 2) : 0
    }));

    if (startColumn > numCols) {
      setStartColumn(1);
    }
  };

  // Calculate layout metrics
  const layout = useMemo(() => {
    return calculateBarcodeLayout(quantity, settings.columns, startColumn);
  }, [quantity, settings.columns, startColumn]);

  // Handle Print Action
  const handlePrint = async () => {
    if (!activeProduct && (!items || items.length === 0)) {
      setFeedback({ type: 'error', message: 'No product selected to print.' });
      return;
    }

    const targetBarcode = activeProduct?.barcode;
    if (!targetBarcode) {
      setFeedback({ type: 'warning', message: 'This product has no barcode! Please edit product to add or generate barcode first.' });
      return;
    }

    setPrinting(true);
    setFeedback(null);

    try {
      // Save settings to localStorage and database if requested
      if (saveAsDefault) {
        localStorage.setItem('barcode_settings', JSON.stringify(settings));
        try {
          if (db?.saveBarcodeSettings) {
            await db.saveBarcodeSettings(settings);
          }
        } catch (dbErr) {
          console.warn('Could not save barcode settings to DB:', dbErr);
        }
      }

      // Generate print payload
      const printItems = items && items.length > 0 ? items : {
        ...activeProduct,
        quantity: quantity
      };

      const printResult = await printBarcodeJob(printItems, {
        ...settings,
        startColumn: startColumn,
        copies: quantity
      });

      if (printResult.success) {
        setFeedback({
          type: 'success',
          message: `Printed ${layout.quantity} label(s) across ${layout.totalRows} row(s) to "${printResult.printerName}"!`
        });
        if (onSuccess) onSuccess(printResult);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: printResult.reason || 'Print failed. Check printer connection.' });
      }
    } catch (err) {
      console.error('Print barcode error:', err);
      setFeedback({ type: 'error', message: err.message || 'Error occurred while printing.' });
    } finally {
      setPrinting(false);
    }
  };

  if (!open) return null;

  const productName = activeProduct?.product_name || activeProduct?.name || 'Selected Product';
  const barcodeNumber = activeProduct?.barcode || 'N/A';
  const rawPrice = activeProduct?.retail_price !== undefined ? activeProduct?.retail_price : (activeProduct?.price || 0);
  const formattedPrice = Number(rawPrice).toLocaleString();
  const stockQty = activeProduct?.stock !== undefined ? activeProduct?.stock : (activeProduct?.quantity || 0);

  return (
    <Dialog
      open={open}
      onClose={printing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }
      }}
    >
      {/* DIALOG HEADER */}
      <DialogTitle sx={{
        bgcolor: '#1e1b4b',
        color: '#ffffff',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38,
            height: 38,
            borderRadius: 1.5,
            bgcolor: 'rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(165, 180, 252, 0.3)'
          }}>
            <LocalPrintshop sx={{ color: '#a5b4fc', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#ffffff', lineHeight: 1.2, fontSize: '1.1rem' }}>
              Barcode Label Printing
            </Typography>
            <Typography variant="caption" sx={{ color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>TSC & Thermal Roll Zero-Waste Engine</span>
              <span>•</span>
              <span style={{ color: '#86efac', fontWeight: 600 }}>Candela Compatible</span>
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={printing} sx={{ color: '#cbd5e1', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
        {feedback && (
          <Alert severity={feedback.type} sx={{ mb: 2, borderRadius: 1.5 }}>
            {feedback.message}
          </Alert>
        )}

        {/* PRODUCT OVERVIEW CARD */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                Product Title
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {productName}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  icon={<QrCode sx={{ fontSize: '14px !important' }} />}
                  label={barcodeNumber}
                  sx={{ fontFamily: 'monospace', fontWeight: 'bold', bgcolor: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}
                />
                {activeProduct?.sku && (
                  <Chip
                    size="small"
                    label={`SKU: ${activeProduct.sku}`}
                    sx={{ bgcolor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}
                  />
                )}
              </Stack>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, display: 'block' }}>
                  Retail Price
                </Typography>
                <Typography variant="subtitle1" fontWeight="900" sx={{ color: '#15803d' }}>
                  {settings.currencySymbol || 'Rs.'} {formattedPrice}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600, display: 'block' }}>
                  Current Stock
                </Typography>
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#1d4ed8' }}>
                  {stockQty} Units
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2.5}>
          {/* LEFT COLUMN: CONTROLS */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              {/* 1. QUANTITY SELECTOR */}
              <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>1. How Many Stickers to Print?</span>
                  <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>
                    {quantity} sticker{quantity > 1 ? 's' : ''} requested
                  </span>
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    sx={{ bgcolor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                  >
                    <Remove fontSize="small" />
                  </IconButton>
                  <TextField
                    size="small"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    inputProps={{ min: 1, max: 9999, style: { textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' } }}
                    sx={{ width: 100 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(prev => prev + 1)}
                    sx={{ bgcolor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Box>

                {/* Quick quantity chips */}
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 5, 10, 20].map(n => (
                    <Chip
                      key={n}
                      label={n}
                      size="small"
                      clickable
                      onClick={() => setQuantity(n)}
                      color={quantity === n ? 'primary' : 'default'}
                      variant={quantity === n ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 'bold', minWidth: 36 }}
                    />
                  ))}
                  {stockQty > 0 && (
                    <Chip
                      label={`Full Stock (${stockQty})`}
                      size="small"
                      clickable
                      onClick={() => setQuantity(stockQty)}
                      color={quantity === stockQty ? 'primary' : 'default'}
                      variant={quantity === stockQty ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 'bold' }}
                    />
                  )}
                </Box>
              </Box>

              {/* 2. ROLL COLUMNS SELECTOR (1, 2, or 3) */}
              <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1e293b', mb: 1 }}>
                  2. Stickers Per Row on Your Roll (Columns)
                </Typography>
                <Grid container spacing={1}>
                  {[
                    { col: 1, title: '1 Column', desc: 'Single Sticker / Row' },
                    { col: 2, title: '2 Columns', desc: '2 Stickers / Row (Standard)' },
                    { col: 3, title: '3 Columns', desc: '3 Stickers / Row (Candela)' }
                  ].map(c => {
                    const active = settings.columns === c.col;
                    return (
                      <Grid item xs={4} key={c.col}>
                        <Button
                          fullWidth
                          variant={active ? 'contained' : 'outlined'}
                          onClick={() => handleColumnsChange(c.col)}
                          sx={{
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 1.5,
                            bgcolor: active ? '#4f46e5' : '#ffffff',
                            color: active ? '#ffffff' : '#334155',
                            borderColor: active ? '#4f46e5' : '#cbd5e1',
                            '&:hover': { bgcolor: active ? '#4338ca' : '#f8fafc' },
                            textTransform: 'none'
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold" sx={{ color: 'inherit', fontSize: '0.85rem' }}>
                            {c.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontSize: '0.65rem' }}>
                            {c.desc}
                          </Typography>
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              {/* 3. ROLL DIMENSIONS PRESET */}
              <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1e293b', mb: 1 }}>
                  3. Label Size & Printer
                </Typography>
                <Stack spacing={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Label Size Preset</InputLabel>
                    <Select
                      value={settings.labelPreset || '38x25mm_2col'}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      label="Label Size Preset"
                    >
                      {BARCODE_PRESETS.map(p => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>Target Barcode Printer</InputLabel>
                    <Select
                      value={settings.printerName || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, printerName: e.target.value }))}
                      label="Target Barcode Printer"
                    >
                      <MenuItem value="">
                        <em>System Default Printer</em>
                      </MenuItem>
                      {availablePrinters.map((p, idx) => (
                        <MenuItem key={idx} value={p.name}>
                          {p.name} {p.isDefault ? '(Default)' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Partial Row Resume (for multi-column rolls) */}
                  {settings.columns > 1 && (
                    <Box sx={{ pt: 0.5, borderTop: '1px dashed #e2e8f0' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Reuse Partly Peeled Row? (Start Column)
                        </Typography>
                        <Typography variant="caption" color="primary" fontWeight="bold">
                          Col {startColumn}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {Array.from({ length: settings.columns }).map((_, idx) => (
                          <Button
                            key={idx + 1}
                            size="small"
                            variant={startColumn === idx + 1 ? 'contained' : 'outlined'}
                            onClick={() => setStartColumn(idx + 1)}
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              py: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              bgcolor: startColumn === idx + 1 ? '#0284c7' : '#ffffff',
                              color: startColumn === idx + 1 ? '#ffffff' : '#0f172a',
                              borderColor: startColumn === idx + 1 ? '#0284c7' : '#cbd5e1'
                            }}
                          >
                            Col {idx + 1}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Grid>

          {/* RIGHT COLUMN: VISUAL ROLL PREVIEW */}
          <Grid item xs={12} md={6}>
            <Box sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome sx={{ color: '#4f46e5', fontSize: 18 }} /> Live Thermal Roll Preview
                </Typography>
                <Chip
                  size="small"
                  label={`${settings.labelWidth}x${settings.labelHeight}mm • ${settings.columns} Col Roll`}
                  sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold', fontSize: '0.7rem' }}
                />
              </Box>

              {/* ZERO WASTE METRICS BADGE */}
              <Box sx={{
                p: 1.25,
                mb: 2,
                borderRadius: 1.5,
                bgcolor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CheckCircle sx={{ color: '#059669', fontSize: 20, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" fontWeight="bold" sx={{ color: '#065f46', lineHeight: 1.2, fontSize: '0.8rem' }}>
                    Zero Waste Ejection: Exactly {layout.totalRows} Row{layout.totalRows > 1 ? 's' : ''} Will Be Ejected
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#047857', display: 'block', mt: 0.25, fontSize: '0.7rem' }}>
                    {layout.trailingBlanks > 0
                      ? `Last row will have ${layout.trailingBlanks} empty slot(s). Printer sensor stops right at the gap.`
                      : 'All rows are completely full. 100% clean print.'}
                  </Typography>
                </Box>
              </Box>

              {/* VISUAL ROLL RENDERING CONTAINER */}
              <Box sx={{
                flex: 1,
                maxHeight: 280,
                overflowY: 'auto',
                p: 1.5,
                bgcolor: '#f8fafc',
                borderRadius: 1.5,
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                alignItems: 'center'
              }}>
                {Array.from({ length: Math.min(6, layout.totalRows) }).map((_, rIdx) => {
                  return (
                    <Box key={rIdx} sx={{ width: '100%' }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block', mb: 0.5, textAlign: 'center', fontSize: '0.65rem' }}>
                        — ROW {rIdx + 1} of {layout.totalRows} —
                      </Typography>

                      <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${settings.columns}, 1fr)`,
                        gap: 1,
                        bgcolor: '#ffffff',
                        p: 1,
                        borderRadius: 1.5,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {Array.from({ length: settings.columns }).map((_, cIdx) => {
                          const cellNumber = (rIdx * settings.columns) + cIdx;
                          const isLeadingBlank = cellNumber < layout.leadingBlanks;
                          const isRealLabel = cellNumber >= layout.leadingBlanks && cellNumber < (layout.leadingBlanks + layout.quantity);
                          const isTrailingBlank = cellNumber >= (layout.leadingBlanks + layout.quantity);

                          if (isRealLabel) {
                            const stickerNumber = cellNumber - layout.leadingBlanks + 1;
                            return (
                              <Box
                                key={cIdx}
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: '#ffffff',
                                  border: '1.5px solid #1e293b',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  minHeight: 100,
                                  textAlign: 'center',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                                }}
                              >
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b' }}>
                                  {/* QA-056: configured shop name, fallback chain */}
                                  #{stickerNumber} • {settings.shopName || getEffectiveShopProfile().name || 'MY STORE'}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.1, color: '#0f172a', my: 0.5 }}>
                                  {productName}
                                </Typography>

                                {/* Barcode Lines Visualization */}
                                <Box sx={{ width: '100%', my: 0.5 }}>
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: generateCode128Svg(barcodeNumber, { height: 26, showText: true, fontSize: 8 })
                                    }}
                                  />
                                </Box>

                                <Typography variant="caption" fontWeight="900" sx={{ fontSize: '0.8rem', color: '#000000' }}>
                                  {settings.currencySymbol || 'Rs.'} {formattedPrice}
                                </Typography>
                              </Box>
                            );
                          }

                          // Blank slot
                          return (
                            <Box
                              key={cIdx}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: '#f8fafc',
                                border: '1.5px dashed #cbd5e1',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 100,
                                textAlign: 'center',
                                color: '#94a3b8'
                              }}
                            >
                              <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                {isLeadingBlank ? 'Skipped Slot' : 'Blank Slot'}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#059669', fontWeight: 600, mt: 0.5 }}>
                                ✓ No Waste
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}

                {layout.totalRows > 6 && (
                  <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                    + {layout.totalRows - 6} more row(s) will be printed in this job...
                  </Typography>
                )}
              </Box>

              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      Save roll settings as store default
                    </Typography>
                  }
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      {/* DIALOG ACTIONS */}
      <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={printing}
          sx={{ borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handlePrint}
          disabled={printing || !activeProduct?.barcode}
          startIcon={<Print />}
          sx={{
            bgcolor: '#4f46e5',
            '&:hover': { bgcolor: '#4338ca' },
            px: 3,
            py: 1,
            fontWeight: 'bold',
            fontSize: '0.95rem',
            borderRadius: 1.5,
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)'
          }}
        >
          {printing ? 'Printing...' : `Print ${layout.quantity} Barcode Label${layout.quantity > 1 ? 's' : ''} (${layout.totalRows} Row${layout.totalRows > 1 ? 's' : ''})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BarcodePrintModal;
