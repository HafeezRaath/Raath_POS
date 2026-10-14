// ============================================================
//  stockFormat.js — Vertical-specific stock display helpers
//  GOLDEN RULE: kabhi decimal cartons/boxes mat dikhao
//  (no "3.5 Cartons", no "18.83 Boxes") — sirf integer
//  division (Math.floor) + remainder (%).
// ============================================================

/**
 * SHOES — totalPairs (Int), pairsPerCarton (nullable Int)
 *  - loose (null/0/<=1): "8 Pairs"
 *  - carton 10, total 50: "5 Cartons (50 Pairs)"
 *  - carton 10, total 35: "3 Cartons, 5 Pairs (35 Total)"
 *  - total < 1 carton: "8 Pairs"
 */
export function formatShoeStock(totalPairs, pairsPerCarton) {
  const total = Math.max(0, Math.floor(Number(totalPairs) || 0));
  const ppc = Math.floor(Number(pairsPerCarton) || 0);
  if (!ppc || ppc <= 1) return `${total} Pair${total === 1 ? '' : 's'}`;
  const cartons = Math.floor(total / ppc);
  const loose = total % ppc;
  if (cartons === 0) return `${total} Pair${total === 1 ? '' : 's'}`;
  if (loose === 0) return `${cartons} Carton${cartons === 1 ? '' : 's'} (${total} Pairs)`;
  return `${cartons} Carton${cartons === 1 ? '' : 's'}, ${loose} Pair${loose === 1 ? '' : 's'} (${total} Total)`;
}

/**
 * THAAN FABRIC — totalMeters (Float), standardSuitMeters (Float, default 4)
 *  - 99m left, 4m suit: "99 Meters (24 Full Suits + 3m Extra)"
 *  - < 1 suit left: cut-piece warning "Cut-Piece Left (3m)"
 */
export function formatThaanStock(totalMeters, standardSuitMeters = 4) {
  const total = Math.max(0, Number(totalMeters) || 0);
  const suit = Number(standardSuitMeters) > 0 ? Number(standardSuitMeters) : 4;
  const fullSuits = Math.floor(total / suit);
  const extra = +(total - fullSuits * suit).toFixed(2);
  const totalStr = +total.toFixed(2);
  if (total < suit) {
    return { text: `Cut-Piece Left (${totalStr}m)`, isCutPiece: true, fullSuits: 0, extraMeters: totalStr };
  }
  const extraStr = extra > 0 ? ` + ${extra}m Extra` : '';
  return {
    text: `${totalStr} Meters (${fullSuits} Full Suit${fullSuits === 1 ? '' : 's'}${extraStr})`,
    isCutPiece: false, fullSuits, extraMeters: extra,
  };
}

/**
 * READYMADE / KURTA — totalPieces (Int), piecesPerBox (nullable Int)
 *  - loose: "8 Pieces"
 *  - box 8, total 27: "3 Boxes, 3 Loose Pieces (27 Total)"
 */
export function formatKurtaStock(totalPieces, piecesPerBox) {
  const total = Math.max(0, Math.floor(Number(totalPieces) || 0));
  const ppb = Math.floor(Number(piecesPerBox) || 0);
  if (!ppb || ppb <= 1) return `${total} Piece${total === 1 ? '' : 's'}`;
  const boxes = Math.floor(total / ppb);
  const loose = total % ppb;
  if (boxes === 0) return `${total} Piece${total === 1 ? '' : 's'}`;
  if (loose === 0) return `${boxes} Box${boxes === 1 ? '' : 'es'} (${total} Pcs)`;
  return `${boxes} Box${boxes === 1 ? '' : 'es'}, ${loose} Loose Piece${loose === 1 ? '' : 's'} (${total} Total)`;
}

/**
 * PHARMACY — totalUnits (Int, smallest sellable unit)
 *  - SINGLE_UNIT: "50 Units / Packs"
 *  - TWO_LEVEL (Box -> Piece): "3 Boxes, 4 Pcs (64 Total)"
 *  - THREE_LEVEL (Box -> Strip -> Tab): "18 Boxes | 16 Strips | 6 Tabs (3766 Total)"
 */
export function formatPharmacyStock(totalUnits, sellingMode, stripsPerBox, unitsPerStrip) {
  const total = Math.max(0, Math.floor(Number(totalUnits) || 0));
  if (sellingMode === 'SINGLE_UNIT') return `${total} Unit${total === 1 ? '' : 's'} / Packs`;
  if (sellingMode === 'TWO_LEVEL') {
    const ppb = Math.floor(Number(unitsPerStrip) || 0);
    if (!ppb || ppb <= 1) return `${total} Piece${total === 1 ? '' : 's'}`;
    const boxes = Math.floor(total / ppb);
    const loose = total % ppb;
    if (boxes === 0) return `${loose} Piece${loose === 1 ? '' : 's'}`;
    if (loose === 0) return `${boxes} Box${boxes === 1 ? '' : 'es'} (${total} Pcs)`;
    return `${boxes} Box${boxes === 1 ? '' : 'es'}, ${loose} Pc${loose === 1 ? '' : 's'} (${total} Total)`;
  }
  // THREE_LEVEL
  const spb = Math.floor(Number(stripsPerBox) || 0);
  const ups = Math.floor(Number(unitsPerStrip) || 0);
  const unitsPerBox = spb * ups;
  if (!unitsPerBox || unitsPerBox <= 1) return `${total} Tab${total === 1 ? '' : 's'}`;
  const boxes = Math.floor(total / unitsPerBox);
  const remAfterBoxes = total % unitsPerBox;
  const strips = Math.floor(remAfterBoxes / ups);
  const looseTabs = remAfterBoxes % ups;
  return `${boxes} Box${boxes === 1 ? '' : 'es'} | ${strips} Strip${strips === 1 ? '' : 's'} | ${looseTabs} Tab${looseTabs === 1 ? '' : 's'} (${total} Total)`;
}

/**
 * GROCERY WEIGHT — totalGrams (Int), gramsPerSack (optional)
 *  - 49833g, sack 50000: "49 Kg, 833 g"
 *  - 125000g, sack 50000: "2 Sacks, 25 Kg, 0 g (125.000 Kg Total)"
 */
export function formatLooseWeightStock(totalGrams, gramsPerSack = 0) {
  const total = Math.max(0, Math.floor(Number(totalGrams) || 0));
  const totalKg = Math.floor(total / 1000);
  const remGrams = total % 1000;
  const baseStr = `${totalKg} Kg, ${remGrams} g`;
  const sack = Math.floor(Number(gramsPerSack) || 0);
  if (sack > 0 && total >= sack) {
    const sacks = Math.floor(total / sack);
    const looseKg = Math.floor((total % sack) / 1000);
    const totalKgStr = `${totalKg}.${String(remGrams).padStart(3, '0')}`;
    return `${sacks} Sack${sacks === 1 ? '' : 's'}, ${looseKg} Kg, ${remGrams} g (${totalKgStr} Kg Total)`;
  }
  return baseStr;
}

/**
 * Carton assortment auto-multiply (Shoes / Readymade):
 * ratio = { size: pairsPerCarton }, cartons = N, loose = { size: extraPairs }
 * Returns { size: totalPairs } — user ko manually multiply nahi karna parta.
 */
export function applyCartonAssortment(ratioBySize, numCartons, looseBySize = {}) {
  const result = {};
  const n = Math.max(0, Math.floor(Number(numCartons) || 0));
  const sizes = new Set([...Object.keys(ratioBySize || {}), ...Object.keys(looseBySize || {})]);
  sizes.forEach(size => {
    const ratio = Math.max(0, Math.floor(Number(ratioBySize[size]) || 0));
    const loose = Math.max(0, Math.floor(Number(looseBySize[size]) || 0));
    result[size] = ratio * n + loose;
  });
  return result;
}

/**
 * Thaan -> meters helper: suitsPerThaan * suitMeters * numThaans
 */
export function thaanToMeters(suitsPerThaan, suitMeters = 4, numThaans = 1) {
  const s = Math.max(0, Number(suitsPerThaan) || 0);
  const m = Number(suitMeters) > 0 ? Number(suitMeters) : 4;
  const t = Math.max(0, Number(numThaans) || 0);
  return +(s * m * t).toFixed(2);
}

/**
 * Reverse weight calculator ("50 rupay ki daal"):
 * amount Rs -> grams. Deduct exact grams from stock.
 */
export function amountToGrams(amountRs, pricePerKg) {
  const amt = Number(amountRs) || 0;
  const ppkg = Number(pricePerKg) || 0;
  if (amt <= 0 || ppkg <= 0) return 0;
  return Math.round((amt / ppkg) * 1000);
}

export function gramsToAmount(grams, pricePerKg) {
  const g = Number(grams) || 0;
  const ppkg = Number(pricePerKg) || 0;
  if (g <= 0 || ppkg <= 0) return 0;
  return +((g / 1000) * ppkg).toFixed(0);
}
