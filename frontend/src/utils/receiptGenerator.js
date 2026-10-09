// ============================================================
//  receiptGenerator.js — Unified Thermal Receipt Engine
//  PRODUCTION-READY | 100% Monochrome Thermal Printer Friendly
//  Supports: POS Sales, Repair Work Orders, Payments, Returns, Test Prints
//  Designs: Design 1 (Classic), Design 2 (Modern), Design 3 (Premium), Design 4 (Imtiaz Supermarket)
// ============================================================

export const DEFAULT_RECEIPT_SETTINGS = {
  printerName: '',
  showLogo: true,
  showBarcode: true,
  showQR: false,
  printCustomerName: true,
  printCustomerPhone: true,
  printTaxBreakdown: true,
  paperSize: '80mm',
  customWidthMm: 80,
  paddingMm: 2,
  copies: 1,
  autoPrint: false,
  headerText: '',
  footerText: 'Thank you for visiting us!\nReturns accepted within 7 days with receipt.',
  fontSize: 'medium',
  showDiscountDetails: true,
  showEmployeeName: true,
  design: 'design1',
  marginLeft: 2,
  marginRight: 2,
  marginTop: 2,
  marginBottom: 6,
  feedLines: 2
};

export const DEFAULT_SHOP_PROFILE = {
  name: 'MY STORE',
  tagline: 'Quality Products, Best Prices',
  address: 'Main Market, Lahore',
  city: 'Lahore',
  phone: '0349-3860656',
  email: '',
  website: '',
  taxNumber: '',
  registrationNumber: '',
  logo: null,
  logoPreview: null,
  receiptFooter: 'Thank you for visiting us!\nReturns accepted within 7 days with receipt.'
};

/**
 * Get current saved receipt settings from localStorage with safe fallback
 */
export const getEffectiveReceiptSettings = () => {
  try {
    const raw = localStorage.getItem('receipt_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const design = parsed.design || localStorage.getItem('receipt_design') || 'design1';
      return { ...DEFAULT_RECEIPT_SETTINGS, ...parsed, design };
    }
  } catch (e) {}
  const localDesign = localStorage.getItem('receipt_design');
  return { ...DEFAULT_RECEIPT_SETTINGS, design: localDesign || 'design1' };
};

/**
 * Get current saved shop profile from localStorage with safe fallback
 */
export const getEffectiveShopProfile = () => {
  try {
    const raw = localStorage.getItem('shop_profile');
    if (raw) {
      return { ...DEFAULT_SHOP_PROFILE, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return { ...DEFAULT_SHOP_PROFILE };
};

/**
 * Format currency
 */
export const formatMoney = (val, symbol = 'Rs.') => {
  const num = Number(val) || 0;
  return `${symbol} ${num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date & time nicely
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) {
    const d = new Date();
    return {
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  }
  const d = new Date(dateVal);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
};

/**
 * Calculate dimensions and fonts based on settings
 * Printable width is carefully calibrated for thermal print heads:
 * 80mm roll -> 70mm printable head (prevents right-edge truncation)
 * 58mm roll -> 46mm printable head
 */
export const getThermalDimensions = (settings = {}) => {
  const cfg = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  
  let paperWidthMm = 80;
  let printableWidthMm = 70; // 70mm safe printable width for 80mm thermal printers (prevents right-edge truncation)

  if (cfg.paperSize === '58mm') {
    paperWidthMm = 58;
    printableWidthMm = 46; // 46mm safe printable width for 58mm thermal printers
  } else if (cfg.paperSize === 'custom') {
    paperWidthMm = parseFloat(cfg.customWidthMm) || 80;
    printableWidthMm = Math.max(38, paperWidthMm - 8);
  } else if (cfg.paperSize === 'A4') {
    paperWidthMm = 210;
    printableWidthMm = 190;
  } else if (cfg.paperSize === 'A5') {
    paperWidthMm = 148;
    printableWidthMm = 135;
  }

  const marginLeft = Math.max(0, parseFloat(cfg.marginLeft !== undefined ? cfg.marginLeft : 1));
  const marginRight = Math.max(0, parseFloat(cfg.marginRight !== undefined ? cfg.marginRight : 1));
  const marginTop = Math.max(0, parseFloat(cfg.marginTop !== undefined ? cfg.marginTop : 1));
  const marginBottom = Math.max(0, parseFloat(cfg.marginBottom !== undefined ? cfg.marginBottom : 4));
  const paddingMm = Math.max(0, parseFloat(cfg.paddingMm !== undefined ? cfg.paddingMm : 1));
  const feedLines = Math.max(0, parseInt(cfg.feedLines !== undefined ? cfg.feedLines : 2, 10));

  // High-contrast, bold, thermal-optimized font sizes
  let fontSizePx = 12.5;
  let titleSizePx = 19;
  let headerSizePx = 14.5;
  let smallSizePx = 10.5;

  if (cfg.fontSize === 'small') {
    fontSizePx = 11;
    titleSizePx = 16;
    headerSizePx = 12.5;
    smallSizePx = 9.5;
  } else if (cfg.fontSize === 'large') {
    fontSizePx = 14.5;
    titleSizePx = 22;
    headerSizePx = 16.5;
    smallSizePx = 12;
  }

  return {
    paperWidthMm,
    printableWidthMm,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    paddingMm,
    feedLines,
    fontSizePx,
    titleSizePx,
    headerSizePx,
    smallSizePx
  };
};

/**
 * Generate full, print-ready HTML for thermal receipt
 */
export const generateReceiptHTML = (data = {}, options = {}) => {
  const receiptSettings = { ...getEffectiveReceiptSettings(), ...(options.receiptSettings || {}) };
  const shop = { ...getEffectiveShopProfile(), ...(options.shopProfile || {}) };
  const design = options.design || receiptSettings.design || 'design1';
  const dims = getThermalDimensions(receiptSettings);

  const sale = data.sale || data.order || data.record || {};
  const items = data.items || sale.items || [];
  const serviceDetails = data.serviceDetails || null;
  const isService = Boolean(serviceDetails || data.type === 'service');

  const dt = formatDateTime(sale.date || sale.created_at);
  const invoiceNo = sale.invoice_no || sale.invoiceNo || sale.id || `INV-${Date.now().toString().slice(-6)}`;
  const partyName = sale.customer_name || sale.party?.name || (isService ? serviceDetails?.customer_name : null) || 'Walk-in Customer';
  const partyPhone = sale.customer_phone || sale.party?.phone || (isService ? serviceDetails?.customer_phone : null) || '';
  const partyNtn = sale.customer_ntn || sale.party?.ntn || '';

  const totalItems = items.length;
  const totalQty = items.reduce((s, i) => s + Number(i.qty || i.quantity || 1), 0);
  const subtotal = Number(sale.subtotal || sale.total_cost || items.reduce((s, i) => s + (Number(i.price || i.cost || 0) * Number(i.qty || i.quantity || 1)), 0));
  const discount = Number(sale.discount || sale.item_discount || 0);
  const tax = Number(sale.tax || sale.fbr_tax_amount || 0);
  const taxRate = Number(sale.taxRate || sale.fbr_tax_rate || 0);
  const grandTotal = Number(sale.grand_total || sale.grandTotal || sale.total_cost || subtotal - discount + tax);
  const paid = Number(sale.paid_amount || sale.paid || sale.advance_amount || grandTotal);
  const due = Math.max(0, Number(sale.due_amount || sale.due || (grandTotal - paid)));
  const change = Math.max(0, Number(sale.change_amount || sale.change || (paid - grandTotal)));
  const paymentMode = (sale.payment_mode || sale.payment_status || 'CASH').toUpperCase();

  const effectiveFooter = receiptSettings.footerText || shop.receiptFooter || 'Thank you for visiting us!\nReturns accepted within 7 days with receipt.';

  // FBR QR code or standard QR
  const fbrRef = sale.fbr_reference || (sale.dummy_fbr_reference || null);
  const isFBR = Boolean(sale.fbr_enabled || sale.fbr_mode);
  const qrUrl = receiptSettings.showQR || fbrRef
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(fbrRef || invoiceNo)}`
    : null;

  // Base thermal typography & layout styles - 100% High-Contrast Bold Thermal
  const baseThermalCSS = `
    @page {
      size: ${dims.paperWidthMm}mm auto;
      margin: ${dims.marginTop}mm ${dims.marginRight}mm ${dims.marginBottom}mm ${dims.marginLeft}mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      width: ${dims.printableWidthMm}mm;
      max-width: ${dims.printableWidthMm}mm;
      margin: 0 auto;
      padding: ${dims.paddingMm}mm 1mm;
      font-family: 'Carlito', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: ${dims.fontSizePx}px;
      font-weight: 600;
      line-height: 1.3;
      color: #000000;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .receipt-container {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      margin: 0 auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${dims.fontSizePx}px;
      font-weight: 600;
    }
    th, td {
      padding: 2px 1px;
      word-break: break-word;
      overflow: hidden;
      color: #000000 !important;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: 700 !important; }
    .bolder { font-weight: 800 !important; }
    .d-flex { display: flex; justify-content: space-between; align-items: flex-start; }
    .dashed-line { border-top: 1.5px dashed #000000; margin: 4px 0; }
    .solid-line { border-top: 1.5px solid #000000; margin: 4px 0; }
    .double-line { border-top: 2.5px double #000000; margin: 4px 0; }
    .store-logo { max-width: 52px; max-height: 52px; object-fit: contain; margin: 0 auto 3px auto; display: block; filter: grayscale(100%) contrast(250%); }
    .qr-image { width: 70px; height: 70px; margin: 5px auto; display: block; filter: grayscale(100%) contrast(300%); }
    .barcode-svg { max-width: 92%; height: 28px; margin: 3px auto; display: block; }
    @media print {
      body { padding: 0 1mm; width: ${dims.printableWidthMm}mm; }
      .no-print { display: none !important; }
    }
  `;

  // Item rows HTML builder
  const buildItemsHTML = (styleType) => {
    if (isService && serviceDetails) {
      const parts = serviceDetails.parts_used || [];
      const serviceFee = Number(serviceDetails.service_fee || (grandTotal - parts.reduce((s, p) => s + (p.cost * p.quantity), 0))) || 0;
      return `
        <div style="margin: 4px 0;">
          <table>
            <thead>
              <tr style="border-bottom: 1.5px solid #000; ${styleType === 'design3' ? 'background: #000; color: #fff;' : ''}">
                <th class="text-left" style="width: 55%; font-weight: 700; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Job / Part</th>
                <th class="text-center" style="width: 15%; font-weight: 700; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Qty</th>
                <th class="text-right" style="width: 30%; font-weight: 700; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px dashed #000;">
                <td class="bold">Labor: ${serviceDetails.service_name || 'Repair'}</td>
                <td class="text-center bold">1</td>
                <td class="text-right bold">${formatMoney(serviceFee)}</td>
              </tr>
              ${parts.map(p => `
                <tr style="border-bottom: 1px dashed #000;">
                  <td style="font-weight: 600;">${p.name || 'Part'}</td>
                  <td class="text-center" style="font-weight: 600;">${p.quantity || 1}</td>
                  <td class="text-right bold">${formatMoney((p.cost || 0) * (p.quantity || 1))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (styleType === 'design4') {
      // Supermarket / Imtiaz Detailed Layout
      return `
        <div style="margin: 4px 0;">
          <table style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;">
            <thead>
              <tr style="font-weight: 700;">
                <th class="text-left" style="width: 42%;">Item</th>
                <th class="text-center" style="width: 14%;">Qty</th>
                <th class="text-right" style="width: 22%;">Price</th>
                <th class="text-right" style="width: 22%;">Total</th>
              </tr>
            </thead>
          </table>
          <div style="margin-top: 2px;">
            ${items.map((it) => {
              const name = it.name || it.product_name || 'Item';
              const qty = Number(it.qty || it.quantity || 1);
              const price = Number(it.price || it.retail_price || 0);
              const total = Number(it.total || qty * price);
              const disc = Number(it.discount || 0);
              return `
                <div style="padding: 2px 0; border-bottom: 1px dashed #000;">
                  <div class="bold" style="font-size: ${dims.fontSizePx}px;">${name}</div>
                  <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
                    <span>Qty: ${qty} @ ${price.toFixed(0)}${disc > 0 ? ` (-${disc}%)` : ''}</span>
                    <span class="bold">${total.toFixed(0)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Standard 4-column item table (Design 1, 2, 3)
    return `
      <div style="margin: 4px 0;">
        <table>
          <thead>
            <tr style="border-bottom: 1.5px solid #000; ${styleType === 'design3' ? 'background: #000; color: #fff; font-weight: 700;' : 'font-weight: 700;'}">
              <th class="text-left" style="width: 44%; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Item</th>
              <th class="text-center" style="width: 14%; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Qty</th>
              <th class="text-right" style="width: 21%; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Price</th>
              <th class="text-right" style="width: 21%; ${styleType === 'design3' ? 'color: #fff !important;' : ''}">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it) => {
              const name = it.name || it.product_name || 'Item';
              const sku = it.sku || '';
              const qty = Number(it.qty || it.quantity || 1);
              const price = Number(it.price || 0);
              const total = Number(it.total || qty * price);
              return `
                <tr style="border-bottom: 1px dashed #000;">
                  <td class="text-left">
                    <div class="bold" style="font-size: ${dims.fontSizePx}px;">${name}</div>
                    ${sku ? `<div style="font-size: ${dims.smallSizePx}px; font-weight: 600;">${sku}</div>` : ''}
                  </td>
                  <td class="text-center bold" style="font-size: ${dims.fontSizePx}px;">${qty}</td>
                  <td class="text-right" style="font-weight: 600;">${price.toFixed(0)}</td>
                  <td class="text-right bold" style="font-size: ${dims.fontSizePx}px;">${total.toFixed(0)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Header content helper
  const renderHeader = (subtitle = '') => `
    <div class="text-center" style="margin-bottom: 4px;">
      ${receiptSettings.showLogo && (shop.logo || shop.logoPreview) ? `<img src="${shop.logo || shop.logoPreview}" class="store-logo" alt="Logo" />` : ''}
      <div class="bolder" style="font-size: ${dims.titleSizePx}px; letter-spacing: 0.5px; text-transform: uppercase;">
        ${shop.name || 'MY STORE'}
      </div>
      ${shop.tagline ? `<div style="font-size: ${dims.smallSizePx}px; font-weight: 600;">${shop.tagline}</div>` : ''}
      <div style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
        ${shop.address ? `<span>${shop.address}</span> ` : ''}
        ${shop.phone ? `<span>| Tel: ${shop.phone}</span>` : ''}
      </div>
      ${shop.taxNumber ? `<div style="font-size: ${dims.smallSizePx}px; font-weight: 600;">NTN: ${shop.taxNumber}</div>` : ''}
      ${receiptSettings.headerText ? `<div style="font-size: ${dims.smallSizePx}px; font-weight: 600; font-style: italic; margin-top: 2px;">${receiptSettings.headerText}</div>` : ''}
      ${subtitle ? `<div class="bold" style="margin-top: 2px; font-size: ${dims.headerSizePx}px; letter-spacing: 1px;">${subtitle}</div>` : ''}
    </div>
  `;

  // Summary Totals block helper
  const renderTotals = (styleType) => `
    <div style="margin-top: 4px;">
      <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
        <span>Total Items: ${totalItems}</span>
        <span>Total Qty: ${totalQty}</span>
      </div>
      ${receiptSettings.showDiscountDetails && discount > 0 ? `
        <div class="d-flex" style="font-weight: 600;">
          <span>Sub Total</span>
          <span>${formatMoney(subtotal)}</span>
        </div>
        <div class="d-flex bold">
          <span>Discount</span>
          <span>-${formatMoney(discount)}</span>
        </div>
      ` : `
        <div class="d-flex" style="font-weight: 600;">
          <span>Sub Total</span>
          <span>${formatMoney(subtotal)}</span>
        </div>
      `}
      ${receiptSettings.printTaxBreakdown && tax > 0 ? `
        <div class="d-flex" style="font-weight: 600;">
          <span>Tax (${taxRate > 0 ? `${taxRate}%` : 'GST'})</span>
          <span>${formatMoney(tax)}</span>
        </div>
      ` : ''}

      ${/* GRAND TOTAL STYLING BASED ON DESIGN */ ''}
      ${styleType === 'design3' ? `
        <div style="background: #000 !important; color: #fff !important; padding: 5px 8px; margin: 4px 0; display: flex; justify-content: space-between; font-size: ${dims.headerSizePx + 2}px; font-weight: 800 !important;">
          <span style="color: #fff !important;">GRAND TOTAL</span>
          <span style="color: #fff !important;">${formatMoney(grandTotal)}</span>
        </div>
      ` : styleType === 'design2' ? `
        <div style="border: 1.5px solid #000; padding: 4px 6px; margin: 4px 0; display: flex; justify-content: space-between; font-size: ${dims.headerSizePx + 1}px; font-weight: 800;">
          <span>TOTAL</span>
          <span>${formatMoney(grandTotal)}</span>
        </div>
      ` : styleType === 'design4' ? `
        <div class="double-line"></div>
        <div class="d-flex bolder" style="font-size: ${dims.headerSizePx + 2}px; padding: 2px 0;">
          <span>NET TOTAL</span>
          <span>${formatMoney(grandTotal)}</span>
        </div>
        <div class="double-line"></div>
      ` : `
        <div class="solid-line"></div>
        <div class="d-flex bolder" style="font-size: ${dims.headerSizePx + 2}px; padding: 2px 0;">
          <span>TOTAL</span>
          <span>${formatMoney(grandTotal)}</span>
        </div>
        <div class="solid-line"></div>
      `}

      <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
        <span>Paid (${paymentMode}):</span>
        <span class="bold" style="font-size: ${dims.fontSizePx}px;">${formatMoney(paid)}</span>
      </div>
      ${due > 0 ? `
        <div class="d-flex bold" style="font-size: ${dims.fontSizePx}px; font-weight: 800;">
          <span>Balance Due:</span>
          <span>${formatMoney(due)}</span>
        </div>
      ` : ''}
      ${change > 0 ? `
        <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
          <span>Change:</span>
          <span>${formatMoney(change)}</span>
        </div>
      ` : ''}
    </div>
  `;

  // Footer block helper
  const renderFooter = () => `
    <div class="text-center" style="margin-top: 6px; padding-top: 4px; border-top: 1.5px dashed #000;">
      <div class="bold" style="font-size: ${dims.headerSizePx}px; font-weight: 800; text-transform: uppercase;">THANK YOU!</div>
      <div style="font-size: ${dims.smallSizePx}px; font-weight: 600; white-space: pre-line; margin-top: 2px;">
        ${effectiveFooter}
      </div>
      ${qrUrl ? `<img src="${qrUrl}" class="qr-image" alt="QR" />` : ''}
      ${isFBR ? `<div style="font-size: 9px; font-weight: 800; margin-top: 2px;">*** FBR VERIFIED DIGITAL INVOICE ***</div>` : ''}
    </div>
    ${/* Physical thermal cutter blank feed lines */ ''}
    ${Array.from({ length: dims.feedLines }).map(() => '<div style="height: 10px; line-height: 10px;">&nbsp;</div>').join('')}
  `;

  // ==================== DESIGN 1: CLASSIC THERMAL ====================
  const renderDesign1Content = () => `
    <div class="receipt-container">
      ${renderHeader()}
      <div class="dashed-line"></div>
      <div class="d-flex" style="font-size: ${dims.smallSizePx}px;">
        <span><strong>Inv:</strong> ${invoiceNo}</span>
        <span>${dt.date} ${dt.time}</span>
      </div>
      ${receiptSettings.printCustomerName && partyName ? `
        <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
          <span><strong>Customer:</strong> ${partyName}</span>
          ${receiptSettings.printCustomerPhone && partyPhone ? `<span>${partyPhone}</span>` : ''}
        </div>
      ` : ''}
      ${isService && serviceDetails ? `
        <div style="font-size: ${dims.smallSizePx}px; font-weight: 600; padding: 2px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 3px 0;">
          <div><strong>Device:</strong> ${serviceDetails.device_model || 'N/A'} ${serviceDetails.imei ? `(IMEI: ${serviceDetails.imei})` : ''}</div>
          ${serviceDetails.problem_description ? `<div><strong>Problem:</strong> ${serviceDetails.problem_description}</div>` : ''}
        </div>
      ` : ''}
      <div class="dashed-line"></div>
      ${buildItemsHTML('design1')}
      ${renderTotals('design1')}
      ${renderFooter()}
    </div>
  `;

  // ==================== DESIGN 2: MODERN MINIMALIST ====================
  const renderDesign2Content = () => `
    <div class="receipt-container">
      ${renderHeader()}
      <div style="border: 1.5px solid #000; padding: 4px 6px; margin: 4px 0; font-size: ${dims.smallSizePx}px;">
        <div class="d-flex" style="font-weight: 700;">
          <span>INVOICE: ${invoiceNo}</span>
          <span>${dt.date}</span>
        </div>
        ${receiptSettings.printCustomerName && partyName ? `
          <div class="d-flex" style="margin-top: 2px; font-weight: 600;">
            <span>BILL TO: ${partyName}</span>
            ${receiptSettings.printCustomerPhone && partyPhone ? `<span>${partyPhone}</span>` : ''}
          </div>
        ` : ''}
        ${isService && serviceDetails ? `
          <div style="margin-top: 2px; border-top: 1px dashed #000; padding-top: 2px; font-weight: 600;">
            <div>DEVICE: ${serviceDetails.device_model || 'N/A'}</div>
            ${serviceDetails.problem_description ? `<div>FAULT: ${serviceDetails.problem_description}</div>` : ''}
          </div>
        ` : ''}
      </div>
      ${buildItemsHTML('design2')}
      ${renderTotals('design2')}
      ${renderFooter()}
    </div>
  `;

  // ==================== DESIGN 3: BOLD / PREMIUM THERMAL ====================
  const renderDesign3Content = () => `
    <div class="receipt-container">
      <div style="border: 1.5px solid #000; padding: 2px;">
        <div style="background: #000 !important; color: #fff !important; padding: 5px; text-align: center;">
          <div class="bolder" style="font-size: ${dims.titleSizePx}px; text-transform: uppercase; letter-spacing: 1px; color: #fff !important;">
            ${shop.name || 'MY STORE'}
          </div>
          ${shop.tagline ? `<div style="font-size: ${dims.smallSizePx}px; font-weight: 600; color: #fff !important;">${shop.tagline}</div>` : ''}
        </div>
        <div class="text-center" style="font-size: ${dims.smallSizePx}px; font-weight: 600; padding: 3px 0;">
          ${shop.address ? `<span>${shop.address}</span> ` : ''}
          ${shop.phone ? `<span>| Tel: ${shop.phone}</span>` : ''}
          ${receiptSettings.headerText ? `<div style="font-style: italic;">${receiptSettings.headerText}</div>` : ''}
        </div>
      </div>

      <div class="d-flex bold" style="margin: 4px 0; font-size: ${dims.smallSizePx}px; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
        <span># ${invoiceNo}</span>
        <span>${dt.date} ${dt.time}</span>
      </div>
      ${receiptSettings.printCustomerName && partyName ? `
        <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600; margin-bottom: 3px;">
          <span><strong>Client:</strong> ${partyName}</span>
          ${receiptSettings.printCustomerPhone && partyPhone ? `<span>${partyPhone}</span>` : ''}
        </div>
      ` : ''}
      ${isService && serviceDetails ? `
        <div style="border: 1.5px solid #000; padding: 3px 5px; font-size: ${dims.smallSizePx}px; font-weight: 600; margin-bottom: 3px;">
          <div><strong>Repair Item:</strong> ${serviceDetails.device_model || 'N/A'}</div>
          ${serviceDetails.imei ? `<div><strong>IMEI / Serial:</strong> ${serviceDetails.imei}</div>` : ''}
          ${serviceDetails.problem_description ? `<div><strong>Fault:</strong> ${serviceDetails.problem_description}</div>` : ''}
        </div>
      ` : ''}

      ${buildItemsHTML('design3')}
      ${renderTotals('design3')}
      ${renderFooter()}
    </div>
  `;

  // ==================== DESIGN 4: SUPERMARKET / IMTIAZ STYLE ====================
  const renderDesign4Content = () => `
    <div class="receipt-container">
      ${renderHeader('*** CASH MEMO ***')}
      <div class="dashed-line"></div>
      <div class="d-flex bold" style="font-size: ${dims.smallSizePx}px;">
        <span>Trans: ${invoiceNo}</span>
        <span>${dt.date}</span>
      </div>
      ${receiptSettings.printCustomerName && partyName ? `
        <div class="d-flex" style="font-size: ${dims.smallSizePx}px; font-weight: 600;">
          <span>Cust: ${partyName}</span>
          ${receiptSettings.printCustomerPhone && partyPhone ? `<span>${partyPhone}</span>` : ''}
        </div>
      ` : ''}
      ${isService && serviceDetails ? `
        <div style="font-size: ${dims.smallSizePx}px; border: 1px dashed #000; padding: 2px 4px; margin: 2px 0;">
          <div>Device: ${serviceDetails.device_model || 'N/A'} (IMEI: ${serviceDetails.imei || 'N/A'})</div>
          ${serviceDetails.problem_description ? `<div>Fault: ${serviceDetails.problem_description}</div>` : ''}
        </div>
      ` : ''}
      <div class="dashed-line"></div>
      ${buildItemsHTML('design4')}
      ${renderTotals('design4')}
      ${renderFooter()}
    </div>
  `;

  let contentHTML = renderDesign1Content();
  if (design === 'design2') contentHTML = renderDesign2Content();
  else if (design === 'design3') contentHTML = renderDesign3Content();
  else if (design === 'design4') contentHTML = renderDesign4Content();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Receipt ${invoiceNo}</title>
      <style>
        ${baseThermalCSS}
      </style>
    </head>
    <body>
      ${contentHTML}
    </body>
    </html>
  `;
};

/**
 * Universal Print Function:
 * Tries direct Electron IPC print first with accurate micron page size.
 * Falls back to browser print dialog gracefully.
 */
export const printReceiptDirect = async (data = {}, options = {}) => {
  const receiptSettings = { ...getEffectiveReceiptSettings(), ...(options.receiptSettings || {}) };
  const targetPrinter = options.printerName || receiptSettings.printerName || '';
  const html = generateReceiptHTML(data, options);

  // Electron Direct Printing
  if (window.electronAPI && typeof window.electronAPI.printReceipt === 'function') {
    try {
      console.log(`[ThermalPrint] Printing to Electron printer: "${targetPrinter || 'Default'}"`);
      const res = await window.electronAPI.printReceipt(html, {
        printerName: targetPrinter || undefined,
        pageSize: receiptSettings.paperSize || '80mm',
        copies: receiptSettings.copies || 1,
        silent: true
      });
      return { success: true, method: 'electron', res };
    } catch (err) {
      console.warn('Electron direct print failed, falling back to browser print:', err);
    }
  }

  // Fallback: Browser Popup Print
  try {
    const paperW = receiptSettings.paperSize === '58mm' ? 320 : 420;
    const printWindow = window.open('', '_blank', `width=${paperW},height=600,scrollbars=yes,status=no`);
    if (!printWindow) {
      throw new Error('Popup blocked! Please allow popups for printing receipts.');
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          setTimeout(() => {
            try { printWindow.close(); } catch (e) {}
          }, 800);
          resolve({ success: true, method: 'browser' });
        } catch (printErr) {
          resolve({ success: false, method: 'browser', error: printErr.message });
        }
      }, 400);
    });
  } catch (fallbackErr) {
    console.error('Browser print error:', fallbackErr);
    return { success: false, method: 'none', error: fallbackErr.message };
  }
};

/**
 * Checks if a string is a raw hash ID or UUID
 */
export const isHashId = (val) => {
  if (!val) return false;
  const str = String(val).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
         /^[0-9a-f]{20,}$/i.test(str) ||
         (str.length > 15 && str.includes('-') && /[a-f0-9]{4,}/i.test(str));
};

/**
 * Clean display ID helper - replaces ugly UUIDs (#44c155f6...) with clean numbers #1, #2, #3, #4
 */
export const formatCleanId = (record, fallbackIndex = null, total = 0) => {
  if (!record && fallbackIndex === null) return '#1';

  let rawInvoice = typeof record === 'object' && record !== null 
    ? (record.invoice_no || record.invoice_number || record.reference_no || record.purchase_no || '')
    : record;
  let rawId = typeof record === 'object' && record !== null ? record.id : null;

  rawInvoice = String(rawInvoice || '').trim();
  rawId = String(rawId || '').trim();

  // 1. If clean invoice number (not a hash ID)
  if (rawInvoice && !isHashId(rawInvoice)) {
    const match = rawInvoice.match(/^INV-0*(\d+)$/i);
    if (match) {
      return `#${match[1]}`;
    }
    return rawInvoice.startsWith('#') ? rawInvoice : `#${rawInvoice}`;
  }

  // 2. If record.id is a pure numeric integer (e.g. 1, 2, 3...)
  if (rawId && !isHashId(rawId) && /^\d+$/.test(rawId)) {
    return `#${rawId}`;
  }

  // 3. If explicit seq_no was attached
  if (typeof record === 'object' && record?.seq_no) {
    return `#${record.seq_no}`;
  }

  // 4. Sequential fallback index
  if (fallbackIndex !== null && fallbackIndex !== undefined) {
    if (total > 0) {
      return `#${Math.max(1, total - fallbackIndex)}`;
    }
    return `#${fallbackIndex + 1}`;
  }

  return '#1';
};


