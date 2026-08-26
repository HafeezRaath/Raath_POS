import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Card, CardContent, IconButton, Stack, Divider,
  Snackbar, Alert, CircularProgress, Avatar, Tooltip,
  useMediaQuery, useTheme, Tabs, Tab, Collapse, InputAdornment,
  FormControlLabel, Autocomplete
} from '@mui/material';
import {
  Add, Edit, Delete, Search, CheckCircle, Cancel, Schedule,
  Build, Person, Store, Inventory, Refresh, Close,
  ArrowUpward, ArrowDownward, Smartphone, Payment, AccessTime,
  Category, Print, Receipt, TrendingUp, Warning, Check, Assessment,
  QrCode, Palette, DesignServices, ReceiptLong, Info
} from '@mui/icons-material';
import db from '../database/db';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'warning' },
  'in-progress': { label: 'In Progress', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' }
};

const STATUS_FLOW = {
  pending: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const ROLES = ['technician', 'tailor', 'manager', 'helper'];
const PAYMENT_MODES = ['cash', 'card', 'online', 'pending'];

// ==================== PRINT BILL FUNCTION ====================
const printBill = (order, staffList) => {
  if (!order) return;
  
  const staff = staffList.find(s => String(s.id) === String(order.staff_id));
  const totalPartsCost = order.parts_used?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0;
  const serviceFee = order.total_cost - totalPartsCost;
  const dueAmount = order.total_cost - (order.advance_amount || 0);
  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Repair Bill #${order.id}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; }
        .order-info { margin-bottom: 20px; }
        .order-info table { width: 100%; }
        .order-info td { padding: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background: #f0f0f0; padding: 8px; text-align: left; border-bottom: 2px solid #000; }
        .items-table td { padding: 8px; border-bottom: 1px solid #ddd; }
        .items-table .total-row { font-weight: bold; border-top: 2px solid #000; }
        .payment-section { margin: 20px 0; padding: 10px; background: #f9f9f9; }
        .footer { text-align: center; margin-top: 30px; border-top: 2px solid #000; padding-top: 10px; color: #666; }
        .commission { background: #e8f5e9; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .due-positive { color: #d32f2f; }
        .due-zero { color: #388e3c; }
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Raath POS</h1>
      </div>

      <div class="order-info">
        <table>
          <tr><td><strong>Bill #:</strong> ${order.id}</td><td><strong>Date:</strong> ${fmtDate(order.created_at)}</td></tr>
          <tr><td><strong>Status:</strong> ${order.status.toUpperCase()}</td><td><strong>Payment:</strong> ${order.payment_status.toUpperCase()}</td></tr>
          <tr><td><strong>Device:</strong> ${order.device_model || order.machine_name || 'N/A'}</td><td><strong>IMEI:</strong> ${order.imei || 'N/A'}</td></tr>
          <tr><td><strong>Service:</strong> ${order.service_name || 'N/A'}</td><td><strong>Staff:</strong> ${order.staff_name || 'N/A'}</td></tr>
          <tr><td><strong>Customer:</strong> ${order.customer_name || 'Walk-in'}</td><td><strong>Payment Mode:</strong> ${(order.payment_mode || 'PENDING').toUpperCase()}</td></tr>
        </table>
      </div>

      ${order.problem_description ? `<p><strong>Problem/Fault:</strong> ${order.problem_description}</p>` : ''}

      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>Service Fee</strong></td>
            <td>1</td>
            <td>Rs. ${serviceFee}</td>
            <td>Rs. ${serviceFee}</td>
          </tr>
          ${order.parts_used?.map((p, i) => `
            <tr>
              <td>${i + 2}</td>
              <td>${p.name} ${p.is_external ? '(Market)' : '(Stock)'}</td>
              <td>${p.quantity}</td>
              <td>Rs. ${p.cost}</td>
              <td>Rs. ${p.cost * p.quantity}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="4" class="text-right"><strong>Total:</strong></td>
            <td><strong>Rs. ${order.total_cost || 0}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="payment-section">
        <table width="100%">
          <tr>
            <td><strong>Total Bill:</strong> Rs. ${order.total_cost || 0}</td>
            <td><strong>Advance Paid:</strong> Rs. ${order.advance_amount || 0}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Due Amount:</strong> <span class="${dueAmount > 0 ? 'due-positive' : 'due-zero'}">Rs. ${dueAmount}</span></td>
          </tr>
        </table>
      </div>

      ${order.commission_amount > 0 ? `
        <div class="commission">
          <strong>Staff Commission:</strong> Rs. ${order.commission_amount} 
          (${staff?.commission_rate || 0}% of total)
        </div>
      ` : ''}

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>📞 +92 3493850656 | 📧 raathdeveloper.com</p>
        <p>Terms: All prices are in PKR. Items once sold cannot be returned.</p>
        <p><small>Generated: ${new Date().toLocaleString()}</small></p>
      </div>

      <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin: 20px 0; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
        🖨️ Print Bill
      </button>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    alert('Please allow popups to print the bill');
  }
};

// ==================== WORK ORDER CARD ====================
const WorkOrderCard = ({ wo, onEdit, onDelete, onStatusChange, onViewHistory, onPrint }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
  const nextStatuses = STATUS_FLOW[wo.status] || [];
  
  const paymentColor = wo.payment_status === 'paid' ? 'success' : 'error';
  const paymentLabel = wo.payment_status === 'paid' ? 'PAID' : 'UNPAID';

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalPartsCost = useMemo(() => {
    if (!wo.parts_used || wo.parts_used.length === 0) return 0;
    return wo.parts_used.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
  }, [wo.parts_used]);

  const serviceFee = wo.total_cost - totalPartsCost;
  const dueAmount = wo.total_cost - (wo.advance_amount || 0);

  return (
    <Card 
      elevation={2}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 2,
        transition: '0.2s',
        '&:hover': { boxShadow: 4 },
        borderLeft: `5px solid ${
          status.color === 'warning' ? '#f59e0b' : 
          status.color === 'info' ? '#3b82f6' : 
          status.color === 'success' ? '#10b981' : '#ef4444'
        }` 
      }}
    >
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip size="small" label={status.label} color={status.color} sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
              <Chip size="small" label={paymentLabel} color={paymentColor} sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>#{wo.id}</Typography>
          </Box>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, lineHeight: 1.2 }}>
            {wo.device_model || wo.machine_name || 'Unnamed Device'}
          </Typography>

          {wo.imei && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
              IMEI: <strong>{wo.imei}</strong>
            </Typography>
          )}

          <Stack spacing={0.5} sx={{ my: 1.5 }}>
            <Typography variant="body2" color="text.secondary"><strong>Service:</strong> {wo.service_name || '—'}</Typography>
            <Typography variant="body2" color="text.secondary"><strong>Staff:</strong> {wo.staff_name || '—'}</Typography>
            {wo.customer_name && (
              <Typography 
                variant="body2" 
                color="primary.main" 
                sx={{ cursor: 'pointer', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
                onClick={() => onViewHistory(wo.customer_id)}
              >
                👤 {wo.customer_name} (History)
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Payment fontSize="inherit" /> <strong>Mode:</strong> {wo.payment_mode ? wo.payment_mode.toUpperCase() : 'PENDING'}
            </Typography>
          </Stack>

          <Collapse in={expanded}>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              {wo.problem_description && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Problem / Fault</Typography>
                  <Typography variant="body2">{wo.problem_description}</Typography>
                </Box>
              )}
              {wo.parts_used?.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom>Parts Used</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {wo.parts_used.map((p, i) => (
                      <Chip 
                        key={i} 
                        size="small" 
                        label={`${p.name} (${p.is_external ? 'Market' : 'Stock'}) ×${p.quantity} = Rs.${p.cost * p.quantity}`} 
                        variant="outlined" 
                        sx={{ fontSize: '0.6rem', height: 20 }} 
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Payment fontSize="small" /> Cost Breakdown
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Service Fee: <strong>Rs. {serviceFee}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Parts Cost: <strong>Rs. {totalPartsCost}</strong>
                </Typography>
                <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                  Total: Rs. {wo.total_cost || 0}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: '#f0fdf4', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Payment fontSize="small" /> Payment Status
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Advance: <strong>Rs. {wo.advance_amount || 0}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Due: <strong style={{ color: dueAmount > 0 ? '#ef4444' : '#10b981' }}>Rs. {dueAmount}</strong>
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime fontSize="small" /> Timestamps
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  Created: {fmtDate(wo.created_at)}
                </Typography>
                {wo.status === 'completed' && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Completed: {fmtDate(wo.completed_at)}
                  </Typography>
                )}
                {wo.commission_amount > 0 && (
                  <Typography variant="caption" display="block" color="success.main" fontWeight={600}>
                    Staff Commission: Rs. {wo.commission_amount}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Collapse>
        </Box>

        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Cost</Typography>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Rs. {wo.total_cost || 0}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {nextStatuses.map(ns => (
              <Button
                key={ns} size="small" variant="contained"
                onClick={() => onStatusChange(wo.id, ns)}
                sx={{
                  flex: 1, fontSize: '0.7rem', py: 0.6, textTransform: 'none',
                  bgcolor: ns === 'completed' ? '#10b981' : ns === 'in-progress' ? '#3b82f6' : '#ef4444',
                  '&:hover': { bgcolor: ns === 'completed' ? '#059669' : ns === 'in-progress' ? '#2563eb' : '#dc2626' }
                }}
              >
                {ns === 'completed' ? 'Complete' : ns === 'in-progress' ? 'Start' : 'Cancel'}
              </Button>
            ))}
            <Tooltip title="Print Bill"><IconButton size="small" color="primary" onClick={() => onPrint(wo)}><Print fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Edit Order"><IconButton size="small" color="primary" onClick={() => onEdit(wo)}><Edit fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Delete Order"><IconButton size="small" color="error" onClick={() => onDelete(wo.id)}><Delete fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={expanded ? "Less details" : "More details"}><IconButton size="small" onClick={() => setExpanded(!expanded)}>{expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}</IconButton></Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== INDEXEDDB HELPERS (DIRECT ACCESS) ====================
const idbGetById = (storeName, id) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RAATH_POS_DEMO', 17);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const getRequest = store.get(id);
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const idbPut = (storeName, data) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RAATH_POS_DEMO', 17);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const putRequest = store.put(data);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

// ==================== MAIN COMPONENT ====================
export default function ServicesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeTab, setActiveTab] = useState('workorders');
  const [workOrders, setWorkOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customerHistory, setCustomerHistory] = useState({ open: false, customer: null, orders: [] });
  const [stockAlert, setStockAlert] = useState({ open: false, message: '', parts: [] });
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    loadAll();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadAll = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    setLoading(true);
    try {
      const [wo, sv, st, cu, pr, cat] = await Promise.all([
        db.getWorkOrders ? db.getWorkOrders() : [],
        db.getServices ? db.getServices() : [],
        db.getStaff ? db.getStaff() : [],
        db.getCustomers ? db.getCustomers() : [],
        db.getAllVariants ? db.getAllVariants() : [],
        db.getCategories ? db.getCategories() : []
      ]);
      
      const categoryMap = {};
      (cat || []).forEach(c => {
        categoryMap[c.id] = c.name;
      });
      
      const productsWithCategory = (pr || []).map(p => {
        const catId = p.category_id || p.parent_category_id;
        return {
          ...p,
          category_name: categoryMap[catId] || p.category_name || 'Uncategorized',
          category_id: catId || p.category_id || null,
          current_stock: Number(p.current_stock) || 0
        };
      });
      
      if (isMounted.current) {
        setWorkOrders(wo || []);
        setServices(sv || []);
        setStaffList(st || []);
        setCustomers(cu || []);
        setProducts(productsWithCategory);
        setCategories(cat || []);
      }
    } catch (e) {
      console.error('Load error:', e);
      if (isMounted.current) {
        setSnackbar({ open: true, message: 'Error loading data: ' + e.message, severity: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  };

  const filteredWorkOrders = useMemo(() => {
    let result = [...workOrders];
    if (statusFilter) result = result.filter(w => w.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => 
        (w.device_model || w.machine_name || '').toLowerCase().includes(q) ||
        (w.imei || '').toLowerCase().includes(q) ||
        (w.service_name || '').toLowerCase().includes(q) ||
        (w.staff_name || '').toLowerCase().includes(q) ||
        (w.customer_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, statusFilter, searchQuery]);

  const reportData = useMemo(() => {
    const totalOrders = workOrders.length;
    const completedOrders = workOrders.filter(w => w.status === 'completed');
    const pendingOrders = workOrders.filter(w => w.status === 'pending');
    const inProgressOrders = workOrders.filter(w => w.status === 'in-progress');
    const cancelledOrders = workOrders.filter(w => w.status === 'cancelled');
    
    const totalRevenue = workOrders.reduce((sum, w) => sum + (w.total_cost || 0), 0);
    const totalCommission = workOrders.reduce((sum, w) => sum + (w.commission_amount || 0), 0);
    const totalAdvance = workOrders.reduce((sum, w) => sum + (w.advance_amount || 0), 0);
    const totalDue = workOrders.reduce((sum, w) => sum + (w.total_cost - (w.advance_amount || 0)), 0);
    
    const revenueByStatus = {
      pending: workOrders.filter(w => w.status === 'pending').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      'in-progress': workOrders.filter(w => w.status === 'in-progress').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      completed: workOrders.filter(w => w.status === 'completed').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      cancelled: workOrders.filter(w => w.status === 'cancelled').reduce((sum, w) => sum + (w.total_cost || 0), 0)
    };
    
    const staffPerformance = staffList.map(staff => {
      const staffOrders = workOrders.filter(w => String(w.staff_id) === String(staff.id));
      const completedStaffOrders = staffOrders.filter(w => w.status === 'completed');
      const totalStaffCommission = staffOrders.reduce((sum, w) => sum + (w.commission_amount || 0), 0);
      const totalStaffRevenue = staffOrders.reduce((sum, w) => sum + (w.total_cost || 0), 0);
      const totalStaffAdvance = staffOrders.reduce((sum, w) => sum + (w.advance_amount || 0), 0);
      
      return {
        ...staff,
        totalOrders: staffOrders.length,
        completedOrders: completedStaffOrders.length,
        totalCommission: totalStaffCommission,
        totalRevenue: totalStaffRevenue,
        totalAdvance: totalStaffAdvance,
        totalPayout: (Number(staff.base_salary) || 0) + totalStaffCommission
      };
    }).sort((a, b) => b.totalCommission - a.totalCommission);

    const recentCompleted = [...completedOrders]
      .sort((a, b) => new Date(b.completed_at || b.updated_at || 0) - new Date(a.completed_at || a.updated_at || 0))
      .slice(0, 10);

    return {
      totalOrders,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      inProgressOrders: inProgressOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      totalCommission,
      totalAdvance,
      totalDue,
      revenueByStatus,
      staffPerformance,
      recentCompleted,
      completionRate: totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0
    };
  }, [workOrders, staffList]);

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setModalType('');
  };

  const openCustomerHistory = (customerId) => {
    const cust = customers.find(c => c.id === customerId);
    const historyOrders = workOrders.filter(w => w.customer_id === customerId);
    setCustomerHistory({ open: true, customer: cust, orders: historyOrders });
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      if (type === 'service') await db.deleteService(id);
      else if (type === 'staff') await db.deleteStaff(id);
      else if (type === 'workorder') await db.deleteWorkOrder(id);
      await loadAll();
      setSnackbar({ open: true, message: 'Deleted successfully!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Error: ' + e.message, severity: 'error' });
    }
  };

  // ==================== UPDATE WORK ORDER STATUS (FINAL FIXED VERSION) ====================
  const updateWorkOrderStatus = async (id, newStatus) => {
    let stockDeductions = [];
    let commissionAmount = 0;
    let commissionAdded = false;
    
    try {
      console.log(`🔄 Starting status update for order ${id} to ${newStatus}`);
      
      const order = workOrders.find(w => String(w.id) === String(id));
      if (!order) {
        console.error('❌ Order not found:', id);
        return;
      }

      const updatePayload = { status: newStatus };

      if (newStatus === 'completed') {
        console.log('✅ Order completing - processing stock and commission');
        
        updatePayload.completed_at = new Date().toISOString();
        
        // ====== 1. CALCULATE AND ADD COMMISSION ======
        const staff = staffList.find(s => String(s.id) === String(order.staff_id));
        
        if (staff && staff.commission_rate > 0 && order.total_cost > 0) {
          commissionAmount = Math.round((order.total_cost * staff.commission_rate) / 100);
          updatePayload.commission_amount = commissionAmount;
          
          try {
            const currentStaff = await db.getStaffById(staff.id);
            if (currentStaff) {
              const currentTotalCommission = Number(currentStaff.total_commission) || 0;
              const newTotalCommission = currentTotalCommission + commissionAmount;
              
              await db.updateStaff(staff.id, {
                ...currentStaff,
                total_commission: newTotalCommission
              });
              
              commissionAdded = true;
              console.log(`✅ Commission Rs. ${commissionAmount} added to ${staff.name}`);
              console.log(`   Total: ${currentTotalCommission} → ${newTotalCommission}`);
            }
          } catch (err) {
            console.error('Commission update error:', err);
          }
        }

        // ====== 2. DEDUCT STOCK FROM VARIANTS ======
        if (order?.parts_used?.length > 0) {
          console.log(`📦 Processing ${order.parts_used.length} parts...`);
          
          const stockParts = order.parts_used.filter(p => !p.is_external);
          
          for (const part of stockParts) {
            console.log(`🔍 Processing part:`, part);
            
            // 🔥 CRITICAL: Find VARIANT by SKU
            let variant = null;
            
            // Try by SKU first
            if (part.part_id) {
              variant = products.find(p => p.sku === part.part_id);
            }
            
            // Try by ID if SKU not found
            if (!variant && part.part_id) {
              variant = products.find(p => String(p.id) === String(part.part_id));
            }
            
            // Try by name as last resort
            if (!variant && part.name) {
              variant = products.find(p => 
                (p.product_name || p.name || '').toLowerCase() === part.name.toLowerCase()
              );
            }
            
            console.log(`🔍 Found variant:`, variant ? {
              id: variant.id,
              sku: variant.sku,
              name: variant.product_name || variant.name,
              current_stock: variant.current_stock,
              variant_name: variant.variant_name
            } : 'NOT FOUND');
            
            if (variant) {
              const currentStock = Number(variant.current_stock) || 0;
              const usedQty = Number(part.quantity) || 0;
              
              // ✅ STRICT SUBTRACTION
              const deductedStock = Math.max(0, currentStock - usedQty);
              
              console.log(`📊 Stock Calculation:`);
              console.log(`   Variant: ${variant.product_name || variant.name} (${variant.sku})`);
              console.log(`   Current: ${currentStock} - Used: ${usedQty} = After: ${deductedStock}`);
              
              let updateSuccess = false;
              
              try {
                // 🔥 METHOD 1: Direct SQL (Electron)
                if (window.electronAPI && window.electronAPI.dbQuery) {
                  console.log(`📝 Using SQL UPDATE for variant: ${variant.id}`);
                  await window.electronAPI.dbQuery(
                    "UPDATE product_variants SET current_stock = ? WHERE id = ?",
                    [deductedStock, variant.id]
                  );
                  updateSuccess = true;
                }
                // 🔥 METHOD 2: db.updateVariantStock
                else if (db.updateVariantStock) {
                  console.log(`📝 Using db.updateVariantStock for variant: ${variant.id}`);
                  await db.updateVariantStock(variant.id, deductedStock);
                  updateSuccess = true;
                }
                // 🔥 METHOD 3: db.updateVariant
                else if (db.updateVariant) {
                  console.log(`📝 Using db.updateVariant for variant: ${variant.id}`);
                  const updatedVariant = {
                    ...variant,
                    current_stock: deductedStock
                  };
                  await db.updateVariant(variant.id, updatedVariant);
                  updateSuccess = true;
                }
                // 🔥 METHOD 4: db.query
                else if (db.query) {
                  console.log(`📝 Using db.query for variant: ${variant.id}`);
                  await db.query(
                    "UPDATE product_variants SET current_stock = ? WHERE id = ?",
                    [deductedStock, variant.id]
                  );
                  updateSuccess = true;
                }
                // 🔥 METHOD 5: Direct IndexedDB
                else {
                  console.log(`📝 Using direct IndexedDB for variant: ${variant.id}`);
                  const idbVariant = await idbGetById('product_variants', variant.id);
                  if (idbVariant) {
                    idbVariant.current_stock = deductedStock;
                    await idbPut('product_variants', idbVariant);
                    updateSuccess = true;
                  }
                }
              } catch (err) {
                console.error(`❌ Stock update failed for ${part.name}:`, err);
              }
              
              if (updateSuccess) {
                // ✅ Update local state
                const localVariant = products.find(p => String(p.id) === String(variant.id));
                if (localVariant) {
                  localVariant.current_stock = deductedStock;
                  console.log(`✅ Local state updated for ${localVariant.product_name || localVariant.name}`);
                }
                
                stockDeductions.push({
                  name: variant.product_name || variant.name || part.name,
                  sku: variant.sku || part.part_id,
                  before: currentStock,
                  after: deductedStock,
                  used: usedQty,
                  variantId: variant.id
                });
                
                console.log(`✅ Stock updated: ${part.name} = ${deductedStock}`);
              } else {
                console.error(`❌ ALL STOCK UPDATE METHODS FAILED for ${part.name}!`);
              }
            } else {
              console.error(`❌ VARIANT NOT FOUND for part:`, part);
              console.log(`   Available variants:`, products.map(p => ({
                id: p.id,
                sku: p.sku,
                name: p.product_name || p.name,
                stock: p.current_stock
              })));
            }
          }
          
          if (stockDeductions.length > 0 && isMounted.current) {
            setStockAlert({
              open: true,
              message: `📦 Stock Deducted Successfully (${stockDeductions.length} parts)`,
              parts: stockDeductions
            });
          }
        }
      }

      // ====== 3. UPDATE WORK ORDER STATUS ======
      console.log(`📝 Updating work order status to ${newStatus}...`);
      
      try {
        if (db.updateWorkOrder) {
          await db.updateWorkOrder(id, updatePayload);
        } else if (db.updateWorkOrderStatus) {
          await db.updateWorkOrderStatus(id, newStatus);
        } else if (db.query) {
          await db.query(
            "UPDATE work_orders SET status = ?, completed_at = ?, commission_amount = ? WHERE id = ?",
            [newStatus, updatePayload.completed_at || null, updatePayload.commission_amount || 0, id]
          );
        }
        
        console.log('✅ Work order updated, reloading data...');
        
        // Clear cache
        if (db._cache) {
          db._cache.clear();
          console.log('🗑️ Cache cleared');
        }
        
        await loadAll();
        
        // Verify stock
        console.log(`🔍 Verifying stock after reload...`);
        const verifiedProducts = await db.getAllVariants ? await db.getAllVariants() : [];
        console.log(`📊 Stock after verification:`, verifiedProducts.map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.product_name || p.name,
          stock: p.current_stock
        })));
        
        let message = `✅ Order ${newStatus === 'completed' ? 'completed' : 'updated'}!`;
        if (stockDeductions.length > 0) {
          message += ` ${stockDeductions.length} parts deducted`;
        }
        if (commissionAmount > 0 && commissionAdded) {
          message += `, Commission: Rs. ${commissionAmount} added to staff`;
        }
        
        setSnackbar({ 
          open: true, 
          message: message, 
          severity: 'success' 
        });
        
      } catch (err) {
        console.error('❌ Work order update error:', err);
        setSnackbar({ 
          open: true, 
          message: 'Error updating order: ' + err.message, 
          severity: 'error' 
        });
      }
      
    } catch (e) {
      console.error('❌ Status update error:', e);
      setSnackbar({ 
        open: true, 
        message: 'Error: ' + e.message, 
        severity: 'error' 
      });
    }
  };

  // ==================== WORK ORDER FORM ====================
  const WorkOrderForm = () => {
    const [form, setForm] = useState({
      service_id: editingItem?.service_id || '',
      staff_id: editingItem?.staff_id || '',
      customer_id: editingItem?.customer_id || '',
      device_model: editingItem?.device_model || editingItem?.machine_name || '',
      imei: editingItem?.imei || '',
      problem_description: editingItem?.problem_description || '',
      status: editingItem?.status || 'pending',
      notes: editingItem?.notes || '',
      service_fee: editingItem?.service_fee || '',
      advance_amount: editingItem?.advance_amount || '',
      total_cost: editingItem?.total_cost || '',
      payment_status: editingItem?.payment_status || 'unpaid',
      payment_mode: editingItem?.payment_mode || 'pending'
    });
    const [selectedParts, setSelectedParts] = useState(editingItem?.parts_used || []);
    const [partSearch, setPartSearch] = useState('');
    const [extPart, setExtPart] = useState({ name: '', cost: '' });
    const [categoryFilter, setCategoryFilter] = useState('');

    const getProductName = (p) => p.name || p.product_name || p.variant_name || 'Unknown';
    const getProductCategory = (p) => p.category_name || p.category || 'Uncategorized';
    const getProductStock = (p) => p.current_stock || 0;

    const productsByCategory = useMemo(() => {
      const grouped = {};
      products.forEach(p => {
        const category = getProductCategory(p);
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(p);
      });
      return grouped;
    }, [products]);

    const categoriesList = useMemo(() => {
      return Object.keys(productsByCategory).sort();
    }, [productsByCategory]);

    const calculatedTotal = useMemo(() => {
      const partsTotal = selectedParts.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0);
      const serviceFee = Number(form.service_fee) || 0;
      return partsTotal + serviceFee;
    }, [selectedParts, form.service_fee]);

    const commissionPreview = useMemo(() => {
      const staff = staffList.find(s => String(s.id) === String(form.staff_id));
      if (!staff || !calculatedTotal) return 0;
      return Math.round((calculatedTotal * (staff.commission_rate || 0)) / 100);
    }, [form.staff_id, calculatedTotal, staffList]);

    useEffect(() => {
      setForm(prev => ({ ...prev, total_cost: calculatedTotal.toString() }));
    }, [calculatedTotal]);

    const availableParts = useMemo(() => {
      let filtered = products;
      
      if (categoryFilter) {
        filtered = filtered.filter(p => getProductCategory(p) === categoryFilter);
      }
      
      if (partSearch) {
        const q = partSearch.toLowerCase();
        filtered = filtered.filter(p => 
          getProductName(p).toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
      }
      
      filtered = filtered.filter(p => getProductStock(p) > 0);
      
      return filtered.slice(0, 20);
    }, [partSearch, categoryFilter, products]);

    const addStockPart = (product) => {
      const productName = getProductName(product);
      const category = getProductCategory(product);
      const currentStock = getProductStock(product);
      
      const exists = selectedParts.find(p => p.part_id === product.sku && !p.is_external);
      
      if (exists) {
        if (exists.quantity + 1 > currentStock) {
          setSnackbar({ 
            open: true, 
            message: `⚠️ Not enough stock! Only ${currentStock} available.`, 
            severity: 'warning' 
          });
          return;
        }
        setSelectedParts(selectedParts.map(p => 
          p.part_id === product.sku && !p.is_external 
            ? { ...p, quantity: p.quantity + 1 } 
            : p
        ));
      } else {
        if (currentStock <= 0) {
          setSnackbar({ 
            open: true, 
            message: `⚠️ ${productName} is out of stock!`, 
            severity: 'error' 
          });
          return;
        }
        setSelectedParts([...selectedParts, { 
          part_id: product.sku, 
          name: productName,
          category: category,
          quantity: 1, 
          cost: Number(product.purchase_price) || Number(product.cost_price) || 0, 
          is_external: false,
          stock_before: currentStock
        }]);
      }
      setPartSearch('');
    };

    const addExternalPart = () => {
      if (!extPart.name || !extPart.cost) return;
      setSelectedParts([...selectedParts, { 
        part_id: 'EXT-' + Date.now(), 
        name: extPart.name,
        category: 'External',
        quantity: 1, 
        cost: Number(extPart.cost) || 0, 
        is_external: true 
      }]);
      setExtPart({ name: '', cost: '' });
    };

    const updatePartQty = (partId, qty) => {
      const num = parseInt(qty) || 0;
      if (num <= 0) {
        setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
      } else {
        const part = selectedParts.find(p => p.part_id === partId);
        if (part && !part.is_external) {
          const product = products.find(p => p.sku === partId);
          if (product && num > (product.current_stock || 0)) {
            setSnackbar({ 
              open: true, 
              message: `⚠️ Not enough stock! Only ${product.current_stock} available.`, 
              severity: 'warning' 
            });
            return;
          }
        }
        setSelectedParts(selectedParts.map(p => 
          p.part_id === partId ? { ...p, quantity: num } : p
        ));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const service = services.find(s => String(s.id) === String(form.service_id));
        const staff = staffList.find(s => String(s.id) === String(form.staff_id));
        const customer = customers.find(c => String(c.id) === String(form.customer_id));
        
        const payload = { 
          ...form, 
          machine_name: form.device_model,
          service_name: service?.name || '',
          staff_name: staff?.name || '',
          customer_name: customer?.name || '',
          total_cost: Number(calculatedTotal) || 0,
          parts_used: selectedParts,
          advance_amount: Number(form.advance_amount) || 0,
          commission_amount: 0
        };

        if (!editingItem) {
          payload.created_at = new Date().toISOString();
        }

        if (editingItem) {
          await db.updateWorkOrder(editingItem.id, payload);
        } else {
          await db.createWorkOrder(payload);
        }
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Work order saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600, py: 1.5 }}>
          {editingItem ? 'Edit Repair Order' : 'New Repair Order'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Repair Service</InputLabel>
                <Select value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} label="Repair Service">
                  <MenuItem value="">Select Service</MenuItem>
                  {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name} (Rs.{s.base_price})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Assign Technician</InputLabel>
                <Select value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} label="Assign Technician">
                  <MenuItem value="">Assign Staff</MenuItem>
                  {staffList.filter(s => s.active !== false).map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.role})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Device Model / Name" required value={form.device_model} onChange={e => setForm({...form, device_model: e.target.value})} placeholder="e.g. iPhone 13" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="IMEI / Serial Number" value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer</InputLabel>
                <Select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} label="Customer">
                  <MenuItem value="">Select Customer</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.phone})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Service Fee (Rs.)" 
                type="number" 
                value={form.service_fee} 
                onChange={e => setForm({...form, service_fee: e.target.value})} 
                placeholder="Enter service charge"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Problem Description / Fault Details" value={form.problem_description} onChange={e => setForm({...form, problem_description: e.target.value})} />
            </Grid>

            {/* PAYMENT SECTION */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Payment fontSize="small" color="primary" /> Payment Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Mode</InputLabel>
                      <Select 
                        value={form.payment_mode} 
                        onChange={e => setForm({...form, payment_mode: e.target.value})} 
                        label="Payment Mode"
                      >
                        {PAYMENT_MODES.map(m => (
                          <MenuItem key={m} value={m}>{m.toUpperCase()}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Status</InputLabel>
                      <Select 
                        value={form.payment_status} 
                        onChange={e => setForm({...form, payment_status: e.target.value})} 
                        label="Payment Status"
                      >
                        <MenuItem value="paid">PAID</MenuItem>
                        <MenuItem value="unpaid">UNPAID</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Advance Amount (Rs.)" 
                      type="number" 
                      value={form.advance_amount} 
                      onChange={e => setForm({...form, advance_amount: e.target.value})} 
                      placeholder="Enter advance payment"
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #10b981' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Service Fee</Typography>
                      <Typography variant="h6" fontWeight={600}>Rs. {Number(form.service_fee) || 0}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Parts Cost</Typography>
                      <Typography variant="h6" fontWeight={600}>Rs. {selectedParts.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                      <Typography variant="h6" fontWeight={700} color="primary.main">Rs. {calculatedTotal}</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Advance Paid</Typography>
                        <Typography variant="subtitle1" fontWeight={600} color="success.main">Rs. {Number(form.advance_amount) || 0}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Due Amount</Typography>
                        <Typography variant="subtitle1" fontWeight={700} color={calculatedTotal - (Number(form.advance_amount) || 0) > 0 ? 'error' : 'success'}>
                          Rs. {calculatedTotal - (Number(form.advance_amount) || 0)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
                
                {form.staff_id && calculatedTotal > 0 && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1, border: '1px solid #10b981' }}>
                    <Typography variant="caption" color="success.main" fontWeight={600}>
                      💡 Auto Commission Preview: Rs. {commissionPreview} 
                      ({staffList.find(s => String(s.id) === String(form.staff_id))?.commission_rate || 0}% of Rs. {calculatedTotal})
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      ✅ Ye commission automatically add hoga jab order <strong>"Completed"</strong> hoga.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* PARTS SECTION */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Inventory fontSize="small" color="primary" /> Parts Used (Stock & External Market)
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Search stock parts by name or SKU..." 
                    value={partSearch} 
                    onChange={e => setPartSearch(e.target.value)} 
                    sx={{ bgcolor: 'white', flex: 1, minWidth: 150 }} 
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} 
                  />
                  <FormControl size="small" sx={{ minWidth: 180, bgcolor: 'white' }}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categoriesList.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                {availableParts.length > 0 ? (
                  <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, mb: 2, bgcolor: 'white' }}>
                    {availableParts.map(p => {
                      const productName = getProductName(p);
                      const category = getProductCategory(p);
                      const stock = getProductStock(p);
                      
                      return (
                        <Box 
                          key={p.id} 
                          sx={{ 
                            p: 1.5, 
                            borderBottom: '1px solid #f0f0f0', 
                            '&:hover': { bgcolor: '#f5f5f5' }, 
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }} 
                          onClick={() => addStockPart(p)}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {productName}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.secondary">
                                SKU: {p.sku || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="primary.main" fontWeight={500}>
                                Category: {category}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Price: Rs.{p.purchase_price || p.cost_price || 0}
                              </Typography>
                              <Typography variant="caption" color={stock > 10 ? 'success.main' : stock > 5 ? 'warning.main' : 'error.main'}>
                                Stock: {stock}
                              </Typography>
                            </Box>
                          </Box>
                          {stock <= 5 && (
                            <Warning fontSize="small" color="warning" sx={{ ml: 0.5, fontSize: 14 }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa', borderRadius: 1, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {categoryFilter ? `No products available in "${categoryFilter}" category` : 'No stock products available'}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField 
                    size="small" 
                    placeholder="External Part Name" 
                    value={extPart.name} 
                    onChange={e => setExtPart({...extPart, name: e.target.value})} 
                    sx={{ flex: 2, bgcolor: 'white' }} 
                  />
                  <TextField 
                    size="small" 
                    type="number" 
                    placeholder="Cost (Rs.)" 
                    value={extPart.cost} 
                    onChange={e => setExtPart({...extPart, cost: e.target.value})} 
                    sx={{ flex: 1, bgcolor: 'white' }} 
                  />
                  <Button variant="outlined" size="small" onClick={addExternalPart} sx={{ textTransform: 'none' }}>
                    Add Ext.
                  </Button>
                </Box>

                {selectedParts.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Selected Parts ({selectedParts.length})
                    </Typography>
                    {selectedParts.map((p, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #e0e0e0' }}>
                        <Chip size="small" label={p.is_external ? 'Market' : 'Stock'} color={p.is_external ? 'warning' : 'success'} sx={{ fontSize: '0.55rem', height: 18 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                          {p.category && !p.is_external && (
                            <Typography variant="caption" color="primary.main">{p.category}</Typography>
                          )}
                        </Box>
                        <TextField 
                          type="number" 
                          size="small" 
                          value={p.cost} 
                          onChange={e => setSelectedParts(selectedParts.map(sp => sp.part_id === p.part_id ? {...sp, cost: Number(e.target.value)} : sp))} 
                          sx={{ width: 85 }} 
                          label="Price" 
                        />
                        <TextField 
                          type="number" 
                          size="small" 
                          value={p.quantity} 
                          onChange={e => updatePartQty(p.part_id, e.target.value)} 
                          sx={{ width: 65 }} 
                          label="Qty" 
                          inputProps={{ min: 1 }} 
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                          = Rs.{Number(p.cost) * Number(p.quantity)}
                        </Typography>
                        <IconButton size="small" color="error" onClick={() => updatePartQty(p.part_id, 0)}>
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fafafa' }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
            {editingItem ? 'Update Order' : 'Create Order'}
          </Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== SERVICE FORM ====================
  const ServiceForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      description: editingItem?.description || '',
      base_price: editingItem?.base_price || '',
      estimated_time: editingItem?.estimated_time || '',
      status: editingItem?.status || 'active'
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = { ...form, base_price: Number(form.base_price) || 0 };
        if (editingItem && db.updateService) await db.updateService(editingItem.id, payload);
        else if (db.createService) await db.createService(payload);
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Service saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>
          {editingItem ? 'Edit Service' : 'Add Service'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Service Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Base Price (Rs.)" type="number" value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Estimated Time" value={form.estimated_time} onChange={e => setForm({...form, estimated_time: e.target.value})} placeholder="e.g. 1 hour" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>Save</Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== STAFF FORM ====================
  const StaffForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      phone: editingItem?.phone || '',
      role: editingItem?.role || 'technician',
      commission_rate: editingItem?.commission_rate || 0,
      base_salary: editingItem?.base_salary || 0,
      active: editingItem?.active !== false,
      total_commission: editingItem?.total_commission || 0
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = { ...form };
        if (editingItem) {
          if (!payload.total_commission) {
            payload.total_commission = editingItem.total_commission || 0;
          }
          if (db.updateStaff) await db.updateStaff(editingItem.id, payload);
        } else {
          payload.total_commission = 0;
          if (db.createStaff) await db.createStaff(payload);
        }
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Staff saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>
          {editingItem ? 'Edit Staff' : 'Add Staff'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={form.role} onChange={e => setForm({...form, role: e.target.value})} label="Role">
                  {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Base Salary (Rs.)" type="number" value={form.base_salary} onChange={e => setForm({...form, base_salary: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Commission Rate (%)" 
                type="number" 
                value={form.commission_rate} 
                onChange={e => setForm({...form, commission_rate: e.target.value})}
                helperText="Jab order complete hoga, is % ke hisaab se auto-calculate hoga"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Total Commission Earned (Auto)" 
                type="number" 
                value={form.total_commission} 
                disabled
                helperText="✅ Auto-calculated from completed orders"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Commission automatically adds when orders complete">
                        <Info fontSize="small" color="success" />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #10b981' }}>
                <Typography variant="caption" color="success.main" fontWeight={600}>
                  💡 How Commission Works:
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  • Jab koi order <strong>"Completed"</strong> ho ga, commission auto-calculate ho ga
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  • Commission = Total Cost × (Commission Rate / 100)
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  • Ye commission staff ki total_commission mein add ho ga
                </Typography>
                <Typography variant="caption" display="block" color="success.main" fontWeight={600}>
                  ✅ Total Payout = Base Salary + Total Commission
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>Save</Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== REPORTS TAB ====================
  const ReportsTab = () => {
    const data = reportData;
    
    const statCards = [
      { label: 'Total Revenue', value: `Rs. ${data.totalRevenue}`, icon: <TrendingUp />, color: '#10b981' },
      { label: 'Total Orders', value: data.totalOrders, icon: <Receipt />, color: '#3b82f6' },
      { label: 'Completed', value: data.completedOrders, icon: <CheckCircle />, color: '#10b981' },
      { label: 'Pending', value: data.pendingOrders, icon: <Schedule />, color: '#f59e0b' },
      { label: 'In Progress', value: data.inProgressOrders, icon: <Build />, color: '#3b82f6' },
      { label: 'Cancelled', value: data.cancelledOrders, icon: <Cancel />, color: '#ef4444' },
      { label: 'Total Commission', value: `Rs. ${data.totalCommission}`, icon: <Payment />, color: '#8b5cf6' },
      { label: 'Total Advance', value: `Rs. ${data.totalAdvance}`, icon: <Payment />, color: '#06b6d4' },
      { label: 'Total Due', value: `Rs. ${data.totalDue}`, icon: <Payment />, color: '#ef4444' },
      { label: 'Completion Rate', value: `${data.completionRate}%`, icon: <TrendingUp />, color: '#10b981' }
    ];

    return (
      <Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statCards.map((stat, idx) => (
            <Grid item xs={6} sm={4} md={3} lg={2.4} key={idx}>
              <Paper sx={{ p: 2, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ 
                  bgcolor: `${stat.color}15`, 
                  borderRadius: '50%', 
                  p: 0.8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: stat.color,
                  mb: 0.5
                }}>
                  {stat.icon}
                </Box>
                <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>📊 Revenue Breakdown by Status</Typography>
          <Grid container spacing={3}>
            {Object.entries(data.revenueByStatus).map(([status, amount]) => {
              const config = STATUS_CONFIG[status] || { label: status, color: 'default' };
              return (
                <Grid item xs={6} sm={3} key={status}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip size="small" label={config.label} color={config.color} sx={{ fontWeight: 500 }} />
                    <Typography variant="body2" fontWeight={600}>Rs. {amount}</Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>👥 Staff Performance</Typography>
          {data.staffPerformance.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No staff data available</Typography>
          ) : (
            <Grid container spacing={2}>
              {data.staffPerformance.map((staff, idx) => (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#10b981', fontWeight: 700 }}>{staff.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{staff.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{staff.role}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 1.5 }} />
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" fontWeight={500}>{staff.totalOrders}</Typography>
                      <Typography variant="body2" color="text.secondary">Completed:</Typography>
                      <Typography variant="body2" fontWeight={500} color="success.main">{staff.completedOrders}</Typography>
                      <Typography variant="body2" color="text.secondary">Commission:</Typography>
                      <Typography variant="body2" fontWeight={500} color="primary.main">Rs. {staff.totalCommission}</Typography>
                      <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                      <Typography variant="body2" fontWeight={500}>Rs. {staff.totalRevenue}</Typography>
                      <Typography variant="body2" color="text.secondary">Total Payout:</Typography>
                      <Typography variant="body2" fontWeight={700} color="#10b981">Rs. {staff.totalPayout}</Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>✅ Recent Completed Orders</Typography>
          {data.recentCompleted.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No completed orders yet</Typography>
          ) : (
            <Stack spacing={1.5}>
              {data.recentCompleted.map(order => {
                const staff = staffList.find(s => String(s.id) === String(order.staff_id));
                const dueAmount = order.total_cost - (order.advance_amount || 0);
                
                return (
                  <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>#{order.id}</Typography>
                        <Typography variant="body2">{order.device_model || order.machine_name}</Typography>
                        <Chip size="small" label={order.payment_status === 'paid' ? 'Paid' : 'Unpaid'} color={order.payment_status === 'paid' ? 'success' : 'error'} sx={{ height: 20, fontSize: '0.6rem' }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Staff: {order.staff_name || '—'}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          Rs. {order.total_cost}
                        </Typography>
                        <Tooltip title="Print Bill">
                          <IconButton size="small" color="primary" onClick={() => printBill(order, staffList)}>
                            <Print fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {order.commission_amount > 0 && (
                      <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.5 }}>
                        💰 Commission: Rs. {order.commission_amount} 
                        {staff && ` (${staff.commission_rate || 0}%)`}
                      </Typography>
                    )}
                    {dueAmount > 0 && (
                      <Typography variant="caption" color="error" display="block">
                        Due: Rs. {dueAmount}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>
    );
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 10, sm: 4 }, maxWidth: 1400, mx: 'auto' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700} color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Smartphone color="primary" /> Mobile Repair & Workshop
        </Typography>
        <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={loadAll} sx={{ borderRadius: 2 }}>
          Refresh
        </Button>
      </Box>

      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} elevation={1}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Build fontSize="small" />} iconPosition="start" label={`Work Orders (${workOrders.length})`} value="workorders" sx={{ fontWeight: 600 }} />
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label={`Services (${services.length})`} value="services" sx={{ fontWeight: 600 }} />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label={`Staff & Payroll`} value="staff" sx={{ fontWeight: 600 }} />
          <Tab icon={<Assessment fontSize="small" />} iconPosition="start" label="📊 Reports" value="reports" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {activeTab === 'workorders' && (
          <>
            <Button variant="contained" startIcon={<Add />} onClick={() => openModal('workorder')} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: 2 }}>
              New Repair Order
            </Button>
            <TextField size="small" placeholder="Search by model, IMEI, customer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} sx={{ flex: 1, minWidth: 220, bgcolor: 'background.paper', borderRadius: 2 }} />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
        {activeTab === 'services' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('service')} sx={{ bgcolor: '#10b981', borderRadius: 2 }}>Add Service</Button>}
        {activeTab === 'staff' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('staff')} sx={{ bgcolor: '#10b981', borderRadius: 2 }}>Add Staff</Button>}
        {activeTab === 'reports' && (
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadAll} sx={{ borderRadius: 2 }}>
            Refresh Report
          </Button>
        )}
      </Box>

      {loading && <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>}

      {!loading && activeTab === 'workorders' && (
        <Grid container spacing={2.5}>
          {filteredWorkOrders.length === 0 ? (
            <Grid item xs={12}><Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}><Typography color="text.secondary">No repair orders found</Typography></Paper></Grid>
          ) : (
            filteredWorkOrders.map(wo => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={wo.id}>
                <WorkOrderCard 
                  wo={wo} 
                  onEdit={(item) => openModal('workorder', item)} 
                  onDelete={(id) => handleDelete('workorder', id)} 
                  onStatusChange={updateWorkOrderStatus} 
                  onViewHistory={openCustomerHistory}
                  onPrint={(order) => printBill(order, staffList)}
                />
              </Grid>
            ))
          )}
        </Grid>
      )}

      {!loading && activeTab === 'services' && (
        <Grid container spacing={2.5}>
          {services.map(s => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
              <Card sx={{ height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{s.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>{s.description || 'No description provided'}</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight={700}>Rs. {s.base_price}</Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" sx={{ flex: 1 }} onClick={() => openModal('service', s)}>Edit</Button>
                  <Button size="small" variant="outlined" color="error" sx={{ flex: 1 }} onClick={() => handleDelete('service', s.id)}>Delete</Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && activeTab === 'staff' && (
        <Grid container spacing={2.5}>
          {staffList.map(s => {
            const staffOrders = workOrders.filter(w => String(w.staff_id) === String(s.id) && w.status === 'completed');
            const calculatedCommission = staffOrders.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0);
            const totalPayable = (Number(s.base_salary) || 0) + calculatedCommission;

            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                <Card sx={{ height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: '#10b981', fontWeight: 700 }}>{s.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{s.role}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack spacing={0.8}>
                      <Typography variant="body2" color="text.secondary">Base Salary: <strong>Rs. {s.base_salary || 0}</strong></Typography>
                      <Typography variant="body2" color="text.secondary">Commission Rate: <strong>{s.commission_rate || 0}%</strong></Typography>
                      <Typography variant="body2" color="success.main" fontWeight={500}>Completed Jobs: {staffOrders.length}</Typography>
                      <Typography variant="body2" color="primary.main" fontWeight={500}>Total Commission: Rs. {calculatedCommission}</Typography>
                    </Stack>
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" color="text.secondary">Total Payout</Typography>
                      <Typography variant="h6" fontWeight={700} color="primary.main">Rs. {totalPayable}</Typography>
                    </Box>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button size="small" variant="outlined" fullWidth onClick={() => openModal('staff', s)}>Edit Profile</Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {!loading && activeTab === 'reports' && <ReportsTab />}

      {/* CUSTOMER HISTORY DIALOG */}
      <Dialog open={customerHistory.open} onClose={() => setCustomerHistory({ open: false, customer: null, orders: [] })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>Customer Repair History</DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          {customerHistory.customer && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>{customerHistory.customer.name}</Typography>
              <Typography variant="body2" color="text.secondary">Phone: {customerHistory.customer.phone}</Typography>
            </Box>
          )}
          <Divider sx={{ mb: 2 }} />
          {customerHistory.orders.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No previous repairs recorded.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {customerHistory.orders.map(o => {
                const totalPartsCost = o.parts_used?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0;
                const serviceFee = o.total_cost - totalPartsCost;
                const dueAmount = o.total_cost - (o.advance_amount || 0);
                
                return (
                  <Paper key={o.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>{o.device_model}</Typography>
                      <Chip size="small" label={o.status} color={o.status === 'completed' ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.6rem' }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fault: {o.problem_description || '—'}</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                      Service Fee: Rs.{serviceFee} | Parts: Rs.{totalPartsCost}
                    </Typography>
                    <Typography variant="body2" color="primary.main" fontWeight={700}>Total: Rs. {o.total_cost}</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Advance: Rs.{o.advance_amount || 0}</Typography>
                      <Typography variant="caption" color={dueAmount > 0 ? 'error' : 'success'}>
                        Due: Rs.{dueAmount}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Payment: {o.payment_status === 'paid' ? '✅ Paid' : '❌ Unpaid'} ({o.payment_mode?.toUpperCase() || 'PENDING'})
                    </Typography>
                    {o.commission_amount > 0 && (
                      <Typography variant="caption" color="success.main" display="block">
                        Staff Commission: Rs. {o.commission_amount}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCustomerHistory({ open: false, customer: null, orders: [] })} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      {/* STOCK ALERT DIALOG */}
      <Dialog open={stockAlert.open} onClose={() => setStockAlert({ open: false, message: '', parts: [] })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Check /> Stock Deducted Successfully
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            The following parts have been deducted from inventory:
          </Alert>
          <Stack spacing={1.5}>
            {stockAlert.parts.map((part, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>{part.name}</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Before: <strong>{part.before}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Used: <strong style={{ color: '#ef4444' }}>{part.used}</strong>
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    After: <strong>{part.after}</strong>
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setStockAlert({ open: false, message: '', parts: [] })} variant="contained" sx={{ bgcolor: '#10b981' }}>
            OK, Got it!
          </Button>
        </DialogActions>
      </Dialog>

      {/* GENERAL MODAL */}
      <Dialog open={showModal} onClose={closeModal} maxWidth="md" fullWidth fullScreen={isMobile} PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 } } }}>
        {modalType === 'workorder' && <WorkOrderForm />}
        {modalType === 'service' && <ServiceForm />}
        {modalType === 'staff' && <StaffForm />}
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}