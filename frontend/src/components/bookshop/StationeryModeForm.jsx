// ============================================================
//  StationeryModeForm — Bookshop: THREE_LEVEL packing (Carton/Box/Piece)
//  Stock stored as integer totalPieces. Stock-in: cartons + boxes + loose.
//  Pricing per level: piece / box / carton.
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Grid, Chip, Alert } from '../ui/tailwind-mui';
import { stationeryToPieces, stationeryBreakdown, formatStationeryStock } from '../../utils/stockFormat';

export default function StationeryModeForm({
  pieceLabel = 'Pieces',
  initial = {},
  onChange,
}) {
  const [piecesPerBox, setPiecesPerBox] = useState(initial.piecesPerBox || '20');
  const [boxesPerCarton, setBoxesPerCarton] = useState(initial.boxesPerCarton || '30');
  const [inCartons, setInCartons] = useState(initial.inCartons || '');
  const [inBoxes, setInBoxes] = useState(initial.inBoxes || '');
  const [inLoose, setInLoose] = useState(initial.inLoose || '');
  const [piecePrice, setPiecePrice] = useState(initial.piecePrice || '');
  const [boxPrice, setBoxPrice] = useState(initial.boxPrice || '');
  const [cartonPrice, setCartonPrice] = useState(initial.cartonPrice || '');

  const totalPieces = useMemo(() =>
    stationeryToPieces(inCartons, boxesPerCarton, piecesPerBox, inBoxes, inLoose),
    [inCartons, boxesPerCarton, piecesPerBox, inBoxes, inLoose]
  );

  const display = useMemo(() =>
    formatStationeryStock(totalPieces, boxesPerCarton, piecesPerBox, pieceLabel),
    [totalPieces, boxesPerCarton, piecesPerBox, pieceLabel]
  );

  useEffect(() => {
    onChange && onChange({
      piecesPerBox: parseInt(piecesPerBox) || 1,
      boxesPerCarton: parseInt(boxesPerCarton) || 1,
      stockPieces: totalPieces,
      piecePrice: Number(piecePrice) || 0,
      boxPrice: Number(boxPrice) || 0,
      cartonPrice: Number(cartonPrice) || 0,
    });
  }, [piecesPerBox, boxesPerCarton, totalPieces, piecePrice, boxPrice, cartonPrice]);

  const intField = (label, value, set, helper) => (
    <Grid item xs={6} sm={4}>
      <TextField fullWidth size="small" label={label} type="number" value={value}
        onChange={(e) => set(e.target.value)} helperText={helper} inputProps={{ min: 0, step: 1 }} />
    </Grid>
  );

  return (
    <Paper sx={{ p: 2, bgcolor: '#fffbeb', border: '1px solid #fcd34d' }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        📦 Stationery 3-Level Packing (Carton → Box → {pieceLabel})
      </Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {intField('Pieces per Box', piecesPerBox, setPiecesPerBox, 'e.g. 20')}
        {intField('Boxes per Carton', boxesPerCarton, setBoxesPerCarton, 'e.g. 30')}
        <Grid item xs={12} sm={4}>
          <Chip label={`1 Carton = ${(parseInt(boxesPerCarton) || 1) * (parseInt(piecesPerBox) || 1)} ${pieceLabel}`}
            color="warning" size="small" sx={{ mt: 1 }} />
        </Grid>
      </Grid>
      <Typography variant="caption" fontWeight="bold" color="text.secondary">STOCK-IN (auto-calculates)</Typography>
      <Grid container spacing={1} sx={{ mt: 0.5, mb: 1 }}>
        {intField('Cartons', inCartons, setInCartons, 'full cartons')}
        {intField('Boxes', inBoxes, setInBoxes, 'extra boxes')}
        {intField(`Loose ${pieceLabel}`, inLoose, setInLoose, 'loose pieces')}
      </Grid>
      <Alert severity="success" sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight="bold">{display}</Typography>
        <Typography variant="caption">Saved as integer: {totalPieces} total pieces</Typography>
      </Alert>
      <Typography variant="caption" fontWeight="bold" color="text.secondary">SELLING PRICE PER LEVEL</Typography>
      <Grid container spacing={1} sx={{ mt: 0.5 }}>
        <Grid item xs={4}><TextField fullWidth size="small" label={`Per ${pieceLabel.slice(0, -1) || 'Piece'}`} type="number" value={piecePrice} onChange={(e) => setPiecePrice(e.target.value)} /></Grid>
        <Grid item xs={4}><TextField fullWidth size="small" label="Per Box" type="number" value={boxPrice} onChange={(e) => setBoxPrice(e.target.value)} /></Grid>
        <Grid item xs={4}><TextField fullWidth size="small" label="Per Carton" type="number" value={cartonPrice} onChange={(e) => setCartonPrice(e.target.value)} /></Grid>
      </Grid>
    </Paper>
  );
}
