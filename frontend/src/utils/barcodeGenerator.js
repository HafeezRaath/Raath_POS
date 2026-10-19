// ============================================================
//  barcodeGenerator.js — Unified Thermal Barcode Print Engine
//  PRODUCTION-READY | Zero-Waste Multi-Column Roll Printing
//  Supports: 1, 2, or 3 Columns Per Row (TSC, Zebra, Xprinter, etc.)
//  Features: Standalone Offline Code128 SVG generator, exact micron sizing,
//            blank slot padding for zero sticker waste, partial row resume.
// ============================================================

// Standard Code 128 Character Patterns (B & C)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP)
];

/**
 * Generate 100% offline, standalone SVG barcode (Code 128 Auto).
 * Crisp vector lines that never pixelate on thermal printer heads.
 */
export const generateCode128Svg = (text, options = {}) => {
  if (!text) return '';
  const str = String(text).trim();
  const height = options.height || 40;
  const showText = options.showText !== false;
  const fontSize = options.fontSize || 10;

  try {
    const codes = [104]; // Start Code B
    let checksum = 104;

    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 32;
      const validCode = Math.max(0, Math.min(94, code));
      codes.push(validCode);
      checksum += validCode * (i + 1);
    }

    codes.push(checksum % 103);
    codes.push(106); // Stop Code

    const bars = [];
    let currentX = 0;

    for (const c of codes) {
      const pattern = CODE128_PATTERNS[c] || '212222';
      for (let p = 0; p < pattern.length; p++) {
        const w = parseInt(pattern[p], 10);
        if (p % 2 === 0) {
          bars.push({ x: currentX, width: w });
        }
        currentX += w;
      }
    }

    const quietZone = 10;
    const totalSvgWidth = currentX + (quietZone * 2);
    const barHeight = showText ? Math.max(18, height - 14) : height;
    const paths = bars.map(b => `M${b.x + quietZone},0 h${b.width} v${barHeight} h-${b.width} Z`).join(' ');

    return `
      <svg viewBox="0 0 ${totalSvgWidth} ${height}" preserveAspectRatio="none" style="width: 100%; height: ${height}px; display: block; overflow: visible;" xmlns="http://www.w3.org/2000/svg">
        <path d="${paths}" fill="#000000" />
        ${showText ? `
          <text x="${totalSvgWidth / 2}" y="${height - 2}" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="${fontSize}px" font-weight="bold" fill="#000000" letter-spacing="1px">
            ${str}
          </text>
        ` : ''}
      </svg>
    `.trim();
  } catch (err) {
    console.error('Code128 SVG generation error:', err);
    return `<div style="font-size: 10px; font-weight: bold; color: #000; text-align: center;">${str}</div>`;
  }
};

// Popular thermal label roll presets for 1, 2, and 3 column rolls
export const BARCODE_PRESETS = [
  // 1-Column Single Rolls
  { id: '50x30mm_1col', label: '50 x 30 mm (Single Roll - 1 Sticker / Row)', width: 50, height: 30, columns: 1, gap: 0 },
  { id: '50x25mm_1col', label: '50 x 25 mm (Single Roll - 1 Sticker / Row)', width: 50, height: 25, columns: 1, gap: 0 },
  { id: '40x25mm_1col', label: '40 x 25 mm (Single Roll - 1 Sticker / Row)', width: 40, height: 25, columns: 1, gap: 0 },
  
  // 2-Column (2-Up) Rolls (Very common on TSC / Xprinter / retail stores)
  { id: '38x25mm_2col', label: '38 x 25 mm (2 Stickers / Row - 80mm Roll)', width: 38, height: 25, columns: 2, gap: 2 },
  { id: '40x25mm_2col', label: '40 x 25 mm (2 Stickers / Row - 85mm Roll)', width: 40, height: 25, columns: 2, gap: 2 },
  { id: '38x28mm_2col', label: '38 x 28 mm (2 Stickers / Row - 80mm Roll)', width: 38, height: 28, columns: 2, gap: 2 },
  
  // 3-Column (3-Up) Rolls (Candela standard, TSC TTP-244 Pro, 100mm wide rolls)
  { id: '30x20mm_3col', label: '30 x 20 mm (3 Stickers / Row - Standard 100mm Roll)', width: 30, height: 20, columns: 3, gap: 2 },
  { id: '35x25mm_3col', label: '35 x 25 mm (3 Stickers / Row - 110mm Roll)', width: 35, height: 25, columns: 3, gap: 2 },
  { id: '38x25mm_3col', label: '38 x 25 mm (3 Stickers / Row - 120mm Roll)', width: 38, height: 25, columns: 3, gap: 2 },
  
  // Custom
  { id: 'custom', label: 'Custom Dimensions (Set Width, Height & Columns)', width: 38, height: 25, columns: 2, gap: 2 }
];

export const DEFAULT_BARCODE_SETTINGS = {
  printerName: '',
  labelPreset: '38x25mm_2col',
  labelWidth: 38,        // mm (single sticker width)
  labelHeight: 25,       // mm (single sticker height)
  columns: 2,            // 1, 2, or 3 stickers across per row
  gapMm: 2,              // horizontal gap between stickers in mm
  marginMm: 1.5,         // inner label padding in mm
  copies: 1,             // default copies to print
  startColumn: 1,        // start position: 1, 2, or 3 (for reusing partial rows)
  showShopName: true,
  shopName: '',
  showProductName: true,
  showPrice: true,
  currencySymbol: 'Rs.',
  showBarcode: true,
  showBarcodeText: true,
  showSku: false,
  barcodeType: 'CODE128',
  fontSize: 'medium'
};

/**
 * Retrieve saved barcode settings from localStorage with fallback
 */
export const getSavedBarcodeSettings = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('barcode_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_BARCODE_SETTINGS, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to parse barcode settings:', e);
  }
  return { ...DEFAULT_BARCODE_SETTINGS };
};

/**
 * Calculate multi-column roll layout metrics:
 * Total rows needed, number of blank slots, and waste prevention.
 */
export const calculateBarcodeLayout = (totalQuantity, columns = 1, startColumn = 1) => {
  const safeQty = Math.max(1, parseInt(totalQuantity, 10) || 1);
  const safeCols = Math.min(3, Math.max(1, parseInt(columns, 10) || 1));
  const safeStart = Math.min(safeCols, Math.max(1, parseInt(startColumn, 10) || 1));

  const leadingBlanks = safeStart - 1;
  const totalOccupiedCells = leadingBlanks + safeQty;
  const totalRows = Math.ceil(totalOccupiedCells / safeCols);
  const totalGridCells = totalRows * safeCols;
  const trailingBlanks = totalGridCells - totalOccupiedCells;

  return {
    quantity: safeQty,
    columns: safeCols,
    startColumn: safeStart,
    leadingBlanks,
    totalRows,
    totalGridCells,
    trailingBlanks,
    summaryText: `${safeQty} sticker${safeQty > 1 ? 's' : ''} on a ${safeCols}-column roll = ${totalRows} row${totalRows > 1 ? 's' : ''} ejected (${trailingBlanks} empty slot${trailingBlanks === 1 ? '' : 's'} on last row, 0 wasted rows)`
  };
};

/**
 * Build a single sticker's HTML content
 */
export const renderSingleLabelContent = (item, cfg) => {
  // QA-056: configured shop name — cfg, phir shop_profile, phir fallback
  let profileName = '';
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('shop_profile') : null;
    if (raw) { const sp = JSON.parse(raw); profileName = sp.name || sp.shop_name || ''; }
    if (!profileName && typeof localStorage !== 'undefined') profileName = localStorage.getItem('raath_shop_name') || '';
  } catch {}
  const shopName = cfg.shopName || profileName || 'MY STORE';
  const productName = item.product_name || item.name || 'Product';
  const rawPrice = item.retail_price !== undefined ? item.retail_price : (item.price || 0);
  const formattedPrice = Number(rawPrice).toLocaleString();
  const barcodeValue = item.barcode || '00000000';
  const sku = item.sku || '';

  const labelHeight = cfg.labelHeight || 25;
  const paddingMm = cfg.marginMm !== undefined ? cfg.marginMm : 1.5;

  // Calculate proportional barcode height inside label
  const barcodeHeight = Math.max(18, Math.min(36, Math.round(labelHeight * 0.42)));
  const svgHtml = generateCode128Svg(barcodeValue, {
    height: barcodeHeight,
    showText: cfg.showBarcodeText,
    fontSize: 9
  });

  return `
    <div class="barcode-sticker" style="
      width: ${cfg.labelWidth}mm;
      height: ${cfg.labelHeight}mm;
      padding: ${paddingMm}mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      background: #ffffff;
      color: #000000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    ">
      ${cfg.showShopName ? `
        <div style="font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${shopName}
        </div>
      ` : ''}

      ${cfg.showProductName ? `
        <div style="font-size: 8.5px; font-weight: 700; line-height: 1.1; max-height: 20px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin: 1px 0;">
          ${productName}
        </div>
      ` : ''}

      ${cfg.showBarcode ? `
        <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin: 1px 0;">
          ${svgHtml}
        </div>
      ` : ''}

      <div style="width: 100%; display: flex; justify-content: space-between; align-items: baseline; margin-top: 1px;">
        ${cfg.showPrice ? `
          <div style="font-size: 11px; font-weight: 900; color: #000000; line-height: 1; margin: 0 auto;">
            <span style="font-size: 8px; font-weight: 600;">${cfg.currencySymbol || 'Rs.'}</span> ${formattedPrice}
          </div>
        ` : '<div></div>'}

        ${cfg.showSku && sku ? `
          <div style="font-size: 6.5px; font-family: monospace; color: #333333; line-height: 1;">
            ${sku}
          </div>
        ` : ''}
      </div>
    </div>
  `.trim();
};

/**
 * Generate full HTML document for thermal barcode printing.
 * Perfectly formats rows with exact @page dimensions matching total roll width.
 * Pads last row with blank cells so no extra pages or paper are wasted!
 */
export const generateBarcodePrintHtml = (itemsList, customOptions = {}) => {
  const saved = getSavedBarcodeSettings();
  const cfg = {
    ...saved,
    ...customOptions
  };

  const columns = Math.min(3, Math.max(1, cfg.columns || 1));
  const labelWidth = cfg.labelWidth || 38;
  const labelHeight = cfg.labelHeight || 25;
  const gapMm = columns > 1 ? (cfg.gapMm !== undefined ? cfg.gapMm : 2) : 0;
  const startColumn = Math.min(columns, Math.max(1, cfg.startColumn || 1));

  // Calculate total roll width (all columns across + gaps)
  // For TSC printers, pageSize width MUST cover the entire physical label roll liner
  const rollWidthMm = (labelWidth * columns) + (gapMm * (columns - 1));

  // Flatten items into a single list of labels according to quantity
  const labelsToPrint = [];
  if (Array.isArray(itemsList)) {
    for (const it of itemsList) {
      const q = Math.max(1, it.quantity || 1);
      for (let i = 0; i < q; i++) {
        labelsToPrint.push(it);
      }
    }
  } else if (itemsList && typeof itemsList === 'object') {
    const q = Math.max(1, cfg.copies || cfg.quantity || 1);
    for (let i = 0; i < q; i++) {
      labelsToPrint.push(itemsList);
    }
  }

  const totalQuantity = labelsToPrint.length;
  const layout = calculateBarcodeLayout(totalQuantity, columns, startColumn);
  const totalRows = layout.totalRows;

  // Build grid cells: leading blanks + real labels + trailing blanks
  const allCells = [];

  // 1. Leading blanks (if user starts from column 2 or 3)
  for (let b = 0; b < layout.leadingBlanks; b++) {
    allCells.push({ isBlank: true });
  }

  // 2. Real labels
  for (let i = 0; i < totalQuantity; i++) {
    allCells.push({ isBlank: false, item: labelsToPrint[i] });
  }

  // 3. Trailing blanks (to complete the last row without extra feed)
  for (let t = 0; t < layout.trailingBlanks; t++) {
    allCells.push({ isBlank: true });
  }

  // Build row HTML elements
  const rowsHtmlList = [];
  for (let r = 0; r < totalRows; r++) {
    const isLastRow = r === totalRows - 1;
    const rowCells = allCells.slice(r * columns, (r + 1) * columns);

    const cellsHtml = rowCells.map(cell => {
      if (cell.isBlank) {
        return `
          <div class="barcode-sticker blank-slot" style="
            width: ${labelWidth}mm;
            height: ${labelHeight}mm;
            visibility: hidden;
            box-sizing: border-box;
          "></div>
        `;
      }
      return renderSingleLabelContent(cell.item, cfg);
    }).join('');

    rowsHtmlList.push(`
      <div class="barcode-row" style="
        width: ${rollWidthMm}mm;
        height: ${labelHeight}mm;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;
        overflow: hidden;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        ${!isLastRow ? 'page-break-after: always !important; break-after: page !important;' : 'page-break-after: avoid !important; break-after: avoid !important;'}
      ">
        ${cellsHtml}
      </div>
    `);
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Barcode Print (${totalQuantity} Labels)</title>
      <style>
        @page {
          size: ${rollWidthMm}mm ${labelHeight}mm;
          margin: 0mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          width: ${rollWidthMm}mm;
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }
        .print-container {
          width: ${rollWidthMm}mm;
          margin: 0;
          padding: 0;
        }
        .barcode-row {
          width: ${rollWidthMm}mm;
          height: ${labelHeight}mm;
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          box-sizing: border-box;
          overflow: hidden;
        }
        .barcode-sticker {
          width: ${labelWidth}mm;
          height: ${labelHeight}mm;
          box-sizing: border-box;
          overflow: hidden;
          background: #fff;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${rollWidthMm}mm !important;
          }
          .barcode-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .barcode-row:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          .barcode-row:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        ${rowsHtmlList.join('')}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `.trim();

  return {
    html: fullHtml,
    pageSize: {
      width: Math.round(rollWidthMm * 1000), // microns for Electron
      height: Math.round(labelHeight * 1000) // microns for Electron
    },
    rollWidthMm,
    labelHeight,
    totalRows,
    totalQuantity,
    columns
  };
};

/**
 * Execute Barcode Print Job:
 * Tries Electron hardware print first (silent, direct to TSC/Zebra/etc),
 * otherwise falls back seamlessly to browser print popup.
 */
export const printBarcodeJob = async (itemsList, customOptions = {}) => {
  const result = generateBarcodePrintHtml(itemsList, customOptions);
  const cfg = { ...getSavedBarcodeSettings(), ...customOptions };
  const printerName = cfg.printerName || '';

  // 1. Try Electron direct silent print
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.printReceipt) {
    try {
      const printResponse = await window.electronAPI.printReceipt(result.html, {
        printerName: printerName || undefined,
        pageSize: result.pageSize,
        silent: true,
        copies: 1
      });
      return {
        success: printResponse?.success !== false,
        totalRows: result.totalRows,
        totalQuantity: result.totalQuantity,
        printerName: printerName || 'Default System Printer',
        mode: 'electron'
      };
    } catch (err) {
      console.warn('Electron direct print failed, falling back to browser window:', err);
    }
  }

  // 2. Browser fallback print dialog
  if (typeof window !== 'undefined') {
    const winWidth = Math.max(380, Math.round(result.rollWidthMm * 3.8));
    const winHeight = Math.max(450, Math.round(result.labelHeight * 4.5 * Math.min(3, result.totalRows)));
    const printWindow = window.open('', '_blank', `width=${winWidth},height=${winHeight}`);
    if (!printWindow) {
      throw new Error('Popup blocked! Please allow popups in your browser to print barcodes.');
    }
    printWindow.document.write(result.html);
    printWindow.document.close();
    return {
      success: true,
      totalRows: result.totalRows,
      totalQuantity: result.totalQuantity,
      printerName: 'Browser Print Dialog',
      mode: 'browser'
    };
  }

  return { success: false, reason: 'No print environment available' };
};
