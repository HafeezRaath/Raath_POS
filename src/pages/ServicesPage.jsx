import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Card, CardContent, IconButton, Stack, Divider,
  Snackbar, Alert, CircularProgress, Avatar, Badge, Tooltip,
  useMediaQuery, useTheme, Tabs, Tab, Fade, Zoom, Drawer,
  List, ListItem, ListItemText, ListItemIcon, Fab, Collapse,
  Switch, FormControlLabel, InputAdornment
} from '@mui/material';
import {
  Add, Edit, Delete, Search, FilterList, Close, CheckCircle,
  Cancel, Schedule, Build, Person, Phone, Store, AttachMoney,
  Notes, Menu as MenuIcon, ArrowUpward, ArrowDownward,
  Receipt, Inventory, Refresh, Warning, Check, Clear
} from '@mui/icons-material';
import db from '../database/db';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'warning', icon: <Schedule fontSize="small" /> },
  'in-progress': { label: 'In Progress', color: 'info', icon: <Build fontSize="small" /> },
  completed: { label: 'Completed', color: 'success', icon: <CheckCircle fontSize="small" /> },
  cancelled: { label: 'Cancelled', color: 'error', icon: <Cancel fontSize="small" /> }
};

const STATUS_FLOW = {
  pending: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const ROLES = ['technician', 'tailor', 'manager', 'helper'];

// ==================== MOBILE WORK ORDER CARD ====================
const MobileWorkOrderCard = ({ wo, onEdit, onDelete, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
  const nextStatuses = STATUS_FLOW[wo.status] || [];

  return (
    <Card sx={{ mb: 1.5, borderLeft: `4px solid ${status.color === 'warning' ? '#f59e0b' : status.color === 'info' ? '#3b82f6' : status.color === 'success' ? '#10b981' : '#ef4444'}` }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                size="small" 
                label={`${status.icon} ${status.label}`}
                color={status.color}
                sx={{ height: 20, fontSize: '0.55rem', fontWeight: 'bold' }}
              />
              <Typography variant="caption" color="text.secondary">#{wo.id}</Typography>
            </Stack>
            <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ mt: 0.5 }}>
              {wo.machine_name}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            {wo.total_cost > 0 && (
              <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                Rs. {wo.total_cost}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <Chip size="small" label={wo.service_name || 'No Service'} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
          <Chip size="small" label={wo.staff_name || 'No Staff'} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
          {wo.customer_name && (
            <Chip size="small" label={`👤 ${wo.customer_name}`} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
          )}
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            {wo.created_at && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Created</Typography>
                <Typography variant="body2">{new Date(wo.created_at).toLocaleDateString()}</Typography>
              </Grid>
            )}
            {wo.parts_used?.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Parts Used</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {wo.parts_used.map((p, i) => (
                    <Chip key={i} size="small" label={`${p.name} ×${p.quantity}`} sx={{ height: 18, fontSize: '0.5rem' }} />
                  ))}
                </Box>
              </Grid>
            )}
            {wo.notes && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: '#fffbeb' }}>
                  <Typography variant="body2">{wo.notes}</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          {nextStatuses.map(ns => (
            <Button
              key={ns}
              size="small"
              variant="contained"
              onClick={() => onStatusChange(wo.id, ns)}
              sx={{
                flex: 1,
                fontSize: '0.6rem',
                py: 0.5,
                bgcolor: ns === 'completed' ? '#10b981' : ns === 'in-progress' ? '#3b82f6' : '#ef4444',
                '&:hover': { bgcolor: ns === 'completed' ? '#059669' : ns === 'in-progress' ? '#2563eb' : '#dc2626' }
              }}
            >
              {ns === 'completed' ? '✅ Complete' : ns === 'in-progress' ? '🔧 Start' : '❌ Cancel'}
            </Button>
          ))}
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(wo)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
            Edit
          </Button>
          <IconButton size="small" color="error" onClick={() => onDelete(wo.id)}>
            <Delete fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function ServicesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState('workorders');
  const [workOrders, setWorkOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mobileDrawer, setMobileDrawer] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wo, sv, st, cu, pr] = await Promise.all([
        db.getWorkOrders(),
        db.getServices(),
        db.getStaff(),
        db.getCustomers(),
        db.getAllVariants()
      ]);
      setWorkOrders(wo || []);
      setServices(sv || []);
      setStaffList(st || []);
      setCustomers(cu || []);
      setProducts(pr || []);
    } catch (e) {
      console.error('Load error:', e);
      setSnackbar({ open: true, message: 'Error loading data: ' + e.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkOrders = useMemo(() => {
    let result = [...workOrders];
    if (statusFilter) result = result.filter(w => w.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => 
        (w.machine_name || '').toLowerCase().includes(q) ||
        (w.service_name || '').toLowerCase().includes(q) ||
        (w.staff_name || '').toLowerCase().includes(q) ||
        (w.customer_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, statusFilter, searchQuery]);

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

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      if (type === 'service') await db.deleteService(id);
      else if (type === 'staff') await db.deleteStaff(id);
      else if (type === 'workorder') await db.deleteWorkOrder(id);
      loadAll();
      setSnackbar({ open: true, message: 'Deleted successfully!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Error: ' + e.message, severity: 'error' });
    }
  };

  const updateWorkOrderStatus = async (id, newStatus) => {
    try {
      const order = workOrders.find(w => String(w.id) === String(id));
      await db.updateWorkOrder(id, { status: newStatus });
      if (newStatus === 'completed' && order?.parts_used?.length > 0) {
        await db.deductWorkOrderParts(order.parts_used);
      }
      loadAll();
      setSnackbar({ open: true, message: `Status updated to ${newStatus}`, severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Error: ' + e.message, severity: 'error' });
    }
  };

  // ==================== FORMS ====================
  const WorkOrderForm = () => {
    const [form, setForm] = useState({
      service_id: editingItem?.service_id || '',
      staff_id: editingItem?.staff_id || '',
      customer_id: editingItem?.customer_id || '',
      machine_name: editingItem?.machine_name || '',
      status: editingItem?.status || 'pending',
      notes: editingItem?.notes || '',
      total_cost: editingItem?.total_cost || ''
    });
    const [selectedParts, setSelectedParts] = useState(editingItem?.parts_used || []);
    const [partSearch, setPartSearch] = useState('');

    const availableParts = useMemo(() => {
      if (!partSearch) return products.slice(0, 10);
      const q = partSearch.toLowerCase();
      return products.filter(p => 
        (p.sku || '').toLowerCase().includes(q) || 
        (p.variant_name || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q)
      );
    }, [partSearch, products]);

    const addPart = (product) => {
      const exists = selectedParts.find(p => p.part_id === product.sku);
      if (exists) {
        setSelectedParts(selectedParts.map(p => 
          p.part_id === product.sku ? { ...p, quantity: p.quantity + 1 } : p
        ));
      } else {
        setSelectedParts([...selectedParts, {
          part_id: product.sku,
          name: product.variant_name || product.product_name || 'Unknown',
          quantity: 1,
          cost_at_time: product.purchase_price || 0
        }]);
      }
      setPartSearch('');
    };

    const updatePartQty = (partId, qty) => {
      const num = parseInt(qty) || 0;
      if (num <= 0) {
        setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
      } else {
        setSelectedParts(selectedParts.map(p => p.part_id === partId ? { ...p, quantity: num } : p));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = {
          ...form,
          total_cost: Number(form.total_cost) || 0,
          parts_used: selectedParts
        };
        if (editingItem) {
          await db.updateWorkOrder(editingItem.id, payload);
        } else {
          await db.createWorkOrder(payload);
        }
        loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Work order saved!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingItem ? 'Edit Work Order' : 'New Work Order'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Service *</InputLabel>
                <Select value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} required>
                  <MenuItem value="">Select Service</MenuItem>
                  {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Staff *</InputLabel>
                <Select value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} required>
                  <MenuItem value="">Assign Staff</MenuItem>
                  {staffList.filter(s => s.active !== false).map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name} ({s.role})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Machine / Item *" 
                value={form.machine_name} onChange={e => setForm({...form, machine_name: e.target.value})} required />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer</InputLabel>
                <Select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
                  <MenuItem value="">Select Customer</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {editingItem && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="in-progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Total Cost (Rs.)" type="number"
                value={form.total_cost} onChange={e => setForm({...form, total_cost: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Notes"
                value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  <Inventory sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 16 }} />
                  Parts from Inventory
                </Typography>
                <TextField fullWidth size="small" placeholder="Search parts by name or SKU..."
                  value={partSearch} onChange={e => setPartSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }} />
                {partSearch && availableParts.length > 0 && (
                  <Box sx={{ maxHeight: 120, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 1, mt: 1 }}>
                    {availableParts.map(p => (
                      <Box key={p.id} sx={{ p: 1, borderBottom: '1px solid #e5e7eb', '&:hover': { bgcolor: '#f0fdf4' }, cursor: 'pointer' }}
                        onClick={() => addPart(p)}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">{p.variant_name || p.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">Stock: {p.current_stock || 0}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                {selectedParts.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {selectedParts.map((p, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">Rs. {p.cost_at_time}</Typography>
                        <TextField type="number" size="small" value={p.quantity}
                          onChange={e => updatePartQty(p.part_id, e.target.value)}
                          sx={{ width: 60 }} inputProps={{ min: 1 }} />
                        <IconButton size="small" color="error" onClick={() => updatePartQty(p.part_id, 0)}>
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                    <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'right' }}>
                      Parts Cost: Rs. {selectedParts.reduce((sum, p) => sum + (p.cost_at_time * p.quantity), 0)}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={closeModal}>Cancel</Button>
          <Button fullWidth={isMobile} type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    );
  };

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
        if (editingItem) await db.updateService(editingItem.id, payload);
        else await db.createService(payload);
        loadAll(); closeModal();
        setSnackbar({ open: true, message: 'Service saved!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingItem ? 'Edit Service' : 'Add Service'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Service Name *" 
                value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Description"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Base Price (Rs.)" type="number"
                value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Estimated Time"
                value={form.estimated_time} onChange={e => setForm({...form, estimated_time: e.target.value})}
                placeholder="e.g., 2 hrs" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={closeModal}>Cancel</Button>
          <Button fullWidth={isMobile} type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </form>
    );
  };

  const StaffForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      phone: editingItem?.phone || '',
      role: editingItem?.role || 'technician',
      active: editingItem?.active !== false
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (editingItem) await db.updateStaff(editingItem.id, form);
        else await db.createStaff(form);
        loadAll(); closeModal();
        setSnackbar({ open: true, message: 'Staff saved!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingItem ? 'Edit Staff' : 'Add Staff'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Name *" 
                value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Phone"
                value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {ROLES.map(r => <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel 
                control={<Switch checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />}
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={closeModal}>Cancel</Button>
          <Button fullWidth={isMobile} type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </form>
    );
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <Build sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Services' : 'Services & Work Orders'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="contained" size="small" startIcon={<Refresh />} onClick={loadAll} sx={{ bgcolor: '#10b981' }}>
            {isMobile ? 'Sync' : 'Refresh'}
          </Button>
        </Stack>
      </Box>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<Build fontSize="small" />} 
            label={isMobile ? `WO (${workOrders.length})` : `Work Orders (${workOrders.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Store fontSize="small" />} 
            label={isMobile ? `Services (${services.length})` : `Service Catalog (${services.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Person fontSize="small" />} 
            label={isMobile ? `Staff (${staffList.length})` : `Staff (${staffList.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* FILTERS / ACTIONS */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1.5, mb: 2 }}>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={() => openModal(activeTab === 'workorders' ? 'workorder' : activeTab === 'services' ? 'service' : 'staff')}
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, width: isMobile ? '100%' : 'auto' }}
        >
          {activeTab === 'workorders' ? 'New Work Order' : activeTab === 'services' ? 'Add Service' : 'Add Staff'}
        </Button>

        {activeTab === 'workorders' && (
          <>
            <TextField 
              fullWidth={isMobile} 
              size="small" 
              placeholder="Search by machine, service, staff..."
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 140 }}>
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty>
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
      </Box>

      {/* LOADING */}
      {loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading...</Typography>
        </Box>
      )}

      {/* ==================== TAB: WORK ORDERS ==================== */}
      {!loading && activeTab === 'workorders' && (
        <Fade in>
          {isMobile ? (
            // Mobile Cards
            <Box>
              {filteredWorkOrders.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Build sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No work orders found</Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={() => openModal('workorder')} sx={{ mt: 2, bgcolor: '#10b981' }}>
                    Create First Work Order
                  </Button>
                </Paper>
              ) : (
                filteredWorkOrders.map(wo => (
                  <MobileWorkOrderCard
                    key={wo.id}
                    wo={wo}
                    onEdit={openModal}
                    onDelete={(id) => handleDelete('workorder', id)}
                    onStatusChange={updateWorkOrderStatus}
                  />
                ))
              )}
            </Box>
          ) : (
            // Desktop Cards Grid
            <Grid container spacing={2}>
              {filteredWorkOrders.length === 0 ? (
                <Grid item xs={12}>
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Build sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No work orders found</Typography>
                  </Paper>
                </Grid>
              ) : (
                filteredWorkOrders.map(wo => {
                  const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
                  const nextStatuses = STATUS_FLOW[wo.status] || [];
                  return (
                    <Grid item xs={12} md={6} lg={4} key={wo.id}>
                      <Card sx={{ height: '100%', borderTop: `4px solid ${status.color === 'warning' ? '#f59e0b' : status.color === 'info' ? '#3b82f6' : status.color === 'success' ? '#10b981' : '#ef4444'}` }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Chip 
                              size="small" 
                              label={`${status.icon} ${status.label}`}
                              color={status.color}
                              sx={{ fontWeight: 'bold' }}
                            />
                            <Typography variant="caption" color="text.secondary">#{wo.id}</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight="bold" gutterBottom>{wo.machine_name}</Typography>
                          <Stack spacing={0.5} sx={{ mb: 1 }}>
                            <Typography variant="body2"><strong>Service:</strong> {wo.service_name || '—'}</Typography>
                            <Typography variant="body2"><strong>Staff:</strong> {wo.staff_name || '—'}</Typography>
                            {wo.customer_name && <Typography variant="body2"><strong>Customer:</strong> {wo.customer_name}</Typography>}
                            {wo.total_cost > 0 && <Typography variant="body2" color="primary.main" fontWeight="bold"><strong>Total:</strong> Rs. {wo.total_cost}</Typography>}
                          </Stack>
                          {wo.parts_used?.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">Parts Used</Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {wo.parts_used.map((p, i) => (
                                  <Chip key={i} size="small" label={`${p.name} ×${p.quantity}`} sx={{ height: 20, fontSize: '0.55rem' }} />
                                ))}
                              </Box>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                            {nextStatuses.map(ns => (
                              <Button
                                key={ns}
                                size="small"
                                variant="contained"
                                onClick={() => updateWorkOrderStatus(wo.id, ns)}
                                sx={{
                                  flex: 1,
                                  fontSize: '0.65rem',
                                  bgcolor: ns === 'completed' ? '#10b981' : ns === 'in-progress' ? '#3b82f6' : '#ef4444',
                                  '&:hover': { bgcolor: ns === 'completed' ? '#059669' : ns === 'in-progress' ? '#2563eb' : '#dc2626' }
                                }}
                              >
                                {ns === 'completed' ? '✅ Complete' : ns === 'in-progress' ? '🔧 Start' : '❌ Cancel'}
                              </Button>
                            ))}
                            <IconButton size="small" color="primary" onClick={() => openModal('workorder', wo)}><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDelete('workorder', wo.id)}><Delete fontSize="small" /></IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })
              )}
            </Grid>
          )}
        </Fade>
      )}

      {/* ==================== TAB: SERVICES ==================== */}
      {!loading && activeTab === 'services' && (
        <Fade in>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            {services.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Store sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No services yet</Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={() => openModal('service')} sx={{ mt: 2, bgcolor: '#10b981' }}>
                    Add Service
                  </Button>
                </Paper>
              </Grid>
            ) : (
              services.map(s => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" fontWeight="bold">{s.name}</Typography>
                        <Chip size="small" color={s.status === 'active' ? 'success' : 'default'} label={s.status} />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {s.description || 'No description'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" color="primary.main" fontWeight="bold">Rs. {s.base_price || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.estimated_time || '—'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid #e5e7eb' }}>
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openModal('service', s)} sx={{ flex: 1 }}>Edit</Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => handleDelete('service', s.id)} sx={{ flex: 1 }}>Delete</Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Fade>
      )}

      {/* ==================== TAB: STAFF ==================== */}
      {!loading && activeTab === 'staff' && (
        <Fade in>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            {staffList.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Person sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No staff members</Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={() => openModal('staff')} sx={{ mt: 2, bgcolor: '#10b981' }}>
                    Add Staff
                  </Button>
                </Paper>
              </Grid>
            ) : (
              staffList.map(s => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                        <Avatar sx={{ bgcolor: s.active !== false ? '#10b981' : '#94a3b8' }}>
                          {s.name?.charAt(0).toUpperCase() || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">{s.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{s.role}</Typography>
                        </Box>
                        <Chip size="small" color={s.active !== false ? 'success' : 'default'} label={s.active !== false ? 'Active' : 'Inactive'} sx={{ ml: 'auto' }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary"><Phone sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> {s.phone || 'No phone'}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid #e5e7eb' }}>
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openModal('staff', s)} sx={{ flex: 1 }}>Edit</Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => handleDelete('staff', s.id)} sx={{ flex: 1 }}>Delete</Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Fade>
      )}

      {/* ==================== MODALS ==================== */}
      <Dialog open={showModal} onClose={closeModal} maxWidth="md" fullWidth fullScreen={isMobile}>
        {modalType === 'workorder' && <WorkOrderForm />}
        {modalType === 'service' && <ServiceForm />}
        {modalType === 'staff' && <StaffForm />}
      </Dialog>

      {/* ==================== MOBILE DRAWER ==================== */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); openModal('workorder'); }}>
              <ListItemIcon><Add /></ListItemIcon>
              <ListItemText primary="New Work Order" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); openModal('service'); }}>
              <ListItemIcon><Store /></ListItemIcon>
              <ListItemText primary="Add Service" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); openModal('staff'); }}>
              <ListItemIcon><Person /></ListItemIcon>
              <ListItemText primary="Add Staff" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadAll(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Refresh Data" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* ==================== FAB BUTTON ==================== */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }}
          onClick={() => openModal(activeTab === 'workorders' ? 'workorder' : activeTab === 'services' ? 'service' : 'staff')}
        >
          <Add />
        </Fab>
      )}

      {/* ==================== SNACKBAR ==================== */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(p => ({ ...p, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 0 }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}