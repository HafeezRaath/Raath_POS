// ============================================================
//  ThermalReceipt.jsx — Unified React Thermal Receipt Component
//  100% Monochrome Thermal Printer Optimization
//  Provides accurate on-screen live preview matching physical print
// ============================================================

import React from 'react';
import { Box, Paper, Typography, Divider } from '../ui/tailwind-mui';
import {
  getEffectiveReceiptSettings,
  getEffectiveShopProfile,
  getThermalDimensions,
  formatMoney,
  formatDateTime
} from '../../utils/receiptGenerator';

export const ThermalReceipt = React.forwardRef(({
  sale = {},
  items = [],
  party = null,
  partyType = null,
  serviceDetails = null,
  shopProfile = null,
  receiptSettings = null,
  design = null,
  fbrStatus = null,
  fbrEnabled = false,
  fbrMode = false,
  isFBRMode = false
}, ref) => {
  const effectiveSettings = { ...getEffectiveReceiptSettings(), ...(receiptSettings || {}) };
  const effectiveShop = { ...getEffectiveShopProfile(), ...(shopProfile || {}) };
  const currentDesign = design || effectiveSettings.design || 'design1';
  const dims = getThermalDimensions(effectiveSettings);

  const dt = formatDateTime(sale?.date || sale?.created_at);
  const invoiceNo = sale?.invoice_no || sale?.invoiceNo || sale?.id || 'INV-2026-001';
  const partyName = sale?.customer_name || sale?.party?.name || party?.name || (serviceDetails ? serviceDetails?.customer_name : null) || 'Walk-in Customer';
  const partyPhone = sale?.customer_phone || sale?.party?.phone || party?.phone || (serviceDetails ? serviceDetails?.customer_phone : null) || '';

  const displayItems = items && items.length > 0 ? items : [
    { name: 'Sample Product 500g', qty: 2, price: 150, total: 300, sku: 'PRD-01' },
    { name: 'Standard Store Item', qty: 1, price: 100, total: 100, sku: 'PRD-02' }
  ];

  const totalItems = displayItems.length;
  const totalQty = displayItems.reduce((s, i) => s + Number(i.qty || i.quantity || 1), 0);
  const subtotal = Number(sale?.subtotal || displayItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0));
  const discount = Number(sale?.discount || sale?.item_discount || 0);
  const tax = Number(sale?.tax || 0);
  const grandTotal = Number(sale?.grand_total || sale?.grandTotal || (subtotal - discount + tax));
  const paid = Number(sale?.paid_amount || sale?.paid || grandTotal);
  const due = Math.max(0, Number(sale?.due_amount || sale?.due || (grandTotal - paid)));
  const change = Math.max(0, Number(sale?.change_amount || sale?.change || (paid - grandTotal)));
  const paymentMode = (sale?.payment_mode || 'CASH').toUpperCase();

  const effectiveFooter = effectiveSettings.footerText || effectiveShop.receiptFooter || 'Thank you for visiting us!\nReturns accepted within 7 days with receipt.';
  const previewMaxWidth = dims.paperWidthMm <= 58 ? 260 : 340;

  // FBR and QR calculations
  const fbrRef = sale?.fbr_reference || sale?.dummy_fbr_reference || fbrStatus?.fbr_reference || fbrStatus?.dummy_fbr_reference || null;
  const isFBR = Boolean(isFBRMode || fbrEnabled || sale?.fbr_enabled);
  const qrUrl = effectiveSettings.showQR || fbrRef
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(fbrRef || invoiceNo)}`
    : null;

  // Header render
  const renderHeader = (subtitle = '') => (
    <Box sx={{ textAlign: 'center', pb: 1, color: '#000' }}>
      {effectiveSettings.showLogo && (effectiveShop.logo || effectiveShop.logoPreview) && (
        <Box
          component="img"
          src={effectiveShop.logo || effectiveShop.logoPreview}
          sx={{ width: 48, height: 48, mx: 'auto', mb: 0.5, objectFit: 'contain', filter: 'grayscale(100%) contrast(200%)' }}
          alt="Logo"
        />
      )}
      <Typography sx={{ fontWeight: 800, fontSize: `${dims.titleSizePx}px`, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000' }}>
        {effectiveShop.name || 'MY STORE'}
      </Typography>
      {effectiveShop.tagline && (
        <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
          {effectiveShop.tagline}
        </Typography>
      )}
      <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
        {effectiveShop.address ? `${effectiveShop.address} ` : ''}
        {effectiveShop.phone ? `| Tel: ${effectiveShop.phone}` : ''}
      </Typography>
      {effectiveShop.taxNumber && (
        <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
          NTN: {effectiveShop.taxNumber}
        </Typography>
      )}
      {effectiveSettings.headerText && (
        <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontStyle: 'italic', fontWeight: 600, mt: 0.5, color: '#000' }}>
          {effectiveSettings.headerText}
        </Typography>
      )}
      {subtitle && (
        <Typography sx={{ fontWeight: 800, fontSize: `${dims.headerSizePx}px`, letterSpacing: '1px', mt: 0.5, color: '#000' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );

  // Items table render
  const renderItemsTable = (styleType) => (
    <Box sx={{ my: 1 }}>
      {styleType === 'design4' ? (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', py: 0.5, fontWeight: 700, fontSize: `${dims.fontSizePx}px`, color: '#000' }}>
            <span style={{ width: '45%' }}>Item</span>
            <span style={{ width: '15%', textAlign: 'center' }}>Qty</span>
            <span style={{ width: '20%', textAlign: 'right' }}>Price</span>
            <span style={{ width: '20%', textAlign: 'right' }}>Total</span>
          </Box>
          {displayItems.map((item, idx) => (
            <Box key={idx} sx={{ py: 0.5, borderBottom: '1px dashed #000', fontSize: `${dims.fontSizePx}px`, color: '#000' }}>
              <Typography sx={{ fontWeight: 700, fontSize: `${dims.fontSizePx}px`, color: '#000' }}>{item.name}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
                <span>Qty: {item.qty} @ {Number(item.price).toFixed(0)}</span>
                <span style={{ fontWeight: 700 }}>{Number(item.total).toFixed(0)}</span>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '1.5px solid #000',
            py: 0.5,
            fontWeight: 700,
            fontSize: `${dims.fontSizePx}px`,
            bgcolor: styleType === 'design3' ? '#000' : 'transparent',
            color: styleType === 'design3' ? '#fff' : '#000',
            px: styleType === 'design3' ? 1 : 0
          }}>
            <span style={{ width: '45%', textAlign: 'left' }}>Item</span>
            <span style={{ width: '15%', textAlign: 'center' }}>Qty</span>
            <span style={{ width: '20%', textAlign: 'right' }}>Price</span>
            <span style={{ width: '20%', textAlign: 'right' }}>Total</span>
          </Box>
          {displayItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #000', fontSize: `${dims.fontSizePx}px`, color: '#000' }}>
              <span style={{ width: '45%', textAlign: 'left', fontWeight: 700 }}>{item.name}</span>
              <span style={{ width: '15%', textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
              <span style={{ width: '20%', textAlign: 'right', fontWeight: 600 }}>{Number(item.price).toFixed(0)}</span>
              <span style={{ width: '20%', textAlign: 'right', fontWeight: 700 }}>{Number(item.total).toFixed(0)}</span>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  // Totals render
  const renderTotals = (styleType) => (
    <Box sx={{ mt: 1, fontSize: `${dims.fontSizePx}px`, color: '#000000', fontWeight: 600 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600 }}>
        <span>Total Items: {totalItems}</span>
        <span>Total Qty: {totalQty}</span>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, mt: 0.3 }}>
        <span>Sub Total</span>
        <span>{formatMoney(subtotal)}</span>
      </Box>
      {effectiveSettings.showDiscountDetails && discount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Discount</span>
          <span>-{formatMoney(discount)}</span>
        </Box>
      )}
      {effectiveSettings.printTaxBreakdown && tax > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Tax</span>
          <span>{formatMoney(tax)}</span>
        </Box>
      )}

      {/* Grand Total Bar */}
      {styleType === 'design3' ? (
        <Box sx={{ bgcolor: '#000', color: '#fff', px: 1, py: 0.7, my: 1, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${dims.headerSizePx + 2}px` }}>
          <span>GRAND TOTAL</span>
          <span>{formatMoney(grandTotal)}</span>
        </Box>
      ) : styleType === 'design2' ? (
        <Box sx={{ border: '1.5px solid #000', px: 1, py: 0.5, my: 1, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${dims.headerSizePx + 1}px` }}>
          <span>TOTAL</span>
          <span>{formatMoney(grandTotal)}</span>
        </Box>
      ) : styleType === 'design4' ? (
        <Box sx={{ my: 0.8 }}>
          <Box sx={{ borderTop: '2.5px double #000', my: 0.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${dims.headerSizePx + 2}px`, py: 0.2 }}>
            <span>NET TOTAL</span>
            <span>{formatMoney(grandTotal)}</span>
          </Box>
          <Box sx={{ borderTop: '2.5px double #000', my: 0.5 }} />
        </Box>
      ) : (
        <Box sx={{ my: 0.8 }}>
          <Box sx={{ borderTop: '1.5px solid #000', my: 0.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${dims.headerSizePx + 2}px`, py: 0.2 }}>
            <span>TOTAL</span>
            <span>{formatMoney(grandTotal)}</span>
          </Box>
          <Box sx={{ borderTop: '1.5px solid #000', my: 0.5 }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, mt: 0.5, fontWeight: 600 }}>
        <span>Paid ({paymentMode}):</span>
        <span style={{ fontWeight: 700 }}>{formatMoney(paid)}</span>
      </Box>
      {sale?.split_payments && Array.isArray(sale.split_payments) && sale.split_payments.length > 0 && (
        <Box sx={{ pl: 1, my: 0.3, borderLeft: '1.5px solid #000' }}>
          {sale.split_payments.map((sp, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${Math.max(9, dims.smallSizePx - 1)}px` }}>
              <span>• {sp.account_name || sp.method?.toUpperCase()}:</span>
              <span>{formatMoney(sp.amount)}</span>
            </Box>
          ))}
        </Box>
      )}
      {due > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: `${dims.smallSizePx}px` }}>
          <span>Balance Due:</span>
          <span>{formatMoney(due)}</span>
        </Box>
      )}
      {change > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600 }}>
          <span>Change:</span>
          <span>{formatMoney(change)}</span>
        </Box>
      )}
    </Box>
  );

  // Footer render
  const renderFooter = () => (
    <Box sx={{ textAlign: 'center', mt: 1.5, pt: 1, borderTop: '1.5px dashed #000000', color: '#000000' }}>
      <Typography sx={{ fontWeight: 800, fontSize: `${dims.headerSizePx}px`, textTransform: 'uppercase', color: '#000000' }}>
        THANK YOU!
      </Typography>
      <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 600, whiteSpace: 'pre-line', mt: 0.5, color: '#000000' }}>
        {effectiveFooter}
      </Typography>
      {qrUrl && (
        <Box
          component="img"
          src={qrUrl}
          sx={{ width: 70, height: 70, mx: 'auto', my: 0.8, display: 'block', filter: 'grayscale(100%) contrast(300%)' }}
          alt="QR Code"
        />
      )}
      {isFBR && (
        <Typography sx={{ fontSize: '9px', fontWeight: 800, mt: 0.5, color: '#000000' }}>
          *** FBR VERIFIED DIGITAL INVOICE ***
        </Typography>
      )}
      {effectiveSettings.feedLines > 0 && (
        <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px dashed #94a3b8', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '9px', color: '#475569', fontStyle: 'italic', fontWeight: 500 }}>
            --- Paper Cut ({effectiveSettings.feedLines} blank feed lines) ---
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Paper
      ref={ref}
      sx={{
        width: '100%',
        maxWidth: `${previewMaxWidth}px`,
        mx: 'auto',
        p: `${Math.max(6, dims.paddingMm * 4)}px`,
        bgcolor: '#ffffff',
        border: currentDesign === 'design3' ? '1.5px solid #000000' : '1px solid #9ca3af',
        borderRadius: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontWeight: 600,
        color: '#000000',
        boxSizing: 'border-box'
      }}
    >
      {/* DESIGN 1: CLASSIC */}
      {currentDesign === 'design1' && (
        <Box>
          {renderHeader()}
          <Box sx={{ borderTop: '1.5px dashed #000', my: 0.8 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
            <span><strong>Inv:</strong> {invoiceNo}</span>
            <span>{dt.date} {dt.time}</span>
          </Box>
          {effectiveSettings.printCustomerName && partyName && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000', mt: 0.3 }}>
              <span><strong>Customer:</strong> {partyName}</span>
              {effectiveSettings.printCustomerPhone && partyPhone && <span>{partyPhone}</span>}
            </Box>
          )}
          <Box sx={{ borderTop: '1.5px dashed #000', my: 0.8 }} />
          {renderItemsTable('design1')}
          {renderTotals('design1')}
          {renderFooter()}
        </Box>
      )}

      {/* DESIGN 2: MODERN */}
      {currentDesign === 'design2' && (
        <Box>
          {renderHeader()}
          <Box sx={{ border: '1.5px solid #000', p: 0.8, my: 0.8, fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span><strong>INVOICE:</strong> {invoiceNo}</span>
              <span>{dt.date}</span>
            </Box>
            {effectiveSettings.printCustomerName && partyName && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
                <span><strong>BILL TO:</strong> {partyName}</span>
                {effectiveSettings.printCustomerPhone && partyPhone && <span>{partyPhone}</span>}
              </Box>
            )}
          </Box>
          {renderItemsTable('design2')}
          {renderTotals('design2')}
          {renderFooter()}
        </Box>
      )}

      {/* DESIGN 3: BOLD / PREMIUM */}
      {currentDesign === 'design3' && (
        <Box>
          <Box sx={{ border: '1.5px solid #000', p: 0.5, mb: 1 }}>
            <Box sx={{ bgcolor: '#000', color: '#fff', textAlign: 'center', py: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: `${dims.titleSizePx}px`, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {effectiveShop.name || 'MY STORE'}
              </Typography>
              {effectiveShop.tagline && (
                <Typography sx={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 600 }}>{effectiveShop.tagline}</Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'center', py: 0.5, fontSize: `${dims.smallSizePx}px`, fontWeight: 600, color: '#000' }}>
              {effectiveShop.address ? `<span>${effectiveShop.address}</span> ` : ''}
              {effectiveShop.phone ? `<span>| Tel: ${effectiveShop.phone}</span>` : ''}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 700, borderBottom: '1.5px solid #000', pb: 0.4, mb: 0.5 }}>
            <span># {invoiceNo}</span>
            <span>{dt.date} {dt.time}</span>
          </Box>
          {effectiveSettings.printCustomerName && partyName && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600, mb: 0.5 }}>
              <span><strong>Client:</strong> {partyName}</span>
              {effectiveSettings.printCustomerPhone && partyPhone && <span>{partyPhone}</span>}
            </Box>
          )}

          {renderItemsTable('design3')}
          {renderTotals('design3')}
          {renderFooter()}
        </Box>
      )}

      {/* DESIGN 4: SUPERMARKET / IMTIAZ STYLE */}
      {currentDesign === 'design4' && (
        <Box>
          {renderHeader('*** CASH MEMO ***')}
          <Box sx={{ borderTop: '1.5px dashed #000', my: 0.8 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: `${dims.smallSizePx}px` }}>
            <span>Trans: {invoiceNo}</span>
            <span>{dt.date}</span>
          </Box>
          {effectiveSettings.printCustomerName && partyName && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: `${dims.smallSizePx}px`, fontWeight: 600, mt: 0.3 }}>
              <span>Cust: {partyName}</span>
              {effectiveSettings.printCustomerPhone && partyPhone && <span>{partyPhone}</span>}
            </Box>
          )}
          <Box sx={{ borderTop: '1.5px dashed #000', my: 0.8 }} />
          {renderItemsTable('design4')}
          {renderTotals('design4')}
          {renderFooter()}
        </Box>
      )}
    </Paper>
  );
});

export default ThermalReceipt;

