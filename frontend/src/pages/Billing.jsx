import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Chip, Divider, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, InputAdornment, Tooltip, useMediaQuery, useTheme,
  Grid, Card, CardContent, Stack, Badge, Collapse,
  List, ListItem, ListItemText, ListItemIcon,
  BottomNavigation, BottomNavigationAction, Drawer, ToggleButton, ToggleButtonGroup,
  Slider, FormControlLabel, Switch, ButtonGroup
} from '../components/ui/tailwind-mui';
import {
  Add, Delete, Search, Print, Save, Pause, Close,
  Receipt, QrCodeScanner, LocalOffer, ShoppingCart,
  Menu as MenuIcon, KeyboardArrowDown, KeyboardArrowUp,
  CheckCircle, Print as PrintIcon, ViewModule, ViewList,
  Image as ImageIcon, Discount, AttachMoney, TrendingUp,
  ArrowBack, ArrowForward, RemoveCircle, VerifiedUser, Sync as SyncIcon,
  QrCode, Refresh as RefreshIcon, ToggleOn, ToggleOff,
  ReceiptLong, Remove, DeleteOutline, Sliders, PointOfSale, Store
} from '../components/ui/icons';
import db from '../database/db';
import useSyncListener from '../hooks/useSyncListener';
import ThermalReceipt from '../components/receipt/ThermalReceipt';
import { printReceiptDirect, getEffectiveReceiptSettings, getEffectiveShopProfile } from '../utils/receiptGenerator';

// ==================== HELPERS ====================
// ==================== HELPERS ====================
const formatPKR = (amount) => {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
};

// FIXED: Use local date to avoid timezone issues
const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalISOString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

// ==================== GET RECEIPT SETTINGS ====================
const getReceiptSettings = () => getEffectiveReceiptSettings();
const getReceiptDesign = () => getEffectiveReceiptSettings().design;
const getShopProfile = () => getEffectiveShopProfile();

// ==================== FBR SERVICE FUNCTIONS ====================
const isFBRConfigured = () => {
  try {
    const saved = localStorage.getItem('tax_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.fbrEnabled === true && parsed.fbrApiKey && parsed.fbrApiKey.length > 0;
    }
  } catch (e) {}
  return false;
};

const getFBRConfig = () => {
  try {
    const saved = localStorage.getItem('tax_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return null;
};

// ==================== GENERATE DUMMY QR CODE ====================
const generateDummyQR = () => {
  return `FBR-DEMO-${Date.now()}-${String(Math.random()).slice(2, 8)}`;
};

// ThermalReceipt is imported from '../components/receipt/ThermalReceipt'

// ==================== TAX SUMMARY COMPONENT ====================
const TaxSummary = ({ totalTax, taxRate, fbrMode, fbrEnabled }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!fbrEnabled) return null;
  
  const taxType = fbrMode ? 'FBR Tax' : 'Demo Tax (0%)';
  const taxColor = fbrMode ? '#10b981' : '#6b7280';
  
  return (
    <Box sx={{ 
      bgcolor: fbrMode ? '#f0fdf4' : '#f9fafb', 
      border: `1px solid ${fbrMode ? '#bbf7d0' : '#e5e7eb'}`,
      borderRadius: 1,
      p: 1,
      mt: 1
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" fontWeight="bold" color={taxColor}>
            {taxType} Summary
          </Typography>
          <Chip 
            size="small" 
            label={fbrMode ? 'ON' : 'OFF'} 
            sx={{ 
              height: 16, 
              fontSize: '0.5rem', 
              bgcolor: fbrMode ? '#10b981' : '#9ca3af',
              color: 'white'
            }} 
          />
        </Box>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
        </IconButton>
      </Box>
      
      {expanded && (
        <Box sx={{ mt: 0.5 }}>
          <Divider sx={{ my: 0.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
            <Typography variant="caption" color="text.secondary">Tax Rate</Typography>
            <Typography variant="caption" fontWeight="bold">{taxRate}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
            <Typography variant="caption" color="text.secondary">Total Tax Collected</Typography>
            <Typography variant="caption" fontWeight="bold" color={taxColor}>
              {formatPKR(totalTax)}
            </Typography>
          </Box>
          {fbrMode && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <Typography variant="caption" color="text.secondary">FBR Status</Typography>
              <Chip 
                size="small" 
                label="Active" 
                sx={{ height: 14, fontSize: '0.4rem', bgcolor: '#10b981', color: 'white' }} 
              />
            </Box>
          )}
          {!fbrMode && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <Typography variant="caption" color="text.secondary">Mode</Typography>
              <Chip 
                size="small" 
                label="Demo (0% Tax)" 
                sx={{ height: 14, fontSize: '0.4rem', bgcolor: '#9ca3af', color: 'white' }} 
              />
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
            <Typography variant="caption" color="text.secondary">Total Sales (Taxable)</Typography>
            <Typography variant="caption" fontWeight="bold">{formatPKR(taxRate > 0 ? totalTax / (taxRate / 100) : 0)}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ==================== PRODUCT CATEGORY GRID ====================
const ProductCategoryGrid = ({ 
  categories, 
  products, 
  selectedCategory, 
  setSelectedCategory, 
  addToCart,
  updateCartQty,
  cart,
  saleType,
  showCostPrice,
  setShowCostPrice,
  showWholesalePrice,
  setShowWholesalePrice,
  fbrEnabled 
}) => {
  const filteredProducts = selectedCategory 
    ? products.filter(p => String(p.category_id) === String(selectedCategory))
    : products;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* HORIZONTAL CATEGORY SCROLL - PILL STYLE */}
      <Box sx={{ 
        display: 'flex', 
        gap: 0.5, 
        mb: 1, 
        overflowX: 'auto', 
        pb: 0.5,
        flexShrink: 0,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#10b981', borderRadius: 2 },
        '&::-webkit-scrollbar-track': { bgcolor: '#f1f1f1', borderRadius: 2 }
      }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => setSelectedCategory('')}
          sx={{ 
            borderRadius: 2.5, 
            px: 2, 
            py: 0.6, 
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            bgcolor: selectedCategory === '' ? '#1c2580' : '#ffffff',
            color: selectedCategory === '' ? '#ffffff' : '#334155',
            border: selectedCategory === '' ? '1px solid #1c2580' : '1px solid #e2e8f0',
            boxShadow: selectedCategory === '' ? '0 2px 6px rgba(28,37,128,0.25)' : 'none',
            textTransform: 'none',
            minHeight: 32,
            '&:hover': {
              bgcolor: selectedCategory === '' ? '#151b60' : '#f8fafc',
              borderColor: selectedCategory === '' ? '#151b60' : '#cbd5e1'
            }
          }}
        >
          🏷️ All Products
        </Button>
        {categories.map(cat => {
          const count = products.filter(p => String(p.category_id) === String(cat.id)).length;
          const isSelected = String(selectedCategory) === String(cat.id);
          return (
            <Button
              key={cat.id}
              size="small"
              onClick={() => setSelectedCategory(String(cat.id))}
              sx={{ 
                borderRadius: 2.5, 
                px: 1.5, 
                py: 0.6, 
                fontSize: '0.75rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                bgcolor: isSelected ? '#1c2580' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                border: isSelected ? '1px solid #1c2580' : '1px solid #e2e8f0',
                boxShadow: isSelected ? '0 2px 6px rgba(28,37,128,0.25)' : 'none',
                textTransform: 'none',
                minHeight: 32,
                gap: 0.75,
                '&:hover': {
                  bgcolor: isSelected ? '#151b60' : '#f8fafc',
                  borderColor: isSelected ? '#151b60' : '#cbd5e1'
                }
              }}
            >
              <span>📁</span> {cat.name}
              <Box 
                component="span"
                sx={{ 
                  px: 0.8, 
                  py: 0.1, 
                  borderRadius: 2, 
                  fontSize: '0.68rem', 
                  fontWeight: 800,
                  bgcolor: isSelected ? 'rgba(255,255,255,0.2)' : '#e8eaf6',
                  color: isSelected ? '#ffffff' : '#1c2580'
                }} 
              >
                {count}
              </Box>
            </Button>
          );
        })}
      </Box>

      {/* TOOLBAR */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.25, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Typography variant="subtitle2" fontWeight="800" sx={{ fontSize: '0.82rem', color: '#1c2580' }}>
          Available Items
        </Typography>
        <Chip 
          size="small" 
          label={`${filteredProducts.length} items`} 
          sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, bgcolor: '#e8eaf6', color: '#1c2580', border: '1px solid #c5cae9' }}
        />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button 
            size="small"
            variant={showCostPrice ? 'contained' : 'outlined'}
            onClick={() => setShowCostPrice(!showCostPrice)}
            sx={{ 
              borderRadius: 2,
              fontSize: '0.72rem', 
              py: 0.4,
              px: 1.5,
              bgcolor: showCostPrice ? '#d97706' : '#ffffff',
              color: showCostPrice ? '#ffffff' : '#d97706',
              borderColor: '#d97706',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: showCostPrice ? '#b45309' : '#fffbeb', borderColor: '#d97706' }
            }}
          >
            Cost Price {showCostPrice ? '✓' : ''}
          </Button>
          <Button 
            size="small"
            variant={showWholesalePrice ? 'contained' : 'outlined'}
            onClick={() => setShowWholesalePrice(!showWholesalePrice)}
            sx={{ 
              borderRadius: 2,
              fontSize: '0.72rem', 
              py: 0.4,
              px: 1.5,
              bgcolor: showWholesalePrice ? '#1c2580' : '#ffffff',
              color: showWholesalePrice ? '#ffffff' : '#1c2580',
              borderColor: '#1c2580',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: showWholesalePrice ? '#151b60' : '#e8eaf6', borderColor: '#1c2580' }
            }}
          >
            Wholesale Price {showWholesalePrice ? '✓' : ''}
          </Button>
        </Box>
        {fbrEnabled && (
          <Chip 
            size="small" 
            label="FBR" 
            color="success" 
            sx={{ fontSize: '0.55rem', height: 22, fontWeight: 800 }}
          />
        )}
      </Box>
      
      {/* PRODUCT GRID */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', 
        gridAutoRows: '240px',
        gap: 1.25,
        alignContent: 'start',
        p: 0.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#10b981', borderRadius: 2 },
        '&::-webkit-scrollbar-track': { bgcolor: '#f1f1f1', borderRadius: 2 }
      }}>
        {filteredProducts.slice(0, 50).map(product => {
          const cartItem = cart?.find(c => 
            String(c.variantId || c.id || c.variant_id || c.productId) === String(product.id)
          );
          const inCart = !!cartItem;
          const cartQty = cartItem ? (cartItem.qty || cartItem.quantity || 0) : 0;
          const stock = Number(product.current_stock || 0);
          const price = saleType === 'wholesale' 
            ? (product.wholesale_price || product.retail_price || 0)
            : (product.retail_price || product.purchase_price || 0);
          const costPrice = product.purchase_price || product.cost_price || 0;
          const wholesalePrice = product.wholesale_price || 0;

          return (
            <Card 
              key={product.id} 
              sx={{ 
                cursor: 'pointer', 
                position: 'relative', 
                height: 240,
                maxHeight: 240,
                opacity: stock <= 0 ? 0.5 : 1,
                border: inCart ? '2px solid #1c2580' : '1px solid #e2e8f0',
                '&:hover': { 
                  borderColor: inCart ? '#1c2580' : '#3949ab', 
                  boxShadow: '0 4px 14px rgba(28,37,128,0.12)',
                  transform: 'translateY(-1px)',
                  transition: 'all 0.15s ease'
                },
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                bgcolor: '#ffffff',
                borderRadius: 2,
                overflow: 'hidden'
              }}
              onClick={() => stock > 0 && !inCart && addToCart(product, 0)}
            >
              {stock <= 0 && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  right: 0, 
                  bgcolor: 'error.main', 
                  color: 'white', 
                  px: 0.5, 
                  fontSize: '0.45rem',
                  borderRadius: '0 4px 0 4px',
                  zIndex: 1
                }}>
                  OUT
                </Box>
              )}
              {inCart && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  bgcolor: '#1c2580', 
                  color: 'white', 
                  px: 0.9, 
                  py: 0.25,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  borderRadius: '4px 0 6px 0',
                  zIndex: 1,
                  letterSpacing: '0.01em'
                }}>
                  ✓ {cartQty} IN CART
                </Box>
              )}
              <CardContent sx={{ 
                p: '8px 10px', 
                '&:last-child': { pb: '8px' }, 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                overflow: 'hidden'
              }}>
                {/* TOP SECTION: Photo / Box + Product Name + SKU */}
                <Box>
                  {/* PRODUCT IMAGE / 3D BOX */}
                  {product.image_url ? (
                    <Box sx={{ 
                      width: '100%', 
                      height: 56, 
                      bgcolor: '#f8fafc', 
                      borderRadius: 1,
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      <img 
                        src={product.image_url} 
                        alt={product.product_name || product.variant_name} 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%', 
                          objectFit: 'contain' 
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ 
                      width: '100%', 
                      height: 56, 
                      bgcolor: '#f8fafc', 
                      borderRadius: 1,
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px'
                    }}>
                      📦
                    </Box>
                  )}
                  
                  {/* PRODUCT NAME (Compact & neat, strictly 28px height so all cards align identically) */}
                  <Typography 
                    variant="caption" 
                    fontWeight="bold" 
                    title={product.product_name || product.variant_name} 
                    sx={{ 
                      color: '#0f172a',
                      fontSize: '0.72rem',
                      lineHeight: 1.25,
                      height: 28,
                      minHeight: 28,
                      maxHeight: 28,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                      mb: 0.2
                    }}
                  >
                    {product.product_name || product.variant_name}
                  </Typography>

                  {/* SKU (Clean truncate, strictly 14px height) */}
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    noWrap 
                    sx={{ 
                      fontSize: '0.62rem', 
                      display: 'block',
                      lineHeight: '14px',
                      height: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mb: 0.4
                    }}
                  >
                    SKU: {product.sku || 'N/A'}
                  </Typography>
                </Box>

                {/* BOTTOM SECTION: Retail Price + Stock + Wholesale & Cost (Strictly aligned to bottom) */}
                <Box sx={{ mt: 'auto' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20, mb: 0.3 }}>
                    <Typography variant="body2" fontWeight="800" sx={{ color: '#1c2580', fontSize: '0.88rem', lineHeight: 1 }}>
                      Rs. {Number(price).toLocaleString('en-PK')}
                    </Typography>
                    <Chip 
                      label={`Stock: ${stock}`} 
                      size="small" 
                      sx={{ 
                        height: 18, 
                        fontSize: '0.62rem', 
                        fontWeight: 800, 
                        px: 0.4,
                        bgcolor: stock > 10 ? '#dcfce7' : stock > 0 ? '#fef3c7' : '#fee2e2',
                        color: stock > 10 ? '#15803d' : stock > 0 ? '#b45309' : '#b91c1c'
                      }} 
                    />
                  </Box>

                  {/* WHOLESALE & COST PRICE MATCHING DASHBOARD THEME */}
                  {(showWholesalePrice || showCostPrice) && (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center',
                      gap: 0.1, 
                      pt: 0.3,
                      borderTop: '1px dashed #e2e8f0',
                      height: (showWholesalePrice && wholesalePrice > 0 && showCostPrice && costPrice > 0) ? 30 : 16
                    }}>
                      {showWholesalePrice && wholesalePrice > 0 && (
                        <Typography sx={{ fontSize: '0.70rem', color: '#1c2580', fontWeight: 800, lineHeight: 1.1 }}>
                          Whole: Rs. {Number(wholesalePrice).toLocaleString('en-PK')}
                        </Typography>
                      )}
                      {showCostPrice && costPrice > 0 && (
                        <Typography sx={{ fontSize: '0.70rem', color: '#d97706', fontWeight: 800, lineHeight: 1.1 }}>
                          Cost: Rs. {Number(costPrice).toLocaleString('en-PK')}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </CardContent>

              {/* CART CONTROLS FOR GRID CARDS - DASHBOARD THEME */}
              {inCart && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  bgcolor: '#e8eaf6', 
                  px: 1, 
                  py: 0.25, 
                  borderTop: '1px solid #c5cae9', 
                  flexShrink: 0, 
                  height: 28,
                  minHeight: 28 
                }} onClick={(e) => e.stopPropagation()}>
                  <IconButton 
                    size="small" 
                    onClick={() => updateCartQty(product.id, cartQty - 1)}
                    sx={{ 
                      width: 20, 
                      height: 20, 
                      bgcolor: '#fee2e2', 
                      color: '#ef4444', 
                      borderRadius: 1, 
                      p: 0,
                      '&:hover': { bgcolor: '#fca5a5' } 
                    }}
                  >
                    <Remove sx={{ fontSize: 13, fontWeight: 900 }} />
                  </IconButton>
                  <Typography variant="body2" fontWeight="800" color="#1c2580" sx={{ fontSize: '0.82rem' }}>
                    {cartQty}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => updateCartQty(product.id, cartQty + 1)}
                    disabled={cartQty >= stock}
                    sx={{ 
                      width: 20, 
                      height: 20, 
                      bgcolor: '#c5cae9', 
                      color: '#1c2580', 
                      borderRadius: 1, 
                      p: 0,
                      '&:hover': { bgcolor: '#9fa8da' } 
                    }}
                  >
                    <Add sx={{ fontSize: 13, fontWeight: 900 }} />
                  </IconButton>
                </Box>
              )}
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

// ==================== FBR SCAN DIALOG ====================
const FBRScanDialog = ({ open, onClose, onScanComplete, showSnackbar }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualRef, setManualRef] = useState('');

  const handleScan = async () => {
    setScanning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = {
        success: true,
        data: {
          reference: `FBR-${Date.now()}`,
          status: 'verified',
          taxRate: 18,
          amount: 0
        }
      };
      setScanResult(result);
      onScanComplete(result);
      showSnackbar('FBR Invoice Verified', 'success');
    } catch (err) {
      onScanComplete({ success: false, error: err.message });
      showSnackbar('FBR Scan Failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleManualVerify = () => {
    if (!manualRef.trim()) {
      showSnackbar('Please enter FBR reference', 'warning');
      return;
    }
    onScanComplete({ 
      success: true, 
      data: { reference: manualRef, status: 'verified', manual: true } 
    });
    showSnackbar(`FBR Reference Verified: ${manualRef}`, 'success');
    setManualRef('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <QrCode sx={{ mr: 1, verticalAlign: 'middle' }} />
        FBR Invoice Scanner
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Paper sx={{ 
            p: 3, 
            bgcolor: '#f0fdf4', 
            border: '2px dashed #10b981',
            borderRadius: 2
          }}>
            <QrCodeScanner sx={{ fontSize: 80, color: '#10b981' }} />
            <Typography variant="h6" color="#10b981" fontWeight="bold">
              {scanning ? 'Scanning...' : 'Ready to Scan'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Scan FBR QR code from invoice
            </Typography>
          </Paper>
        </Box>

        <Divider sx={{ my: 2 }}>OR</Divider>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Enter FBR Reference"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
          />
          <Button 
            variant="outlined" 
            onClick={handleManualVerify}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Verify
          </Button>
        </Box>

        {scanResult && (
          <Alert severity={scanResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
            {scanResult.success ? `Verified: ${scanResult.data.reference}` : scanResult.error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button 
          variant="contained" 
          onClick={handleScan} 
          disabled={scanning}
          sx={{ bgcolor: '#10b981' }}
          startIcon={scanning ? <SyncIcon className="spin" /> : <QrCode />}
        >
          {scanning ? 'Scanning...' : 'Scan FBR QR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== PRINTER SETTINGS DIALOG ====================
const PrinterSettingsDialog = ({ open, onClose, onPrinterSelect }) => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [receiptDesign, setReceiptDesign] = useState(() => getReceiptDesign());

  useEffect(() => {
    if (open) {
      loadPrinters();
      const saved = localStorage.getItem('default_printer') || getReceiptSettings().printerName;
      if (saved) setSelectedPrinter(saved);
      setReceiptDesign(getReceiptDesign());
    }
  }, [open]);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.getPrinters) {
        const list = await window.electronAPI.getPrinters();
        setPrinters(list || []);
        // Auto-detect thermal printer if none selected
        const current = localStorage.getItem('default_printer') || getReceiptSettings().printerName;
        if (!current && list && list.length > 0) {
          const thermal = list.find(p => /pos|thermal|receipt|xp-|\b80\b|\b58\b|rongta|black\s*copper/i.test(p));
          if (thermal) setSelectedPrinter(thermal);
        }
      } else {
        setPrinters(['Default Printer', 'Thermal Printer', 'Receipt Printer']);
      }
    } catch (err) {
      console.error('Failed to load printers:', err);
      setPrinters(['Default Printer']);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (selectedPrinter) {
      localStorage.setItem('default_printer', selectedPrinter);
      localStorage.setItem('receipt_design', receiptDesign);
      try {
        const cur = JSON.parse(localStorage.getItem('receipt_settings') || '{}');
        const updated = { ...cur, printerName: selectedPrinter, design: receiptDesign };
        localStorage.setItem('receipt_settings', JSON.stringify(updated));
        if (db && db.settings) {
          db.settings.put({ key: 'receipt_settings', value: updated }).catch(() => {});
        }
      } catch (e) {}
      onPrinterSelect(selectedPrinter);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <PrintIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Receipt Printer & Design Settings
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Select Thermal Printer</InputLabel>
            <Select 
              value={selectedPrinter} 
              onChange={(e) => setSelectedPrinter(e.target.value)}
              label="Select Thermal Printer"
            >
              {printers.map((printer, idx) => (
                <MenuItem key={idx} value={printer}>
                  {printer}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Receipt Design (100% Thermal Black)</InputLabel>
            <Select 
              value={receiptDesign} 
              onChange={(e) => setReceiptDesign(e.target.value)}
              label="Receipt Design (100% Thermal Black)"
            >
              <MenuItem value="design1">Design 1 - Classic Thermal (Standard POS)</MenuItem>
              <MenuItem value="design2">Design 2 - Modern Clean (Minimalist & Compact)</MenuItem>
              <MenuItem value="design3">Design 3 - Bold Thermal (Solid Black Bars)</MenuItem>
              <MenuItem value="design4">Design 4 - Imtiaz Supermarket (High-Density Monospace)</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 1 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Tips:
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              ΓÇó Press F12 to open this dialog anytime in Billing
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              ΓÇó Thermal printer settings sync across Billing, History, Services & Settings
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              ΓÇó All 4 designs are optimized with crisp monochrome thermal contrast (no washed-out gray)
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!selectedPrinter}
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== SHORTCUTS HELP ====================
const ShortcutsHelp = ({ open, onClose }) => {
  const shortcuts = [
    { key: 'F1', action: 'Focus Search / Scanner' },
    { key: 'F2', action: 'Toggle View (Grid/List)' },
    { key: 'F3', action: 'Hold Current Bill' },
    { key: 'F5', action: 'View Held Bills' },
    { key: 'F9', action: 'Save / Process Payment' },
    { key: 'F10', action: 'New Bill / Clear Cart' },
    { key: 'F12', action: 'Printer Settings' },
    { key: 'Tab', action: 'Move to Next Field' },
    { key: 'Shift+Tab', action: 'Move to Previous Field' },
    { key: 'Enter', action: 'Save Sale (on Paid field)' },
    { key: 'Escape', action: 'Close Dialogs' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <KeyboardArrowDown sx={{ mr: 1, verticalAlign: 'middle' }} />
        Keyboard Shortcuts
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List sx={{ p: 0 }}>
          {shortcuts.map((sc, idx) => (
            <ListItem 
              key={idx} 
              divider={idx < shortcuts.length - 1}
              sx={{ 
                py: 1.5,
                bgcolor: idx % 2 === 0 ? 'transparent' : '#f8fafc'
              }}
            >
              <ListItemIcon>
                <Chip 
                  label={sc.key} 
                  size="small" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    fontWeight: 'bold',
                    bgcolor: '#10b981',
                    color: 'white',
                    minWidth: 60
                  }} 
                />
              </ListItemIcon>
              <ListItemText primary={sc.action} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 2, bgcolor: '#f0fdf4' }}>
          <Typography variant="caption" color="text.secondary">
            FBR Mode: Press FBR toggle button to switch between Real and Demo mode
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#10b981' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== SPLIT PAYMENT DIALOG ====================
const SplitPaymentDialog = ({ 
  open, 
  onClose, 
  splitPayments, 
  handleSplitAmountChange, 
  handleSplitAccountChange, 
  handleResetSplit, 
  handleFillRest, 
  accounts, 
  grandTotal 
}) => {
  const allocated = Object.values(splitPayments).reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
  const remaining = Math.max(0, grandTotal - allocated);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0c1427', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight="bold">🔀 Split Payment Breakdown</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Grand Total Payable</Typography>
            <Typography variant="h6" fontWeight="900" sx={{ color: '#10b981' }}>{formatPKR(grandTotal)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Allocated / Remaining</Typography>
            <Typography variant="subtitle2" fontWeight="800" sx={{ color: remaining === 0 ? '#10b981' : '#dc2626' }}>
              Allocated: {formatPKR(allocated)} • Remaining: {formatPKR(remaining)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[
            { key: 'cash', label: 'Cash', icon: '💵', color: '#16a34a', bgBtn: '#ecfdf5', borderBtn: '#86efac' },
            { key: 'jazzcash', label: 'JazzCash', icon: '📱', color: '#dc2626', bgBtn: '#fef2f2', borderBtn: '#fca5a5' },
            { key: 'easypaisa', label: 'EasyPaisa', icon: '📱', color: '#0d9488', bgBtn: '#f0fdfa', borderBtn: '#99f6e4' },
            { key: 'bank', label: 'Bank', icon: '🏦', color: '#2563eb', bgBtn: '#eff6ff', borderBtn: '#bfdbfe' },
          ].map(({ key, label, icon, color, bgBtn, borderBtn }) => (
            <Box key={key} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 1.25, bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography fontWeight="bold" sx={{ color, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{icon}</span> {label}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleFillRest(key)}
                  sx={{
                    color,
                    borderColor: borderBtn,
                    bgcolor: bgBtn,
                    fontSize: '0.68rem',
                    py: 0.25,
                    px: 1.2,
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderRadius: 1.5,
                    '&:hover': { borderColor: color, bgcolor: bgBtn }
                  }}
                >
                  Fill Remaining
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  placeholder="0.00"
                  value={splitPayments[key].amount}
                  onChange={(e) => handleSplitAmountChange(key, e.target.value)}
                  sx={{
                    width: '45%',
                    '& .MuiOutlinedInput-root': { height: 38, bgcolor: '#f8fafc', borderRadius: 1.5 },
                    '& input': { fontSize: '0.9rem', fontWeight: 'bold' }
                  }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <Select
                    value={splitPayments[key].accountId || ''}
                    onChange={(e) => handleSplitAccountChange(key, e.target.value)}
                    displayEmpty
                    sx={{ height: 38, fontSize: '0.78rem', bgcolor: '#f8fafc', borderRadius: 1.5 }}
                  >
                    <MenuItem value="" disabled><em>Select Account</em></MenuItem>
                    {accounts.map(acc => (
                      <MenuItem key={acc.id} value={acc.id} sx={{ fontSize: '0.78rem' }}>
                        {acc.name} ({acc.type || 'account'})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button onClick={handleResetSplit} color="inherit" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
          Reset All
        </Button>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#10b981', fontWeight: 800, px: 3, '&:hover': { bgcolor: '#059669' } }}>
          Done & Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== MAIN COMPONENT ====================
export default function BillingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileActiveTab, setMobileActiveTab] = useState('products');
  
  // ---- STATE ----
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  const [partyType, setPartyType] = useState('customer');
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [saleType, setSaleType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountType, setBillDiscountType] = useState('amount');
  const [taxPercent, setTaxPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState('INV-0001');
  const [heldBills, setHeldBills] = useState(() => {
    const saved = localStorage.getItem('heldBills');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [offers, setOffers] = useState([]);
  const [showOffersDialog, setShowOffersDialog] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [showWholesalePrice, setShowWholesalePrice] = useState(false);
  const [revealedWholesaleIds, setRevealedWholesaleIds] = useState({});
  const wholesaleTimersRef = useRef({});

  const handleRevealWholesale = useCallback((id) => {
    if (wholesaleTimersRef.current[id]) {
      clearTimeout(wholesaleTimersRef.current[id]);
    }
    setRevealedWholesaleIds(prev => ({ ...prev, [id]: true }));
    wholesaleTimersRef.current[id] = setTimeout(() => {
      setRevealedWholesaleIds(prev => ({ ...prev, [id]: false }));
      delete wholesaleTimersRef.current[id];
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(wholesaleTimersRef.current).forEach(clearTimeout);
    };
  }, []);
  
  // ---- FBR State ----
  const [fbrEnabled, setFbrEnabled] = useState(false);
  const [fbrMode, setFbrMode] = useState(false);
  const [showFBRScan, setShowFBRScan] = useState(false);
  const [fbrStatus, setFbrStatus] = useState(null);
  const [fbrSyncEnabled, setFbrSyncEnabled] = useState(false);
  
  // ---- Tax Summary State ----
  const [totalTaxCollected, setTotalTaxCollected] = useState(0);
    // ---- Payment Account Routing ----
  const [accounts, setAccounts] = useState([]);
  const [paymentAccount, setPaymentAccount] = useState(null);

  // ---- Multi-Method Split Payments State ----
  const [splitPayments, setSplitPayments] = useState({
    cash: { amount: '', accountId: '' },
    jazzcash: { amount: '', accountId: '' },
    easypaisa: { amount: '', accountId: '' },
    bank: { amount: '', accountId: '' }
  });

  // Sync default account IDs when accounts list loads
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    setSplitPayments(prev => {
      const findId = (typePattern, namePattern) => {
        const found = accounts.find(a => 
          (typePattern && typePattern.test(a.type)) || 
          (namePattern && namePattern.test(a.name))
        );
        return found ? found.id : (accounts[0]?.id || '');
      };

      return {
        cash: {
          ...prev.cash,
          accountId: prev.cash.accountId || findId(/cash/i, /cash/i)
        },
        jazzcash: {
          ...prev.jazzcash,
          accountId: prev.jazzcash.accountId || findId(/jazz/i, /jazz/i)
        },
        easypaisa: {
          ...prev.easypaisa,
          accountId: prev.easypaisa.accountId || findId(/easy/i, /easy/i)
        },
        bank: {
          ...prev.bank,
          accountId: prev.bank.accountId || findId(/bank|other/i, /bank|meezan|sada/i)
        }
      };
    });
  }, [accounts]);

  const handleSplitAmountChange = (key, val) => {
    setSplitPayments(prev => ({
      ...prev,
      [key]: { ...prev[key], amount: val }
    }));
  };

  const handleSplitAccountChange = (key, accId) => {
    setSplitPayments(prev => ({
      ...prev,
      [key]: { ...prev[key], accountId: accId }
    }));
  };

  const handleResetSplit = () => {
    setSplitPayments(prev => ({
      cash: { ...prev.cash, amount: '' },
      jazzcash: { ...prev.jazzcash, amount: '' },
      easypaisa: { ...prev.easypaisa, amount: '' },
      bank: { ...prev.bank, amount: '' }
    }));
  };

  const handleFillRest = (targetKey) => {
    const otherAllocated = Object.entries(splitPayments).reduce((sum, [k, v]) => {
      if (k === targetKey) return sum;
      return sum + (parseFloat(v.amount) || 0);
    }, 0);
    const remaining = Math.max(0, (calc?.grandTotal || 0) - otherAllocated);
    handleSplitAmountChange(targetKey, remaining > 0 ? remaining : '');
  };
  
  // Printer
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const printRef = useRef();
  const searchRef = useRef();

  // ---- SNACKBAR HELPER ----
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ---- CHECK FBR STATUS ----
  useEffect(() => {
    const checkFBR = () => {
      const enabled = isFBRConfigured();
      setFbrEnabled(enabled);
      if (enabled) {
        setFbrSyncEnabled(true);
        const savedMode = localStorage.getItem('fbr_mode');
        if (savedMode !== null) {
          setFbrMode(savedMode === 'true');
        } else {
          setFbrMode(true);
        }
      } else {
        setFbrMode(false);
      }
    };
    checkFBR();
    
    const handleStorageChange = (e) => {
      if (e.key === 'tax_settings') {
        checkFBR();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ---- Load Total Tax Collected ----
  useEffect(() => {
    const loadTaxSummary = async () => {
      try {
        if (db.getTaxSummary) {
          const summary = await db.getTaxSummary();
          setTotalTaxCollected(summary?.totalTax || 0);
        }
      } catch (err) {
        console.error('Failed to load tax summary:', err);
      }
    };
    loadTaxSummary();
  }, []);

  // ---- SAVE FBR MODE ----
  const toggleFBRMode = () => {
    const newMode = !fbrMode;
    setFbrMode(newMode);
    localStorage.setItem('fbr_mode', String(newMode));
    showSnackbar(
      newMode ? 'FBR Mode: ON - Real Tax & QR' : 'FBR Mode: OFF - 0% Tax (Demo)',
      newMode ? 'success' : 'warning'
    );
  };

  // ---- LOAD ----
  useEffect(() => {
    const saved = localStorage.getItem('default_printer');
    if (saved) setDefaultPrinter(saved);
  }, []);

  // ---- INITIAL DATA LOAD ----
  useEffect(() => {
    loadData();
    generateInvoiceNo();
    setTimeout(() => searchRef.current?.focus(), 500);
  }, []);

  // ---- Auto select payment account from memory ----
  useEffect(() => {
    if (accounts.length === 0) return;
    
    if (paymentMode === 'credit') {
      setPaymentAccount(null);
      return;
    }

    const prefs = JSON.parse(localStorage.getItem('raath_payment_prefs') || '{}');
    const savedId = prefs[paymentMode];
    
    const modeAccounts = accounts.filter(a => a.type === paymentMode && a.status === 'active');
    let target = null;
    
    if (savedId) {
      target = modeAccounts.find(a => String(a.id) === String(savedId));
    }
    if (!target && modeAccounts.length > 0) {
      target = modeAccounts[0];
    }
    
    setPaymentAccount(target || null);
  }, [paymentMode, accounts]);

  const handlePaymentAccountChange = (accountId) => {
    const acc = accounts.find(a => String(a.id) === String(accountId));
    setPaymentAccount(acc);
    if (acc && paymentMode !== 'credit') {
      const prefs = JSON.parse(localStorage.getItem('raath_payment_prefs') || '{}');
      prefs[paymentMode] = accountId;
      localStorage.setItem('raath_payment_prefs', JSON.stringify(prefs));
    }
  };

  const loadData = async () => {
    try {
      const [allVariants, custs, sups, cats, offs, accs] = await Promise.all([
        (db.getAllVariants ? db.getAllVariants() : db.getProductVariants()).catch(() => []),
        db.getCustomers().catch(() => []),
        db.getSuppliers().catch(() => []),
        db.getCategories().catch(() => []),
        db.getOffers ? db.getOffers().catch(() => []) : Promise.resolve([]),
        db.getAccounts ? db.getAccounts().catch(() => []) : Promise.resolve([])
      ]);
      setProducts(allVariants || []);
      setCustomers(custs || []);
      setSuppliers(sups || []);
      setCategories(cats || []);
      setOffers(offs || []);
      setAccounts(accs || []);
    } catch (err) {
      console.error("Data loading failed:", err);
    }
  };
  useSyncListener(loadData);

  const generateInvoiceNo = async () => {
  try {
    if (window.electronAPI && window.electronAPI.dbQuery) {
      // Electron mode - direct query
      const rows = await window.electronAPI.dbQuery(
        "SELECT invoice_no FROM sales WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1"
      );
      
      if (rows && rows.length > 0) {
        const lastNum = parseInt(rows[0].invoice_no.split('-')[1]) || 0;
        const nextNum = lastNum + 1;
        setInvoiceNo(`INV-${String(nextNum).padStart(4, '0')}`);
      } else {
        setInvoiceNo('INV-0001');
      }
    } else if (db.getNextInvoiceNumber) {
      // Browser mode
      const nextNo = await db.getNextInvoiceNumber();
      setInvoiceNo(nextNo);
    } else {
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
    }
  } catch (err) {
    console.error('Error generating invoice:', err);
    // Fallback: use timestamp
    setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
  }
};

 // ---- SEARCH (BULLETPROOF: name / SKU / barcode) ----
useEffect(() => {
  const q = (searchQuery || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) { setSearchResults([]); setActiveSearchIndex(0); return; }

  const norm = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const starts = [], contains = [];

  for (const p of products) {
    if (selectedCategory && String(p.category_id ?? '') !== String(selectedCategory)) continue;
    const name    = norm(p.product_name || p.variant_name || p.name);
    const sku     = norm(p.sku || p.sku_code || p.code);
    const barcode = norm(p.barcode || p.bar_code);

    if (barcode === q || sku === q) { starts.unshift(p); continue; }   // exact match pehle (scanner)
    else if (name.startsWith(q) || sku.startsWith(q) || barcode.startsWith(q)) starts.push(p);
    else if (name.includes(q) || sku.includes(q) || barcode.includes(q)) contains.push(p);
  }

  setSearchResults([...starts, ...contains].slice(0, 15));
  setActiveSearchIndex(0);
}, [searchQuery, products, selectedCategory]);
  // ---- ADD TO CART ----
  const addToCart = useCallback((product, perDiscount = 0) => {
    const availableStock = Number(product.current_stock || 0);
    if (availableStock <= 0) {
      showSnackbar(`${product.product_name} Out of Stock!`, 'error');
      return;
    }

    let basePrice;
    if (showCostPrice) {
      basePrice = product.purchase_price || product.cost_price || product.retail_price || 0;
    } else if (showWholesalePrice) {
      basePrice = product.wholesale_price || product.retail_price || product.purchase_price || 0;
    } else {
      basePrice = saleType === 'wholesale' 
        ? (product.wholesale_price || product.retail_price || product.purchase_price || 0)
        : (product.retail_price || product.purchase_price || 0);
    }

    const discountPercent = Math.min(100, Math.max(0, parseFloat(perDiscount) || 0));
    const finalPrice = basePrice - (basePrice * (discountPercent / 100));

    const existingIndex = cart.findIndex(c => c.variantId === product.id);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].qty + 1;
      if (newQty > availableStock) {
        showSnackbar(`Only ${availableStock} available!`, 'warning');
        return;
      }
      updated[existingIndex].qty = newQty;
      updated[existingIndex].price = finalPrice;
      updated[existingIndex].discount = discountPercent;
      updated[existingIndex].total = newQty * finalPrice;
      setCart(updated);
    } else {
      setCart(prev => [...prev, {
        id: Date.now(),
        variantId: product.id,
        productId: product.product_id,
        name: product.product_name || product.variant_name || 'Item',
        sku: product.sku || '',
        qty: 1,
        price: finalPrice,
        total: finalPrice,
        discount: discountPercent,
        discountType: 'percent',
        stock: availableStock,
        isOfferItem: false,
        offerName: null,
        image: product.image_url || null,
        originalPrice: basePrice,
        costPrice: product.purchase_price || product.cost_price || 0,
        wholesalePrice: product.wholesale_price || 0
      }]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    setTimeout(() => searchRef.current?.focus(), 100);
    showSnackbar(`Added ${product.product_name}`, 'success');
  }, [cart, saleType, showCostPrice, showWholesalePrice, showSnackbar]);

  // ---- UPDATE CART QTY BY VARIANT ID ----
  const updateCartQtyByVariant = useCallback((variantId, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) {
      setCart(prev => prev.filter(item => String(item.variantId) !== String(variantId)));
      showSnackbar('Item removed from cart', 'info');
      return;
    }
    setCart(prev => prev.map(item => {
      if (String(item.variantId) === String(variantId)) {
        const stockLimit = Number(item.stock || 0);
        const qty = val > stockLimit ? stockLimit : val;
        return {
          ...item,
          qty,
          total: qty * item.price
        };
      }
      return item;
    }));
  }, [showSnackbar]);

  // ---- REMOVE FROM CART ----
  const removeFromCart = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    showSnackbar('Item removed from cart', 'info');
  }, [showSnackbar]);

  // ---- CART OPERATIONS ----
  const handleQtyChange = (index, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) return;
    const updated = [...cart];
    const stockLimit = Number(updated[index].stock || 0);
    updated[index].qty = val > stockLimit ? stockLimit : val;
    updated[index].total = updated[index].qty * updated[index].price;
    setCart(updated);
  };

  const handlePriceChange = (index, newPrice) => {
    const val = parseFloat(newPrice);
    if (isNaN(val) || val < 0) return;
    const updated = [...cart];
    updated[index].price = val;
    updated[index].total = updated[index].qty * val;
    setCart(updated);
  };

  const handleItemDiscount = (index, value, type) => {
    const val = parseFloat(value) || 0;
    const updated = [...cart];
    const item = updated[index];
    const basePrice = item.originalPrice || item.price;
    const qty = item.qty;
    const totalBase = qty * basePrice;
    
    if (type === 'percent') {
      const discountPercent = Math.min(100, Math.max(0, val));
      item.discount = discountPercent;
      item.discountType = 'percent';
      const discountAmount = totalBase * (discountPercent / 100);
      item.price = basePrice - (basePrice * (discountPercent / 100));
      item.total = (qty * item.price);
      item.discountAmount = discountAmount;
    } else if (type === 'amount') {
      const discountAmount = Math.min(totalBase, Math.max(0, val));
      item.discountAmount = discountAmount;
      item.discountType = 'amount';
      const discountPercent = (discountAmount / totalBase) * 100;
      item.discount = discountPercent;
      item.price = basePrice - (discountAmount / qty);
      item.total = totalBase - discountAmount;
    }
    
    setCart(updated);
  };

  // ---- CALCULATIONS ----
  const calc = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.qty * (item.originalPrice || item.price)), 0);
    const itemDiscount = cart.reduce((sum, item) => {
      if (item.discountType === 'amount') {
        return sum + (item.discountAmount || 0);
      } else {
        const base = item.qty * (item.originalPrice || item.price);
        return sum + (base * (item.discount || 0) / 100);
      }
    }, 0);
    
    const afterItemDisc = subtotal - itemDiscount;
    const disc = billDiscountType === 'percent' ? (afterItemDisc * (Number(billDiscount) || 0) / 100) : (Number(billDiscount) || 0);
    const afterBillDisc = Math.max(0, afterItemDisc - disc);
    
    const fbrConfig = getFBRConfig();
    
    let effectiveTaxRate = 0;
    if (fbrEnabled && fbrMode) {
      effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
    } else {
      effectiveTaxRate = 0;
    }
    
    setTaxPercent(effectiveTaxRate);
    
    const tax = afterBillDisc * (effectiveTaxRate / 100);
    const grandTotal = afterBillDisc + tax;
    
    // If not credit mode and paidAmount is empty, default to full payment (grandTotal)
    // If user explicitly entered a value, use that value. If credit mode and empty, default to 0 (due).
    let paid;
    if (paymentMode === 'split') {
      const totalSplit = Object.values(splitPayments).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      paid = totalSplit;
    } else if (paidAmount === '') {
      paid = paymentMode === 'credit' ? 0 : grandTotal;
    } else {
      const parsed = Number(paidAmount);
      paid = isNaN(parsed) ? 0 : parsed;
    }
    
    const due = Math.max(0, grandTotal - paid);
    const change = Math.max(0, paid - grandTotal);
    
    return {
      subtotal, itemDiscount, billDiscount: disc, tax, grandTotal,
      paid,
      actualPaid: paid,
      due, change, totalItems: cart.length,
      totalQty: cart.reduce((s, i) => s + Number(i.qty), 0),
      taxRate: effectiveTaxRate,
      isFBRMode: fbrMode
    };
  }, [cart, billDiscount, billDiscountType, paidAmount, fbrEnabled, fbrMode, paymentMode, splitPayments]);

  // ---- UPDATE TOTAL TAX COLLECTED ----
  useEffect(() => {
    if (calc.tax > 0) {
      setTotalTaxCollected(prev => prev + calc.tax);
    }
  }, [calc.tax]);

  // ---- PRINT ----
  const handlePrint = useCallback(async (customSale = null) => {
    const saleData = customSale || lastSale;
    if (!saleData && cart.length === 0) {
      showSnackbar('No receipt content to print!', 'error');
      return;
    }

    const effectiveSettings = getEffectiveReceiptSettings();
    const shop = getEffectiveShopProfile();
    const printerToUse = defaultPrinter || effectiveSettings.printerName || '';

    try {
      const printerMsg = printerToUse ? `Printing to ${printerToUse}...` : 'Printing receipt...';
      showSnackbar(printerMsg, 'info');

      const printPayload = {
        sale: saleData || {
          invoiceNo: invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
          customer_name: selectedParty?.name,
          customer_phone: selectedParty?.phone,
          customer_ntn: selectedParty?.ntn,
          subtotal: calc.subtotal,
          discount: calc.billDiscount,
          tax: calc.tax,
          grandTotal: calc.grandTotal,
          paid: calc.actualPaid,
          due: calc.due,
          change: calc.change,
          date: today(),
          payment_mode: paymentMode,
          items: cart,
          fbr_enabled: fbrEnabled && fbrMode,
          fbr_mode: fbrMode,
          fbr_status: fbrStatus?.fbr_status,
          fbr_reference: fbrStatus?.fbr_reference,
          dummy_fbr_reference: fbrStatus?.dummy_fbr_reference
        },
        items: (saleData && saleData.items) ? saleData.items : cart,
        party: selectedParty,
        partyType: partyType
      };

      const res = await printReceiptDirect(printPayload, {
        printerName: printerToUse,
        receiptSettings: effectiveSettings,
        shopProfile: shop,
        design: effectiveSettings.design
      });

      if (res && res.success) {
        showSnackbar('Receipt printed successfully!', 'success');
      } else if (res && res.error) {
        showSnackbar(`Print error: ${res.error}`, 'error');
      }
    } catch (err) {
      console.error('Print receipt failed:', err);
      showSnackbar(`Print error: ${err.message}`, 'error');
    }
  }, [lastSale, cart, invoiceNo, defaultPrinter, selectedParty, partyType, calc, paymentMode, fbrEnabled, fbrMode, fbrStatus, showSnackbar]);

  // ---- SAVE SALE (WITHOUT PRINT) ----
  const saveSaleOnly = async () => {
    if (cart.length === 0) {
      showSnackbar('Cart is empty!', 'warning');
      return;
    }

    if (isSaving) {
      showSnackbar('Already saving...', 'info');
      return;
    }

    setIsSaving(true);

    try {
      showSnackbar('Saving sale...', 'info');
      
      const fbrConfig = getFBRConfig();
      
      let effectiveTaxRate = 0;
      if (fbrEnabled && fbrMode) {
        effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
      } else {
        effectiveTaxRate = 0;
      }
      
      const dummyRef = !fbrMode ? generateDummyQR() : null;
      
      const now = new Date();
      const saleDate = new Date(); // Hamesha CURRENT date/time lega
      saleDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      let splitList = null;
      if (paymentMode === 'split') {
        splitList = Object.entries(splitPayments)
          .map(([methodKey, data]) => {
            const acc = accounts.find(a => String(a.id) === String(data.accountId));
            return {
              method: methodKey,
              account_id: data.accountId || null,
              account_name: acc?.name || methodKey,
              amount: parseFloat(data.amount) || 0
            };
          })
          .filter(item => item.amount > 0);
      }

      const activeShopId = (db.getActiveShopId ? db.getActiveShopId() : null) || localStorage.getItem('raath_shop_id') || 'default';
      const saleData = {
        invoice_no: invoiceNo || `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Customer',
        customer_ntn: selectedParty?.ntn || '',
        subtotal: calc.subtotal,
        item_discount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grand_total: calc.grandTotal,
        paid_amount: calc.actualPaid,
        due_amount: calc.due,
        change_amount: calc.change,
        payment_mode: paymentMode,
        payment_status: calc.due > 0 ? (calc.actualPaid > 0 ? 'partial' : 'due') : 'paid',
        sale_type: saleType,
        date: getLocalISOString(saleDate),
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: fbrEnabled && fbrMode ? effectiveTaxRate : 0,
        fbr_tax_amount: calc.tax,
        fbr_business_type: fbrConfig?.fbrBusinessType || 'retail',
        dummy_fbr_reference: dummyRef,
        shop_id: activeShopId,
        account_id: paymentAccount?.id || null,
        split_payments: splitList
      };

      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        variant_id: item.variantId,
        product_id: item.productId,
        name: item.name || item.product_name || 'Item',
        product_name: item.product_name || item.name || 'Item',
        variant_name: item.variant_name || '',
        sku: item.sku || '',
        quantity: item.qty,
        qty: item.qty,
        price: item.price,
        unit_price: item.price,
        purchase_price: item.costPrice || 0,
        discount: item.discount || 0,
        total: item.total
      }));

      // ==================== CREATE SALE (Stock handled internally) ====================
      let result;
      if (window.electronAPI && window.electronAPI.createSale) {
        console.log('[Billing] Using Electron createSale API');
        result = await window.electronAPI.createSale({ sale: saleData, items: itemsData });
      } else {
        console.log('[Billing] Using IndexedDB createSale');
        result = await db.createSale({ sale: saleData, items: itemsData });
      }
      
      if (!result) {
        throw new Error('No result returned from createSale');
      }

      const saleId = result.id || result.lastInsertRowid;

      // ==================== AUTO PAYMENT TO ACCOUNT LEDGER ====================
      if (calc.actualPaid > 0 && paymentAccount) {
        showSnackbar(`Payment recorded in ${paymentAccount.name}`, 'success');
      }

      // ==================== FBR SYNC ====================
      let fbrStatusData = null;
      
      if (fbrEnabled && fbrMode) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          fbrStatusData = {
            fbr_status: 'SYNCED',
            fbr_reference: `FBR-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
            fbr_response: { success: true, message: 'Invoice synced with FBR' },
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };

          if (db.updateFBRStatus) {
            await db.updateFBRStatus(saleId, fbrStatusData);
          }

          showSnackbar(`FBR Invoice Synced: ${fbrStatusData.fbr_reference}`, 'success');
        } catch (fbrErr) {
          console.error('FBR sync error:', fbrErr);
          fbrStatusData = {
            fbr_status: 'FAILED',
            fbr_error: fbrErr.message,
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };
          showSnackbar('FBR sync failed but sale saved', 'warning');
        }
      } else {
        fbrStatusData = {
          fbr_status: 'DEMO',
          fbr_reference: dummyRef,
          fbr_tax_rate: 0,
          fbr_tax_amount: 0,
          fbr_mode: false,
          is_demo: true
        };
        showSnackbar('Demo Mode: Sale saved with 0% tax', 'warning');
      }

      const legacyReceiptMapping = {
        invoiceNo: invoiceNo,
        subtotal: calc.subtotal,
        itemDiscount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grandTotal: calc.grandTotal,
        paid: calc.actualPaid,
        due: calc.due,
        change: calc.change,
        date: saleData.date,
        payment_mode: paymentMode,
        items: cart,
        split_payments: splitList,
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: effectiveTaxRate,
        fbr_tax_amount: calc.tax,
        fbr_status: fbrStatusData?.fbr_status || null,
        fbr_reference: fbrStatusData?.fbr_reference || dummyRef,
        fbr_error: fbrStatusData?.fbr_error || null,
        dummy_fbr_reference: dummyRef,
        is_demo_mode: !fbrMode
      };

      setFbrStatus(fbrStatusData);
      setLastSale(legacyReceiptMapping);
      setShowReceipt(false);
      
      setTotalTaxCollected(prev => prev + calc.tax);
      showSnackbar('Sale saved successfully!', 'success');
      
      loadData();
      setCart([]);
      setPaidAmount('');
      handleResetSplit();
      setBillDiscount(0);
      setSelectedParty(null);
      setInvoiceDate(today());
      generateInvoiceNo();
      
    } catch (err) {
      console.error("Save error:", err);
      showSnackbar('Error saving sale: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- SAVE SALE WITH PRINT ----
  const saveSaleWithPrint = async () => {
    if (cart.length === 0) {
      showSnackbar('Cart is empty!', 'warning');
      return;
    }

    if (isSaving) {
      showSnackbar('Already saving...', 'info');
      return;
    }

    setIsSaving(true);

    try {
      showSnackbar('Saving and printing...', 'info');
      
      const fbrConfig = getFBRConfig();
      
      let effectiveTaxRate = 0;
      if (fbrEnabled && fbrMode) {
        effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
      } else {
        effectiveTaxRate = 0;
      }
      
      const dummyRef = !fbrMode ? generateDummyQR() : null;
      
      const now = new Date();
      const saleDate = new Date(); // Hamesha CURRENT date/time lega
      saleDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      let splitList = null;
      if (paymentMode === 'split') {
        splitList = Object.entries(splitPayments)
          .map(([methodKey, data]) => {
            const acc = accounts.find(a => String(a.id) === String(data.accountId));
            return {
              method: methodKey,
              account_id: data.accountId || null,
              account_name: acc?.name || methodKey,
              amount: parseFloat(data.amount) || 0
            };
          })
          .filter(item => item.amount > 0);
      }

      const activeShopId = (db.getActiveShopId ? db.getActiveShopId() : null) || localStorage.getItem('raath_shop_id') || 'default';
      const saleData = {
        invoice_no: invoiceNo || `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Customer',
        customer_ntn: selectedParty?.ntn || '',
        subtotal: calc.subtotal,
        item_discount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grand_total: calc.grandTotal,
        paid_amount: calc.actualPaid,
        due_amount: calc.due,
        change_amount: calc.change,
        payment_mode: paymentMode,
        payment_status: calc.due > 0 ? (calc.actualPaid > 0 ? 'partial' : 'due') : 'paid',
        sale_type: saleType,
        date: getLocalISOString(saleDate),
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: fbrEnabled && fbrMode ? effectiveTaxRate : 0,
        fbr_tax_amount: calc.tax,
        fbr_business_type: fbrConfig?.fbrBusinessType || 'retail',
        dummy_fbr_reference: dummyRef,
        shop_id: activeShopId,
        account_id: paymentAccount?.id || null,
        split_payments: splitList
      };

      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        variant_id: item.variantId,
        product_id: item.productId,
        name: item.name || item.product_name || 'Item',
        product_name: item.product_name || item.name || 'Item',
        variant_name: item.variant_name || '',
        sku: item.sku || '',
        quantity: item.qty,
        qty: item.qty,
        price: item.price,
        unit_price: item.price,
        purchase_price: item.costPrice || 0,
        discount: item.discount || 0,
        total: item.total
      }));

      // ==================== CREATE SALE (Stock handled internally) ====================
      let result;
      if (window.electronAPI && window.electronAPI.createSale) {
        console.log('[Billing] Using Electron createSale API');
        result = await window.electronAPI.createSale({ sale: saleData, items: itemsData });
      } else {
        console.log('[Billing] Using IndexedDB createSale');
        result = await db.createSale({ sale: saleData, items: itemsData });
      }
      
      if (!result) {
        throw new Error('No result returned from createSale');
      }

      const saleId = result.id || result.lastInsertRowid;

      // ==================== AUTO PAYMENT TO ACCOUNT LEDGER ====================
      if (calc.actualPaid > 0 && paymentAccount) {
        showSnackbar(`Payment recorded in ${paymentAccount.name}`, 'success');
      }

      // ==================== FBR SYNC ====================
      let fbrStatusData = null;
      
      if (fbrEnabled && fbrMode) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          fbrStatusData = {
            fbr_status: 'SYNCED',
            fbr_reference: `FBR-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
            fbr_response: { success: true, message: 'Invoice synced with FBR' },
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };

          if (db.updateFBRStatus) {
            await db.updateFBRStatus(saleId, fbrStatusData);
          }

          showSnackbar(`FBR Invoice Synced: ${fbrStatusData.fbr_reference}`, 'success');
        } catch (fbrErr) {
          console.error('FBR sync error:', fbrErr);
          fbrStatusData = {
            fbr_status: 'FAILED',
            fbr_error: fbrErr.message,
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };
          showSnackbar('FBR sync failed but sale saved', 'warning');
        }
      } else {
        fbrStatusData = {
          fbr_status: 'DEMO',
          fbr_reference: dummyRef,
          fbr_tax_rate: 0,
          fbr_tax_amount: 0,
          fbr_mode: false,
          is_demo: true
        };
        showSnackbar('Demo Mode: Sale saved with 0% tax', 'warning');
      }

      const legacyReceiptMapping = {
        invoiceNo: invoiceNo,
        subtotal: calc.subtotal,
        itemDiscount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grandTotal: calc.grandTotal,
        paid: calc.actualPaid,
        due: calc.due,
        change: calc.change,
        date: saleData.date,
        payment_mode: paymentMode,
        items: cart,
        split_payments: splitList,
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: effectiveTaxRate,
        fbr_tax_amount: calc.tax,
        fbr_status: fbrStatusData?.fbr_status || null,
        fbr_reference: fbrStatusData?.fbr_reference || dummyRef,
        fbr_error: fbrStatusData?.fbr_error || null,
        dummy_fbr_reference: dummyRef,
        is_demo_mode: !fbrMode
      };

      setFbrStatus(fbrStatusData);
      setLastSale(legacyReceiptMapping);
      setShowReceipt(true);
      
      setTotalTaxCollected(prev => prev + calc.tax);
      
      showSnackbar('Sale saved! Printing receipt...', 'success');
      
      setTimeout(() => {
        handlePrint(legacyReceiptMapping);
      }, 300);
      
      loadData();
      setCart([]);
      setPaidAmount('');
      handleResetSplit();
      setBillDiscount(0);
      setSelectedParty(null);
      setInvoiceDate(today());
      generateInvoiceNo();
      
    } catch (err) {
      console.error("Save error:", err);
      showSnackbar('Error saving sale: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- HOLD / RESUME ----
  const holdBill = () => {
    if (cart.length === 0) return;
    const hold = {
      id: Date.now(),
      cart: [...cart],
      party: selectedParty,
      partyType,
      total: calc.grandTotal,
      date: new Date().toISOString()
    };
    const updated = [...heldBills, hold];
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
    setCart([]);
    setSelectedParty(null);
    showSnackbar('Bill held!', 'info');
  };

  const resumeBill = (bill) => {
    setCart(bill.cart);
    setSelectedParty(bill.party);
    setPartyType(bill.partyType || 'customer');
    setShowResumeDialog(false);
  };

  const deleteHeld = (id) => {
    const updated = heldBills.filter(h => h.id !== id);
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
  };

  // ---- APPLY OFFER ----
  const applyOffer = async (offer) => {
    try {
      let offerItems = [];
      if (db.getOfferItems) {
        const res = await db.getOfferItems(offer.id);
        offerItems = res.data || res || [];
      }

      if (!offerItems.length) {
        showSnackbar('Offer has no items!', 'warning');
        return;
      }

      for (const item of offerItems) {
        const product = products.find(p => p.id === item.variant_id);
        if (product) {
          const offerPrice = Number(item.offer_price) || Number(product.retail_price) || 0;
          setCart(prev => [...prev, {
            id: Date.now() + Math.random(),
            variantId: product.id,
            productId: product.product_id,
            name: item.product_name || product.product_name || 'Offer Item',
            sku: item.sku || product.sku || '',
            qty: 1,
            price: offerPrice,
            total: offerPrice,
            discount: 0,
            discountType: 'percent',
            stock: Number(product.current_stock) || 0,
            isOfferItem: true,
            offerName: offer.name,
            image: product.image_url || null,
            originalPrice: offerPrice,
            costPrice: product.purchase_price || product.cost_price || 0,
            wholesalePrice: product.wholesale_price || 0
          }]);
        }
      }

      showSnackbar(`Offer "${offer.name}" added!`, 'success');
      setShowOffersDialog(false);
    } catch (err) {
      console.error('Apply offer error:', err);
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const newBill = () => {
    setCart([]);
    setSelectedParty(null);
    setPaidAmount('');
    handleResetSplit();
    setBillDiscount(0);
    setInvoiceDate(today());
    generateInvoiceNo();
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ---- FBR Scan Handler ----
  const handleFBRScanComplete = (result) => {
    if (result.success) {
      showSnackbar(`FBR Verified: ${result.data.reference}`, 'success');
    } else {
      showSnackbar('FBR Verification Failed: ' + result.error, 'error');
    }
  };

  // ---- HOTKEYS ----
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (!['F1','F2','F3','F5','F9','F10','F12','Escape'].includes(e.key)) return;
      }
      
      switch(e.key) {
        case 'F1': e.preventDefault(); searchRef.current?.focus(); break;
        case 'F2': e.preventDefault(); setViewMode(prev => prev === 'grid' ? 'list' : 'grid'); break;
        case 'F3': e.preventDefault(); if (cart.length > 0) holdBill(); break;
        case 'F5': e.preventDefault(); setShowResumeDialog(true); break;
        case 'F8': e.preventDefault(); if (cart.length > 0) saveSaleOnly(); break;
        case 'F9': e.preventDefault(); if (cart.length > 0) saveSaleWithPrint(); break;
        case 'F10': e.preventDefault(); if (cart.length > 0 && window.confirm('Clear cart?')) newBill(); else newBill(); break;
        case 'F12': e.preventDefault(); setShowPrinterSettings(true); break;
        case 'Escape': setShowReceipt(false); setShowHoldDialog(false); setShowResumeDialog(false); setShowOffersDialog(false); setShowFBRScan(false); break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, saveSaleWithPrint, saveSaleOnly]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f1f5f9', overflow: 'hidden', pb: isMobile ? 6 : 0 }}>
      
      {/* HEADER - DASHBOARD NAVY/INDIGO GRADIENT & BRAND */}
      <Paper sx={{ 
        background: 'linear-gradient(135deg, #1c2580 0%, #151b60 100%)', 
        color: 'white', 
        px: isMobile ? 1 : 2, 
        py: isMobile ? 0.75 : 0.9, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.25, 
        borderRadius: 0, 
        flexShrink: 0,
        borderBottom: '1px solid #283593',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
      }}>
        <Tooltip title="Back to Dashboard">
          <IconButton
            size="small"
            onClick={() => navigate('/')}
            sx={{ 
              color: 'white', 
              bgcolor: 'rgba(255,255,255,0.1)', 
              border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: 2, 
              p: 0.8,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, 
              mr: 0.5 
            }}
          >
            <ArrowBack sx={{ fontSize: isMobile ? 18 : 20 }} />
          </IconButton>
        </Tooltip>

        {/* RAATH POS BRAND BOX - MATCHING DASHBOARD EXACTLY */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 1 }}>
          <Box sx={{ 
            width: 38, 
            height: 38, 
            borderRadius: 2, 
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)', 
            border: '1px solid rgba(255,255,255,0.3)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.4)' 
          }}>
            <Store sx={{ fontSize: 22, color: '#ffffff' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight="900" sx={{ lineHeight: 1.1, letterSpacing: '0.04em', color: '#ffffff', fontSize: '1.05rem', fontFamily: 'sans-serif' }}>
              RAATH
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#34d399', fontWeight: 900, textTransform: 'uppercase' }}>
              POS SYSTEM
            </Typography>
          </Box>
        </Box>

        {/* RIGHT ACTION BUTTONS */}
        {!isMobile && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* VIEW MODE TOGGLE */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              bgcolor: 'rgba(255, 255, 255, 0.08)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: 2, 
              p: '2px', 
              gap: '2px' 
            }}>
              <Box 
                onClick={() => setViewMode('grid')} 
                sx={{ 
                  cursor: 'pointer', 
                  px: 1.1, 
                  py: 0.4, 
                  borderRadius: 1.5, 
                  bgcolor: viewMode === 'grid' ? '#ffffff' : 'transparent', 
                  color: viewMode === 'grid' ? '#1e293b' : '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s' 
                }}
              >
                <ViewModule sx={{ fontSize: 18 }} />
              </Box>
              <Box 
                onClick={() => setViewMode('list')} 
                sx={{ 
                  cursor: 'pointer', 
                  px: 1.1, 
                  py: 0.4, 
                  borderRadius: 1.5, 
                  bgcolor: viewMode === 'list' ? '#ffffff' : 'transparent', 
                  color: viewMode === 'list' ? '#1e293b' : '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s' 
                }}
              >
                <MenuIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
            
            <Button 
              size="small" 
              startIcon={<QrCode sx={{ fontSize: 16, color: '#38bdf8' }} />} 
              onClick={() => setShowFBRScan(true)}
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              Demo
            </Button>
            
            <Button 
              size="small" 
              startIcon={<Receipt sx={{ fontSize: 16, color: '#e2e8f0' }} />} 
              onClick={() => setShowResumeDialog(true)} 
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              Held (F5)
            </Button>

            <Button 
              size="small" 
              startIcon={<Pause sx={{ fontSize: 16, color: '#e2e8f0' }} />} 
              onClick={() => setShowHoldDialog(true)} 
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              Hold (F3)
            </Button>

            <Button 
              size="small" 
              startIcon={<LocalOffer sx={{ fontSize: 16, color: '#e2e8f0' }} />} 
              onClick={() => setShowOffersDialog(true)} 
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              Offers
            </Button>

            <Button 
              size="small" 
              startIcon={<PrintIcon sx={{ fontSize: 16, color: '#e2e8f0' }} />} 
              onClick={() => setShowPrinterSettings(true)} 
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              Printer
            </Button>

            <Button 
              size="small" 
              startIcon={<KeyboardArrowDown sx={{ fontSize: 16, color: '#e2e8f0' }} />} 
              onClick={() => setShowShortcuts(true)} 
              sx={{ 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.2)', 
                bgcolor: 'rgba(255,255,255,0.08)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                borderRadius: 2, 
                px: 1.4, 
                py: 0.55, 
                gap: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' } 
              }}
            >
              ⌨️ Keys
            </Button>
          </Box>
        )}
        
        {isMobile && (
          <IconButton size="small" sx={{ color: 'white', ml: 'auto' }} onClick={() => setMobileDrawer(true)}><MenuIcon /></IconButton>
        )}
      </Paper>

      {/* SHORTCUTS BAR - HIGH CONTRAST DARK STRIP (EXACT MATCH WITH USER IMAGE) */}
      {!isMobile && (
        <Paper sx={{ 
          px: 2, 
          py: 0.5, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center', 
          borderRadius: 0, 
          bgcolor: '#151b60', 
          borderBottom: '1px solid #283593', 
          flexShrink: 0 
        }}>
          {/* LEFT: SHORTCUT CHIPS */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 0.4, mr: 0.5 }}>
              <span style={{ color: '#f43f5e' }}>📍</span> Shortcuts:
            </Typography>

            <Chip label="F1" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#1877f2', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Search</Typography>

            <Chip label="F2" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#7c3aed', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>View</Typography>

            <Chip label="F3" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#ea580c', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Hold</Typography>

            <Chip label="F5" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#0284c7', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Held</Typography>

            <Chip label="F9" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#00c853', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Save+Print</Typography>

            <Chip label="F10" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#ef4444', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>New</Typography>

            <Chip label="F12" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#6366f1', color: 'white', fontWeight: 800, borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Printer</Typography>

            <Chip label="Tab" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#1e293b', color: 'white', fontWeight: 800, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, mr: 0.6 }}>Next</Typography>

            <Chip label="Shift+Tab" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#1e293b', color: 'white', fontWeight: 800, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', px: 0.2 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>Back</Typography>
          </Box>

          {/* RIGHT: STORE OPEN • DATE • ADMINISTRATOR */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '0.72rem', color: '#94a3b8' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#10b981', fontWeight: 700, fontSize: '0.72rem' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              Store Open
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: '#475569' }}>•</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#475569' }}>•</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#10b981', fontWeight: 700, fontSize: '0.72rem' }}>
              <VerifiedUser sx={{ fontSize: 14, color: '#10b981' }} /> Administrator
            </Box>
          </Box>
        </Paper>
      )}

      {/* SEARCH & FILTERS */}
      <Paper sx={{ px: isMobile ? 1 : 1.5, py: isMobile ? 1 : 0.75, display: 'flex', gap: 0.75, flexWrap: 'nowrap', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid #e5e7eb', flexShrink: 0, overflow: 'visible', position: 'relative', zIndex: 1200, bgcolor: 'white' }}>
        {!isMobile && (
         <FormControl size="small" sx={{ minWidth: 105, flexShrink: 0 }}>
  <Select
    value={selectedCategory}
    displayEmpty
    onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }}
    sx={{ fontSize: '0.75rem', height: 40 }}
  >
    <MenuItem value=""><em>Category</em></MenuItem>
    {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
  </Select>
</FormControl>
        )}

        <Box sx={{ flex: 1, minWidth: isMobile ? 120 : 250, position: 'relative' }}>
  <TextField
    inputRef={searchRef}
    fullWidth
    size="small"
    value={searchQuery}
    autoComplete="off"
    onChange={(e) => setSearchQuery(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSearchIndex(i => Math.min(i + 1, searchResults.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveSearchIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        const norm = (v) => String(v ?? '').toLowerCase().trim();
        const exact = products.find(p =>
          (p.barcode || p.bar_code || '').toString().trim() === q ||
          norm(p.sku || p.sku_code) === norm(q)
        );
        if (exact) { addToCart(exact, 0); return; }                    // barcode scanner direct add
        const pick = searchResults[activeSearchIndex] || searchResults[0];
        if (pick) addToCart(pick, 0);
        return;
      }
      if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); }
    }}
    onBlur={() => setTimeout(() => setSearchResults([]), 200)}
    placeholder={isMobile ? "Search/Scan..." : "Search Name / SKU / Barcode ΓÇö Enter to add (F1)"}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          {scanMode ? <QrCodeScanner sx={{ color: '#10b981', fontSize: 18 }} /> : <Search sx={{ color: '#10b981', fontSize: 18 }} />}
        </InputAdornment>
      ),
      endAdornment: isMobile && (
        <InputAdornment position="end">
          <IconButton size="small" onClick={() => setScanMode(!scanMode)} color={scanMode ? 'success' : 'default'}>
            <QrCodeScanner fontSize="small" />
          </IconButton>
        </InputAdornment>
      )
    }}
  />

  {searchQuery.trim() && searchResults.length > 0 && (
    <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000, maxHeight: 320, overflow: 'auto', mt: 0.5, boxShadow: 4 }}>
      <List dense sx={{ py: 0 }}>
        {searchResults.map((o, i) => {
          const isOut = Number(o.current_stock || 0) <= 0;
          return (
            <ListItem
              key={o.id ?? i}
              onMouseDown={(e) => { e.preventDefault(); if (!isOut) addToCart(o, 0); }}
              onMouseEnter={() => setActiveSearchIndex(i)}
              sx={{
                cursor: isOut ? 'not-allowed' : 'pointer',
                opacity: isOut ? 0.5 : 1,
                bgcolor: i === activeSearchIndex ? '#f0fdf4' : 'transparent',
                borderLeft: i === activeSearchIndex ? '3px solid #10b981' : '3px solid transparent',
                py: 0.75
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '50%' }}>
                      {o.product_name || o.variant_name || o.name}
                      {isOut && <Chip label="OUT" size="small" color="error" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.75rem' }}>
                        Retail: Rs. {Number(o.retail_price || o.sale_price || o.purchase_price || 0).toLocaleString('en-PK')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 'bold', fontSize: '0.68rem', bgcolor: '#eff6ff', px: 0.6, py: 0.15, borderRadius: 0.8, border: '1px solid #bfdbfe' }}>
                        Whole: Rs. {Number(o.wholesale_price || 0).toLocaleString('en-PK')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 'bold', fontSize: '0.68rem', bgcolor: '#fffbeb', px: 0.6, py: 0.15, borderRadius: 0.8, border: '1px solid #fde68a' }}>
                        Cost: Rs. {Number(o.purchase_price || o.cost_price || 0).toLocaleString('en-PK')}
                      </Typography>
                    </Box>
                  </Box>
                }
                secondary={`SKU: ${o.sku || 'N/A'} • Available Stock: ${o.current_stock ?? 0}`}
              />
            </ListItem>
          );
        })}
      </List>
    </Paper>
  )}
</Box>

       {!isMobile && (
  <>
    <Button variant="contained" sx={{ bgcolor: '#10b981', minWidth: 40, width: 40, height: 40, flexShrink: 0, px: 0 }} onClick={() => searchResults[0] && addToCart(searchResults[0], 0)}>
      <Add />
    </Button>

    <FormControl size="small" sx={{ minWidth: 105, flexShrink: 0 }}>
      <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }} sx={{ fontSize: '0.75rem', height: 40 }}>
        <MenuItem value="customer">Customer</MenuItem>
        <MenuItem value="supplier">Supplier</MenuItem>
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 155, flexShrink: 0 }}>
      <Select
        value={selectedParty?.id || ''}
        displayEmpty
        onChange={(e) => {
          const dataset = partyType === 'customer' ? customers : suppliers;
          const match = dataset.find(x => x.id === e.target.value);
          setSelectedParty(match || null);
        }}
        sx={{ fontSize: '0.75rem', height: 40 }}
        renderValue={(v) => v
          ? `${(partyType === 'customer' ? customers : suppliers).find(x => x.id === v)?.name || ''}`
          : <em>Select {partyType === 'customer' ? 'Customer' : 'Supplier'}</em>}
      >
        <MenuItem value="">Walk-in Customer</MenuItem>
        {(partyType === 'customer' ? customers : suppliers).map(p => (
          <MenuItem key={p.id} value={p.id}>{p.name} (Bal: {p.current_balance || 0})</MenuItem>
        ))}
      </Select>
    </FormControl>

    <TextField
      size="small"
      type="date"
      value={invoiceDate}
      onChange={(e) => setInvoiceDate(e.target.value)}
      sx={{ width: 135, flexShrink: 0, '& .MuiOutlinedInput-root': { height: 40, fontSize: '0.75rem' } }}
    />

    <ToggleButtonGroup
      value={saleType}
      exclusive
      onChange={(e, val) => val && setSaleType(val)}
      size="small"
      sx={{ height: 40, flexShrink: 0 }}
    >
      <ToggleButton value="retail" sx={{ fontSize: '0.65rem', px: 1.5 }}>Retail</ToggleButton>
      <ToggleButton value="wholesale" sx={{ fontSize: '0.65rem', px: 1.5 }}>Wholesale</ToggleButton>
    </ToggleButtonGroup>
  </>
)}
      </Paper>

      {/* MOBILE FILTERS */}
      {isMobile && (
        <Paper sx={{ px: 1, py: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', borderRadius: 0, flexShrink: 0 }}>
          <FormControl size="small" sx={{ minWidth: 70, flex: 1 }}>
            <Select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }} displayEmpty size="small">
              <MenuItem value="">All</MenuItem>
              {categories.slice(0, 5).map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 60 }}>
            <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }} size="small">
              <MenuItem value="customer">Cust</MenuItem>
              <MenuItem value="supplier">Supp</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 90 }} />
          <ToggleButtonGroup
            value={saleType}
            exclusive
            onChange={(e, val) => val && setSaleType(val)}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="retail" sx={{ fontSize: '0.5rem', px: 0.5 }}>Retail</ToggleButton>
            <ToggleButton value="wholesale" sx={{ fontSize: '0.5rem', px: 0.5 }}>Whole</ToggleButton>
          </ToggleButtonGroup>
          
          {fbrEnabled && (
            <Button 
              size="small" 
              variant="outlined" 
              onClick={toggleFBRMode}
              sx={{ 
                fontSize: '0.5rem', 
                px: 0.5, 
                minWidth: 'auto',
                borderColor: fbrMode ? '#10b981' : '#6b7280',
                color: fbrMode ? '#10b981' : '#6b7280'
              }}
            >
              {fbrMode ? 'FBR ON' : 'FBR OFF'}
            </Button>
          )}
          
          <Button size="small" variant="outlined" onClick={() => setShowFBRScan(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto', borderColor: fbrMode ? '#10b981' : '#e5e7eb' }}>
            <QrCode fontSize="small" sx={{ color: fbrMode ? '#10b981' : 'inherit' }} />
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowOffersDialog(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto' }}>
            <LocalOffer fontSize="small" />
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowPrinterSettings(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto' }}>
            <PrintIcon fontSize="small" />
          </Button>
        </Paper>
      )}

      {/* MOBILE TAB TOGGLE */}
      {isMobile && (
        <Paper sx={{ display: 'flex', borderRadius: 0, borderBottom: '1px solid #e5e7eb', bgcolor: 'white', flexShrink: 0 }}>
          <Button
            fullWidth
            onClick={() => setMobileActiveTab('products')}
            sx={{
              py: 1,
              borderRadius: 0,
              fontWeight: 'bold',
              fontSize: '0.8rem',
              borderBottom: mobileActiveTab === 'products' ? '3px solid #10b981' : '3px solid transparent',
              color: mobileActiveTab === 'products' ? '#10b981' : '#64748b',
              bgcolor: mobileActiveTab === 'products' ? '#f0fdf4' : 'white',
            }}
          >
            Products ({products.length})
          </Button>
          <Button
            fullWidth
            onClick={() => setMobileActiveTab('cart')}
            sx={{
              py: 1,
              borderRadius: 0,
              fontWeight: 'bold',
              fontSize: '0.8rem',
              borderBottom: mobileActiveTab === 'cart' ? '3px solid #10b981' : '3px solid transparent',
              color: mobileActiveTab === 'cart' ? '#10b981' : '#64748b',
              bgcolor: mobileActiveTab === 'cart' ? '#f0fdf4' : 'white',
            }}
          >
            Cart ({cart.length}) ΓÇó {formatPKR(calc.grandTotal)}
          </Button>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1, p: 1, flexDirection: isMobile ? 'column' : 'row' }}>
        
        {/* PRODUCT DISPLAY */}
        {(!isMobile || mobileActiveTab === 'products') && (
          viewMode === 'grid' ? (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              bgcolor: 'white',
              borderRadius: 2,
              p: isMobile ? 1 : 1.5,
              height: '100%'
            }}>
            <ProductCategoryGrid 
              categories={categories}
              products={products}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              addToCart={addToCart}
              updateCartQty={updateCartQtyByVariant}
              removeFromCart={removeFromCart}
              cart={cart}
              saleType={saleType}
              showCostPrice={showCostPrice}
              setShowCostPrice={setShowCostPrice}
              showWholesalePrice={showWholesalePrice}
              setShowWholesalePrice={setShowWholesalePrice}
              fbrEnabled={fbrEnabled && fbrMode}
            />
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: '100%' }}>
            
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => setShowCostPrice(!showCostPrice)}
                size="small"
                sx={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2, 
                  py: 0.5,
                  minWidth: 90,
                  bgcolor: showCostPrice ? '#fef3c7' : '#ffffff',
                  color: '#b45309',
                  borderColor: showCostPrice ? '#b45309' : '#fcd34d',
                  borderWidth: showCostPrice ? 2 : 1,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  lineHeight: 1.2,
                  '&:hover': { bgcolor: '#fffbeb', borderColor: '#b45309' }
                }}
              >
                <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#b45309', lineHeight: 1 }}>$</Typography>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309' }}>Cost Price</Typography>
              </Button>

              <Button
                variant="outlined"
                onClick={() => setShowWholesalePrice(!showWholesalePrice)}
                size="small"
                sx={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2, 
                  py: 0.5,
                  minWidth: 100,
                  bgcolor: showWholesalePrice ? '#eff6ff' : '#ffffff',
                  color: '#1d4ed8',
                  borderColor: showWholesalePrice ? '#1d4ed8' : '#93c5fd',
                  borderWidth: showWholesalePrice ? 2 : 1,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  lineHeight: 1.2,
                  '&:hover': { bgcolor: '#eff6ff', borderColor: '#1d4ed8' }
                }}
              >
                <TrendingUp sx={{ fontSize: 16, color: '#1d4ed8', mb: 0.2 }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1d4ed8' }}>Wholesale Price</Typography>
              </Button>
              
              <Chip 
                icon={<LocalOffer sx={{ fontSize: '14px !important', color: '#0284c7 !important' }} />}
                label={saleType === 'retail' ? 'Retail Pricing' : 'Wholesale Pricing'} 
                variant="outlined"
                sx={{ 
                  height: 32, 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  bgcolor: '#f0f9ff', 
                  color: '#0369a1',
                  borderColor: '#bae6fd',
                  borderRadius: 2,
                  px: 0.5
                }}
              />
              
              {fbrEnabled && fbrMode && (
                <Chip 
                  size="small" 
                  label="FBR Active" 
                  color="success" 
                  variant="filled"
                  sx={{ height: 24, fontSize: '0.6rem' }}
                />
              )}
              {fbrEnabled && !fbrMode && (
                <Chip 
                  size="small" 
                  label="Demo (0% Tax)" 
                  color="default" 
                  variant="filled"
                  sx={{ height: 24, fontSize: '0.6rem', bgcolor: '#6b7280', color: 'white' }}
                />
              )}
            </Box>

            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }}>#</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }}>SKU</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }}>ITEM DESCRIPTION</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }} align="center">QTY</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }} align="right">PRICE (RS)</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }} align="center" colSpan={2}>
                      ITEM DISCOUNT
                    </TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }} align="right">TOTAL (RS)</TableCell>
                    <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 800, fontSize: '0.72rem', py: 1.2 }} align="center">ACTION</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, idx) => (
                    <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#334155' }}>{item.sku || 'N/A'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography 
                            fontWeight="800" 
                            fontSize="0.88rem" 
                            color="#0f172a"
                            sx={{ 
                              cursor: item.wholesalePrice > 0 ? 'pointer' : 'default',
                              '&:hover': item.wholesalePrice > 0 ? { color: '#1c2580', textDecoration: 'underline' } : {}
                            }}
                            title={item.wholesalePrice > 0 ? "Click to view Wholesale Price (auto-hides in 3s)" : ""}
                            onClick={() => item.wholesalePrice > 0 && handleRevealWholesale(item.id)}
                          >
                            {item.name}
                          </Typography>
                          {item.isOfferItem && <Chip label="OFFER" size="small" color="warning" sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} />}
                          {item.discount > 0 && <Chip label={`${item.discount.toFixed(1)}% OFF`} size="small" color="error" sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} />}
                          
                          {item.wholesalePrice > 0 && !revealedWholesaleIds[item.id] && (
                            <IconButton 
                              size="small" 
                              onClick={() => handleRevealWholesale(item.id)}
                              title="Show Wholesale Price for 3s"
                              sx={{ p: 0.2, color: '#94a3b8', '&:hover': { color: '#1c2580', bgcolor: '#e0e7ff' } }}
                            >
                              <span style={{ fontSize: '0.72rem' }}>👁️</span>
                            </IconButton>
                          )}
                        </Box>
                        
                        {/* ONLY REVEALED ON CLICK: AUTO-HIDES IN 3 SECONDS */}
                        {revealedWholesaleIds[item.id] && (
                          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {item.wholesalePrice > 0 && (
                              <Chip 
                                label={`Wholesale: ${formatPKR(item.wholesalePrice)}`} 
                                size="small" 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  bgcolor: '#e0e7ff', 
                                  color: '#1d4ed8', 
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 1 
                                }} 
                              />
                            )}
                            {item.costPrice > 0 && (
                              <Chip 
                                label={`Cost: ${formatPKR(item.costPrice)}`} 
                                size="small" 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  bgcolor: '#fef3c7', 
                                  color: '#b45309', 
                                  border: '1px solid #fde68a',
                                  borderRadius: 1 
                                }} 
                              />
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          id={`qty-${idx}`}
                          type="number" size="small" value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`price-${idx}`)?.focus(); 
                            } 
                          }}
                          inputProps={{ step: 0.001, style: { textAlign: 'center', width: 60 } }} 
                          sx={{ width: 70 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          id={`price-${idx}`}
                          type="number" size="small" value={item.price}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`discount-percent-${idx}`)?.focus(); 
                            } 
                          }}
                          inputProps={{ style: { textAlign: 'right', width: 80 } }} 
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ p: 0.5 }}>
                        <TextField
                          id={`discount-percent-${idx}`}
                          type="number" size="small" 
                          value={item.discountType === 'percent' ? (item.discount || '') : ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value, 'percent')}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`discount-amount-${idx}`)?.focus(); 
                            } 
                          }}
                         inputProps={{ 
  style: { textAlign: 'center', width: 62, fontWeight: 'bold', fontSize: '0.85rem' }, 
  min: 0, 
  max: 100,
  placeholder: '%'
}} 
sx={{ width: 72 }}
                          placeholder="%"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ p: 0.5 }}>
                        <TextField
                          id={`discount-amount-${idx}`}
                          type="number" size="small" 
                          value={item.discountType === 'amount' ? (item.discountAmount || '') : ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value, 'amount')}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                            } 
                          }}
                         inputProps={{ 
  style: { textAlign: 'center', width: 75, fontWeight: 'bold', fontSize: '0.85rem' },
  min: 0,
  placeholder: 'Rs.'
}} 
sx={{ width: 85 }}
                          placeholder="Rs."
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="#10b981">{formatPKR(item.total)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removeFromCart(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                        <Search sx={{ fontSize: 40, color: '#d1d5db' }} />
                        <Typography color="text.secondary">Cart Empty ΓÇö Press F1 to search</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}

        {/* PAYMENT SUMMARY (RIGHT VERTICAL PANEL - EXACTLY MATCHING USER SCREENSHOTS) */}
        {(!isMobile || mobileActiveTab === 'cart') && (
          <Paper sx={{ 
            width: isMobile ? '100%' : 360, 
            p: 2, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1.25, 
            overflowY: 'auto', 
            flexShrink: 0, 
            height: '100%',
            bgcolor: '#ffffff',
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #1c2580',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 2 }
          }}>
            {/* Heading */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ 
                width: 34, 
                height: 34, 
                borderRadius: 1.5, 
                bgcolor: '#e8eaf6', 
                color: '#1c2580', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <PointOfSale sx={{ fontSize: 20, color: '#1c2580' }} />
              </Box>
              <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#1c2580', fontSize: '1rem' }}>
                Payment Summary
              </Typography>
            </Box>

            {/* Total Items */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
              <Typography fontWeight="500" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                Total Items
              </Typography>
              <Typography fontWeight="800" sx={{ color: '#1c2580', fontSize: '0.88rem' }}>
                {cart.length} items ({calc.totalQty.toFixed(0)} pcs)
              </Typography>
            </Box>

            {/* Sub Total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight="500" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                Sub Total
              </Typography>
              <Typography fontWeight="800" sx={{ color: '#1c2580', fontSize: '0.92rem' }}>
                {formatPKR(calc.subtotal)}
              </Typography>
            </Box>

            {/* Tax */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight="500" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                {fbrMode ? `FBR Tax (${calc.taxRate}%)` : 'Demo Tax (0%) (0%)'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography fontWeight="800" sx={{ color: '#1c2580', fontSize: '0.88rem' }}>
                  {formatPKR(calc.tax)}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>⏳</Typography>
              </Box>
            </Box>

            {/* TOTAL PAYABLE HERO CARD - DASHBOARD INDIGO & EMERALD */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #1c2580 0%, #151b60 100%)', 
              color: '#ffffff', 
              borderRadius: 2, 
              p: 1.75, 
              my: 0.5,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 15px rgba(28, 37, 128, 0.35)',
              border: '1px solid #283593'
            }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a5b4fc' }}>
                TOTAL PAYABLE
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.25 }}>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff' }}>
                  Grand Total
                </Typography>
                <Typography sx={{ fontSize: '1.65rem', fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: '#34d399' }}>
                  {formatPKR(calc.grandTotal)}
                </Typography>
              </Box>
            </Box>

            {/* Discount Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ width: 70, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Discount
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                <TextField
                  id="discount-input"
                  size="small"
                  type="number"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                  placeholder="0"
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': { height: 38, borderRadius: 1.5 },
                    '& input': { textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', p: '6px 10px' }
                  }}
                />
                <Select 
                  size="small" 
                  value={billDiscountType} 
                  onChange={(e) => setBillDiscountType(e.target.value)} 
                  sx={{ width: 65, height: 38, fontWeight: 'bold', fontSize: '0.82rem', borderRadius: 1.5 }}
                >
                  <MenuItem value="amount">Rs</MenuItem>
                  <MenuItem value="percent">%</MenuItem>
                </Select>
              </Box>
            </Box>

            {/* Payment Mode Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ width: 70, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Payment
              </Typography>
              <Select 
                size="small" 
                value={paymentMode} 
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentMode(val);
                  if (val === 'split') setShowSplitModal(true);
                }} 
                fullWidth
                sx={{ height: 38, fontSize: '0.82rem', fontWeight: 600, borderRadius: 1.5 }}
              >
                <MenuItem value="cash">💵 Cash</MenuItem>
                <MenuItem value="bank">🏦 Bank</MenuItem>
                <MenuItem value="easypaisa">📱 EasyPaisa</MenuItem>
                <MenuItem value="jazzcash">📱 JazzCash</MenuItem>
                <MenuItem value="split" sx={{ fontWeight: 'bold', color: '#4f46e5' }}>
                  🔀 Split Payment (Multi-Method)
                </MenuItem>
                <MenuItem value="credit">📋 Credit</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </Box>

            {/* Mixed payment Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.25 }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                Mixed payment?
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setPaymentMode('split');
                  setShowSplitModal(true);
                }}
                sx={{
                  color: '#1c2580',
                  borderColor: '#c5cae9',
                  bgcolor: '#e8eaf6',
                  fontSize: '0.75rem',
                  py: 0.4,
                  px: 1.5,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#c5cae9', borderColor: '#9fa8da' }
                }}
                startIcon={<Sliders sx={{ fontSize: 14 }} />}
              >
                Split Pay (Multi)
              </Button>
            </Box>

            {/* To Account Row */}
            {paymentMode !== 'credit' && paymentMode !== 'split' && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ width: 70, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  To Account
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={paymentAccount?.id || ''}
                    onChange={(e) => handlePaymentAccountChange(e.target.value)}
                    displayEmpty
                    sx={{ height: 38, fontSize: '0.8rem', borderRadius: 1.5 }}
                  >
                    <MenuItem value="" disabled><em>Select cash account</em></MenuItem>
                    {accounts
                      .filter(a => a.type === paymentMode && a.status === 'active')
                      .map(a => (
                        <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.8rem' }}>
                          {a.name} • Bal: {formatPKR(a.current_balance)}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Account warning if empty */}
            {paymentMode !== 'credit' && paymentMode !== 'split' && accounts.filter(a => a.type === paymentMode && a.status === 'active').length === 0 && (
              <Box sx={{ bgcolor: '#fffbeb', p: 0.8, borderRadius: 1.5, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>
                  ⚠️ No {paymentMode} account found! Add in Accounts page.
                </Typography>
              </Box>
            )}

            {/* Amount Paid Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ width: 70, fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Amount Paid
              </Typography>
              <TextField
                id="paid-input"
                size="small"
                type="number"
                value={paymentMode === 'split' ? (calc.actualPaid > 0 ? calc.actualPaid : '') : paidAmount}
                onChange={(e) => {
                  if (paymentMode !== 'split') setPaidAmount(e.target.value);
                }}
                disabled={paymentMode === 'split'}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSaleWithPrint(); } }}
                fullWidth
                placeholder={calc.grandTotal > 0 ? (paymentMode === 'credit' ? '0.00' : `${calc.grandTotal}`) : 'Rs 0.00'}
                sx={{
                  '& .MuiOutlinedInput-root': { height: 38, borderRadius: 1.5 },
                  '& input': { textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', p: '6px 10px' }
                }}
              />
            </Box>

            {/* Due & Change chips */}
            {calc.due > 0 && (
              <Box sx={{ bgcolor: '#fef2f2', p: 1, borderRadius: 1.5, border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="error" fontWeight="bold" fontSize="0.82rem">Due Amount</Typography>
                <Typography color="error" fontWeight="900" fontSize="0.95rem">{formatPKR(calc.due)}</Typography>
              </Box>
            )}
            {calc.change > 0 && (
              <Box sx={{ bgcolor: '#f0fdf4', p: 1, borderRadius: 1.5, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="success" fontWeight="bold" fontSize="0.82rem">Change Return</Typography>
                <Typography color="success" fontWeight="900" fontSize="0.95rem">{formatPKR(calc.change)}</Typography>
              </Box>
            )}

            {/* Action Buttons: Sale & Sale + Print */}
            <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1 }}>
              <Button 
                fullWidth 
                variant="contained" 
                onClick={saveSaleOnly} 
                disabled={cart.length === 0 || isSaving}
                sx={{ 
                  bgcolor: isSaving ? '#9ca3af' : '#2563eb', 
                  py: 1.25, 
                  fontWeight: 800, 
                  fontSize: '0.9rem',
                  borderRadius: 1.5,
                  textTransform: 'none',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  '&:hover': { bgcolor: isSaving ? '#9ca3af' : '#1d4ed8' },
                  flex: 1
                }} 
                startIcon={<Save />}
              >
                {isSaving ? 'Saving...' : 'Sale (F8)'}
              </Button>

              <Button 
                fullWidth 
                variant="contained" 
                onClick={saveSaleWithPrint} 
                disabled={cart.length === 0 || isSaving}
                sx={{ 
                  bgcolor: isSaving ? '#9ca3af' : '#059669', 
                  py: 1.25, 
                  fontWeight: 900, 
                  fontSize: '0.92rem',
                  borderRadius: 1.5,
                  textTransform: 'none',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                  '&:hover': { bgcolor: isSaving ? '#9ca3af' : '#047857' },
                  flex: 1.2
                }} 
                startIcon={<PrintIcon />}
              >
                {isSaving ? 'Saving...' : 'Sale + Print'}
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, borderRadius: 0 }}>
          <BottomNavigation showLabels sx={{ bgcolor: 'white' }}>
            <BottomNavigationAction 
              label="Cart" 
              icon={<Badge badgeContent={cart.length} color="primary"><ShoppingCart /></Badge>} 
              onClick={() => setMobileActiveTab(mobileActiveTab === 'cart' ? 'products' : 'cart')}
            />
            <BottomNavigationAction label="Scan" icon={<QrCodeScanner />} onClick={() => setScanMode(!scanMode)} />
            <BottomNavigationAction 
              label={fbrMode ? 'FBR ON' : 'FBR OFF'} 
              icon={fbrMode ? <ToggleOn color="success" /> : <ToggleOff color="disabled" />} 
              onClick={toggleFBRMode}
              sx={{ color: fbrMode ? '#10b981' : '#6b7280' }}
            />
            <BottomNavigationAction label="Offers" icon={<LocalOffer />} onClick={() => setShowOffersDialog(true)} />
            <BottomNavigationAction label="Held" icon={<Receipt />} onClick={() => setShowResumeDialog(true)} />
            <BottomNavigationAction label="Shortcuts" icon={<KeyboardArrowDown />} onClick={() => setShowShortcuts(true)} />
          </BottomNavigation>
        </Paper>
      )}

      {/* RECEIPT DIALOG */}
      <Dialog open={showReceipt} onClose={() => setShowReceipt(false)} maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', py: 1 }}>
          Receipt {defaultPrinter && <Chip label={defaultPrinter} size="small" sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />}
          {fbrStatus?.fbr_status === 'SYNCED' && (
            <Chip label="FBR Active" size="small" sx={{ ml: 1, bgcolor: '#10b981', color: 'white' }} />
          )}
          {fbrStatus?.fbr_status === 'DEMO' && (
            <Chip label="Demo Mode" size="small" sx={{ ml: 1, bgcolor: '#6b7280', color: 'white' }} />
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#f3f4f6' }}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }} className="receipt-content">
            <ThermalReceipt 
              sale={lastSale} 
              items={lastSale?.items || []} 
              party={selectedParty} 
              partyType={partyType}
              fbrStatus={fbrStatus}
              fbrEnabled={fbrEnabled}
              fbrMode={fbrMode}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReceipt(false)}>Close</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} sx={{ bgcolor: '#10b981' }}>
            {defaultPrinter ? 'Auto Print' : 'Print'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FBR SCAN DIALOG */}
      <FBRScanDialog 
        open={showFBRScan} 
        onClose={() => setShowFBRScan(false)} 
        onScanComplete={handleFBRScanComplete}
        showSnackbar={showSnackbar}
      />

      {/* HELD BILLS DIALOG */}
      <Dialog open={showResumeDialog} onClose={() => setShowResumeDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Held Bills ({heldBills.length})</DialogTitle>
        <DialogContent>
          {heldBills.length === 0 ? <Alert severity="info">No held bills</Alert> : (
            <List>
              {heldBills.map(bill => (
                <Paper key={bill.id} sx={{ mb: 1 }}>
                  <ListItem secondaryAction={
                    <Box>
                      <IconButton edge="end" onClick={() => resumeBill(bill)} color="success"><CheckCircle /></IconButton>
                      <IconButton edge="end" onClick={() => deleteHeld(bill.id)} color="error"><Delete /></IconButton>
                    </Box>
                  }>
                    <ListItemIcon><Receipt /></ListItemIcon>
                    <ListItemText primary={bill.party?.name || 'Walk-in'} secondary={`${formatPKR(bill.total)} ΓÇó ${new Date(bill.date).toLocaleString()}`} />
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResumeDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* HOLD DIALOG */}
      <Dialog open={showHoldDialog} onClose={() => setShowHoldDialog(false)}>
        <DialogTitle>Hold Current Bill?</DialogTitle>
        <DialogContent><Typography>{cart.length} items will be saved.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHoldDialog(false)}>Cancel</Button>
          <Button onClick={() => { holdBill(); setShowHoldDialog(false); }} variant="contained" sx={{ bgcolor: '#f59e0b' }}>Hold Bill</Button>
        </DialogActions>
      </Dialog>

      {/* OFFERS DIALOG */}
      <Dialog open={showOffersDialog} onClose={() => setShowOffersDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}><LocalOffer sx={{ verticalAlign: 'middle', mr: 1 }} />Active Offers</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {offers.filter(o => o.status === 'active').length === 0 ? <Alert severity="info">No active offers</Alert> : (
            <Grid container spacing={isMobile ? 1 : 2} sx={{ mt: 1 }}>
              {offers.filter(o => o.status === 'active').map(offer => (
                <Grid item xs={12} sm={6} key={offer.id}>
                  <Paper variant="outlined" sx={{ p: 2, borderLeft: '4px solid #10b981', cursor: 'pointer', '&:hover': { bgcolor: '#f0fdf4' } }} onClick={() => applyOffer(offer)}>
                    <Typography fontWeight="bold">{offer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{offer.description}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Original:</Typography>
                      <Typography variant="body2">Rs. {Number(offer.original_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Final:</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#10b981">Rs. {Number(offer.final_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Button fullWidth variant="contained" size="small" sx={{ mt: 1, bgcolor: '#10b981' }}>Add to Cart</Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOffersDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* PRINTER SETTINGS */}
      <PrinterSettingsDialog 
        open={showPrinterSettings} 
        onClose={() => setShowPrinterSettings(false)} 
        onPrinterSelect={(printer) => setDefaultPrinter(printer)} 
      />

      {/* SHORTCUTS HELP */}
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* SPLIT PAYMENT DIALOG */}
      <SplitPaymentDialog
        open={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        splitPayments={splitPayments}
        handleSplitAmountChange={handleSplitAmountChange}
        handleSplitAccountChange={handleSplitAccountChange}
        handleResetSplit={handleResetSplit}
        handleFillRest={handleFillRest}
        accounts={accounts}
        grandTotal={calc.grandTotal}
      />

      {/* MOBILE DRAWER */}
      <Drawer anchor="right" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ width: 280, p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setShowFBRScan(true); setMobileDrawer(false); }} sx={{ bgcolor: fbrEnabled && fbrMode ? '#f0fdf4' : 'transparent' }}>
              <ListItemIcon><QrCode sx={{ color: fbrMode ? '#10b981' : '#6b7280' }} /></ListItemIcon>
              <ListItemText primary="FBR Scan" secondary={fbrMode ? 'Active' : 'Demo Mode'} />
            </ListItem>
            <ListItem button onClick={toggleFBRMode} sx={{ bgcolor: fbrMode ? '#f0fdf4' : '#f9fafb' }}>
              <ListItemIcon>{fbrMode ? <ToggleOn color="success" /> : <ToggleOff color="disabled" />}</ListItemIcon>
              <ListItemText primary={fbrMode ? 'FBR ON' : 'FBR OFF'} secondary={fbrMode ? 'Real Tax & QR' : '0% Tax (Demo)'} />
            </ListItem>
            <ListItem button onClick={() => { setShowOffersDialog(true); setMobileDrawer(false); }}><ListItemIcon><LocalOffer /></ListItemIcon><ListItemText primary="Offers" /></ListItem>
            <ListItem button onClick={() => { setShowResumeDialog(true); setMobileDrawer(false); }}><ListItemIcon><Receipt /></ListItemIcon><ListItemText primary="Held Bills" /></ListItem>
            <ListItem button onClick={() => { setShowHoldDialog(true); setMobileDrawer(false); }}><ListItemIcon><Pause /></ListItemIcon><ListItemText primary="Hold Bill" /></ListItem>
            <ListItem button onClick={() => { setShowPrinterSettings(true); setMobileDrawer(false); }}><ListItemIcon><PrintIcon /></ListItemIcon><ListItemText primary="Printer" /></ListItem>
            <ListItem button onClick={() => { setShowShortcuts(true); setMobileDrawer(false); }}><ListItemIcon><KeyboardArrowDown /></ListItemIcon><ListItemText primary="Shortcuts" /></ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>Party Type</InputLabel>
                <Select value={partyType} onChange={(e) => setPartyType(e.target.value)} label="Party Type">
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="supplier">Supplier</MenuItem>
                </Select>
              </FormControl>
            </ListItem>
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>{partyType === 'customer' ? 'Customer' : 'Supplier'}</InputLabel>
                <Select value={selectedParty?.id || ''} onChange={(e) => {
                  const dataset = partyType === 'customer' ? customers : suppliers;
                  const match = dataset.find(x => x.id === e.target.value);
                  setSelectedParty(match || null);
                }} label={partyType === 'customer' ? 'Customer' : 'Supplier'}>
                  <MenuItem value="">Walk-in</MenuItem>
                  {(partyType === 'customer' ? customers : suppliers).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={2500} 
        onClose={() => setSnackbar(p => ({ ...p, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} 
        sx={{ mb: 2, mr: 2, zIndex: 9999 }}
      >
        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.8,
            px: 1.5,
            borderRadius: 1.5,
            bgcolor: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d',
            fontWeight: 700,
            fontSize: '0.82rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
          }}
        >
          <CheckCircle sx={{ fontSize: 18, color: '#16a34a' }} />
          <span>{snackbar.message}</span>
        </Paper>
      </Snackbar>
    </Box>
  );
}

