// ============================================================
// fbrService.js - FBR Digital Invoicing Integration
// For: RAATH POS (Software Vendor Module)
// Each client configures their own FBR credentials
// ============================================================

// ─── CLIENT CONFIG (Loaded from localStorage at runtime) ───
let _clientConfig = null;

function getClientConfig() {
  if (!_clientConfig) {
    try {
      const stored = localStorage.getItem('fbr_client_config');
      _clientConfig = stored ? JSON.parse(stored) : null;
    } catch (e) {
      _clientConfig = null;
    }
  }
  return _clientConfig;
}

function setClientConfig(config) {
  _clientConfig = config;
  localStorage.setItem('fbr_client_config', JSON.stringify(config));
}

function clearClientConfig() {
  _clientConfig = null;
  localStorage.removeItem('fbr_client_config');
}

// ─── FBR API ENDPOINTS ───
const FBR_ENDPOINTS = {
  SANDBOX: 'https://esp.fbr.gov.pk:8244/DigitalInvoicing/v1/PostInvoiceData_v1',
  PRODUCTION: 'https://gw.fbr.gov.pk/pdi/v1/api/DigitalInvoicing/PostInvoiceData_v1',
};

// ─── DEFAULTS ───
const DEFAULTS = {
  SALE_TYPE: 'T1000139',   // Local Supply
  UOM: '01000003',         // Each / Number
  HS_CODE: '85171200',     // Generic - client should override per product
};

/**
 * Format RAATH POS sale into FBR Digital Invoice JSON
 */
function formatFBRInvoice(sale, saleItems, customer = null, config = null) {
  const cfg = config || getClientConfig();
  if (!cfg) throw new Error('FBR Client Config not set');

  const invoiceDate = sale.date 
    ? new Date(sale.date).toISOString() 
    : new Date().toISOString();

  // Calculate tax breakdown per item
  let totalSalesTax = 0;
  let totalRetailPrice = 0;
  let totalDiscount = 0;

  const items = saleItems.map((item) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.price) || 0;
    const itemDiscount = Number(item.discount) || 0;
    const lineTotal = Number(item.total) || 0;
    
    // GST calculation (default 18% - client can override)
    const taxRate = Number(cfg.taxRate || 18) / 100;
    const valueExclST = lineTotal / (1 + taxRate);
    const salesTax = lineTotal - valueExclST;

    totalSalesTax += salesTax;
    totalRetailPrice += lineTotal;
    totalDiscount += itemDiscount;

    return {
      hsCode: item.hs_code || cfg.defaultHsCode || DEFAULTS.HS_CODE,
      productCode: item.sku || `SKU-${item.product_variant_id}`,
      productDescription: (item.product_name || 'Product').substring(0, 100),
      rate: Math.round(unitPrice * 100) / 100,
      uoM: item.uom || DEFAULTS.UOM,
      quantity: Math.round(qty * 100) / 100,
      valueSalesExcludingST: Math.round(valueExclST * 100) / 100,
      salesTaxApplicable: Math.round(salesTax * 100) / 100,
      retailPrice: Math.round(lineTotal * 100) / 100,
      stWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0,
      sroScheduleNo: '',
      fedPayable: 0,
      cvt: 0,
      whiT_1: 0,
      whiT_2: 0,
      whiT_Section_1: '',
      whiT_Section_2: '',
      totalValues: Math.round(lineTotal * 100) / 100,
      discount: Math.round(itemDiscount * 100) / 100,
    };
  });

  return {
    bposId: cfg.posId,
    invoiceType: '1',                    // 1 = Normal Invoice
    invoiceDate: invoiceDate,
    ntN_CNIC: customer?.cnic || customer?.ntn || '',
    buyerSellerName: (customer?.name || sale.customer_name || 'Walk-in Customer').substring(0, 100),
    destinationAddress: (customer?.address || '').substring(0, 200),
    saleType: cfg.saleType || DEFAULTS.SALE_TYPE,
    totalSalesTaxApplicable: Math.round(totalSalesTax * 100) / 100,
    totalRetailPrice: Math.round(totalRetailPrice * 100) / 100,
    totalSTWithheldAtSource: 0,
    totalExtraTax: 0,
    totalFEDPayable: 0,
    totalWithheldIncomeTax: 0,
    totalCVT: 0,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    distributor_NTN_CNIC: cfg.businessNtn,
    distributorName: cfg.businessName,
    Items: items,
  };
}

/**
 * Post invoice to FBR API via Electron main process
 * Returns: { success, reference, response, error }
 */
async function postInvoiceToFBR(invoiceData) {
  const cfg = getClientConfig();
  if (!cfg) {
    return { success: false, error: 'FBR not configured', reference: null, response: null };
  }

  const url = cfg.isSandbox ? FBR_ENDPOINTS.SANDBOX : FBR_ENDPOINTS.PRODUCTION;
  const token = cfg.authToken;

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.fbrPostInvoice) {
      const result = await window.electronAPI.fbrPostInvoice({ url, token, data: invoiceData });
      return parseFBRResponse(result);
    } else {
      // Browser fallback (for web demo mode)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });
      const data = await response.json();
      return parseFBRResponse({ ok: response.ok, status: response.status, data });
    }
  } catch (err) {
    return { success: false, error: err.message || 'Network Error', reference: null, response: null };
  }
}

function parseFBRResponse(result) {
  if (result.ok && result.data?.statusCode === 200) {
    return {
      success: true,
      reference: result.data.result,           // 28-digit FBR number
      response: result.data,
      error: null,
    };
  }
  return {
    success: false,
    reference: null,
    response: result.data,
    error: result.data?.errorMessage || result.data?.message || `HTTP ${result.status}`,
  };
}

/**
 * Generate QR code data string for receipt
 */
function generateQRData(fbrReference, sale) {
  return JSON.stringify({
    fbrNo: fbrReference,
    inv: sale.invoice_no,
    date: sale.date,
    total: sale.grand_total,
    tax: sale.tax || 0,
    verify: 'e.fbr.gov.pk',
  });
}

/**
 * Check if FBR is configured for this client
 */
function isFBRConfigured() {
  const cfg = getClientConfig();
  return !!(cfg && cfg.posId && cfg.businessNtn && cfg.authToken);
}

/**
 * Validate client FBR config
 */
function validateConfig(config) {
  const errors = [];
  if (!config.posId?.trim()) errors.push('POS ID required');
  if (!config.businessNtn?.trim()) errors.push('Business NTN required');
  if (!config.businessName?.trim()) errors.push('Business Name required');
  if (!config.authToken?.trim()) errors.push('Auth Token required');
  if (!config.taxRate || config.taxRate < 0 || config.taxRate > 100) errors.push('Valid Tax Rate (0-100) required');
  return errors;
}

/**
 * Test FBR connection with sandbox
 */
async function testFBRConnection(config) {
  const testPayload = {
    bposId: config.posId,
    invoiceType: '1',
    invoiceDate: new Date().toISOString(),
    ntN_CNIC: '',
    buyerSellerName: 'Test Customer',
    destinationAddress: '',
    saleType: config.saleType || DEFAULTS.SALE_TYPE,
    totalSalesTaxApplicable: 0,
    totalRetailPrice: 0,
    totalSTWithheldAtSource: 0,
    totalExtraTax: 0,
    totalFEDPayable: 0,
    totalWithheldIncomeTax: 0,
    totalCVT: 0,
    totalDiscount: 0,
    distributor_NTN_CNIC: config.businessNtn,
    distributorName: config.businessName,
    Items: [],
  };

  const url = config.isSandbox ? FBR_ENDPOINTS.SANDBOX : FBR_ENDPOINTS.PRODUCTION;
  
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.fbrPostInvoice) {
      const result = await window.electronAPI.fbrPostInvoice({ 
        url, 
        token: config.authToken, 
        data: testPayload 
      });
      return parseFBRResponse(result);
    }
    return { success: false, error: 'Electron API not available' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export {
  getClientConfig,
  setClientConfig,
  clearClientConfig,
  formatFBRInvoice,
  postInvoiceToFBR,
  generateQRData,
  isFBRConfigured,
  validateConfig,
  testFBRConnection,
  DEFAULTS,
};