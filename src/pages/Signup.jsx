import React, { useState } from 'react';
import {
  Box, CardContent, Typography, TextField, Button,
  Avatar, Divider, Stack, Alert, IconButton, InputAdornment,
  CircularProgress, Paper, Grid, Link as MuiLink, Stepper,
  Step, StepLabel, Checkbox, FormControlLabel, useMediaQuery,
  useTheme, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonAdd,
  Lock, Email, Person, Business, Phone, ArrowBack,
  ArrowForward, CheckCircle, LocationOn, Store,
  AttachMoney
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import db from '../database/db';

const steps = ['Account Info', 'Business Details', 'Review'];

// ==================== BUSINESS TYPES ====================
const BUSINESS_TYPES = [
  { value: 'retail', label: '🛍️ Retail Store' },
  { value: 'wholesale', label: '📦 Wholesale' },
  { value: 'restaurant', label: '🍽️ Restaurant / Cafe' },
  { value: 'electronics', label: '💻 Electronics' },
  { value: 'clothing', label: '👕 Clothing & Fashion' },
  { value: 'shoes', label: '👟 Shoes' },
  { value: 'mobile', label: '📱 Mobile Shop' },
  { value: 'grocery', label: '🛒 Grocery / Kirana' },
  { value: 'pharmacy', label: '💊 Pharmacy / Medical' },
  { value: 'other', label: '📋 Other' }
];

// ==================== CURRENCIES ====================
const CURRENCIES = [
  { value: 'PKR', label: '🇵🇰 PKR - Pakistani Rupee', symbol: 'Rs.' },
  { value: 'USD', label: '🇺🇸 USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: '🇪🇺 EUR - Euro', symbol: '€' },
  { value: 'GBP', label: '🇬🇧 GBP - British Pound', symbol: '£' },
  { value: 'INR', label: '🇮🇳 INR - Indian Rupee', symbol: '₹' },
  { value: 'AED', label: '🇦🇪 AED - UAE Dirham', symbol: 'د.إ' },
  { value: 'SAR', label: '🇸🇦 SAR - Saudi Riyal', symbol: '﷼' },
  { value: 'CAD', label: '🇨🇦 CAD - Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: '🇦🇺 AUD - Australian Dollar', symbol: 'A$' }
];

export default function Signup() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    shopName: '', shopAddress: '', businessType: 'retail', currency: 'PKR'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (error) setError('');
  };

  const validateStep = () => {
    if (activeStep === 0) {
      if (!form.name || !form.email || !form.phone || !form.password || !form.confirmPassword) {
        setError('All fields are required'); return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        setError('Please enter a valid email address'); return false;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match'); return false;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters'); return false;
      }
    } else if (activeStep === 1) {
      if (!form.shopName || !form.shopAddress) {
        setError('Shop name and address are required'); return false;
      }
    } else if (activeStep === 2 && !agreed) {
      setError('Please agree to the terms and conditions'); return false;
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) setActiveStep((prev) => prev + 1); };
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError('');

    try {
      // ===== FIREBASE REGISTER (Web / Cloud Mode) =====
      if (register) {
        const shopData = {
          name: form.name,
          shopName: form.shopName,
          phone: form.phone,
          businessType: form.businessType,
          currency: form.currency,
          shopAddress: form.shopAddress
        };

        const result = await register(form.email, form.password, shopData);
        if (result.success) {
          navigate('/');
          return;
        }
        if (result.error && !result.error.includes('auth/network-request-failed')) {
          setError(result.error);
          setLoading(false);
          return;
        }
        console.warn('[Signup] Firebase register failed, falling back to local DB:', result.error);
      }

      // ===== LOCAL DB REGISTER (Electron / Offline Fallback) =====
      const existing = await db.getUserByEmail(form.email);
      if (existing) {
        setError('Email already registered.');
        setLoading(false);
        return;
      }

      const userData = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: 'admin',
        shop_name: form.shopName,
        shop_address: form.shopAddress,
        business_type: form.businessType,
        currency: form.currency,
        status: 'active'
      };

      const result = await db.createUser(userData);
      const userId = result?.lastInsertRowid || Date.now();

      const userToStore = {
        id: userId,
        name: form.name,
        email: form.email,
        role: 'admin',
        shop_name: form.shopName,
        shop_id: `shop_${userId}`,
      };

      login(userToStore);
      navigate('/');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'System Error: Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={isMobile ? 2 : 2.5}>
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Person color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Email color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Phone color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Lock color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size={isMobile ? 'small' : 'medium'}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Lock color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size={isMobile ? 'small' : 'medium'}>
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        );
      
      case 1:
        return (
          <Stack spacing={isMobile ? 2 : 2.5}>
            <TextField
              fullWidth
              label="Shop / Business Name"
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Store color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Shop Address"
              name="shopAddress"
              multiline
              rows={isMobile ? 2 : 3}
              value={form.shopAddress}
              onChange={handleChange}
              size={isMobile ? 'small' : 'medium'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><LocationOn color="action" /></InputAdornment>
                ),
              }}
            />
            
            {/* ✅ FIXED: Business Type Select */}
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel id="business-type-label">Business Type</InputLabel>
              <Select
                labelId="business-type-label"
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                label="Business Type"
                startAdornment={
                  <InputAdornment position="start">
                    <Business color="action" />
                  </InputAdornment>
                }
              >
                {BUSINESS_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* ✅ FIXED: Currency Select */}
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel id="currency-label">Currency</InputLabel>
              <Select
                labelId="currency-label"
                name="currency"
                value={form.currency}
                onChange={handleChange}
                label="Currency"
                startAdornment={
                  <InputAdornment position="start">
                    <AttachMoney color="action" />
                  </InputAdornment>
                }
              >
                {CURRENCIES.map((cur) => (
                  <MenuItem key={cur.value} value={cur.value}>
                    {cur.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        );
      
      case 2:
        return (
          <Stack spacing={isMobile ? 1.5 : 2}>
            <Paper variant="outlined" sx={{ p: isMobile ? 1.5 : 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                <Person fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Account Information
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={isMobile ? 0.5 : 1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Name</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontWeight="medium">{form.name}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Email</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontWeight="medium">{form.email}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Phone</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontWeight="medium">{form.phone}</Typography></Grid>
              </Grid>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: isMobile ? 1.5 : 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                <Business fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Business Details
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={isMobile ? 0.5 : 1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Shop Name</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontWeight="medium">{form.shopName}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Address</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontWeight="medium">{form.shopAddress}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Business Type</Typography></Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="medium">
                    {BUSINESS_TYPES.find(t => t.value === form.businessType)?.label || form.businessType}
                  </Typography>
                </Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Currency</Typography></Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="medium">
                    {CURRENCIES.find(c => c.value === form.currency)?.label || form.currency}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Typography variant="body2">
                  I agree to the <MuiLink href="#" underline="hover">Terms & Conditions</MuiLink> and{' '}
                  <MuiLink href="#" underline="hover">Privacy Policy</MuiLink>
                </Typography>
              }
            />
          </Stack>
        );
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      p: isMobile ? 1 : 2
    }}>
      <Grid container justifyContent="center" maxWidth={600}>
        <Paper elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', width: '100%' }}>
          {/* Header */}
          <Box sx={{ bgcolor: '#10b981', p: isMobile ? 2 : 3, textAlign: 'center', color: 'white' }}>
            <Avatar sx={{ 
              width: isMobile ? 48 : 64, 
              height: isMobile ? 48 : 64, 
              bgcolor: 'white', 
              color: '#10b981', 
              mx: 'auto', 
              mb: 1.5 
            }}>
              <PersonAdd sx={{ fontSize: isMobile ? 24 : 32 }} />
            </Avatar>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">Create Account</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Set up your RAATH POS system in minutes
            </Typography>
          </Box>

          <CardContent sx={{ p: isMobile ? 2 : 4 }}>
            {/* Stepper - Mobile Friendly */}
            <Box sx={{ mb: 3, overflowX: 'auto' }}>
              <Stepper 
                activeStep={activeStep} 
                alternativeLabel={!isMobile}
                orientation={isMobile ? 'vertical' : 'horizontal'}
                sx={{ 
                  '& .MuiStepLabel-label': { 
                    fontSize: isMobile ? '0.7rem' : '0.875rem' 
                  } 
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: isMobile ? '0.8rem' : '1rem' }}>{error}</Alert>}

            {renderStepContent(activeStep)}

            {/* Navigation Buttons */}
            <Stack 
              direction={isMobile ? 'column' : 'row'} 
              spacing={isMobile ? 1 : 2} 
              sx={{ mt: isMobile ? 3 : 4 }}
            >
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={activeStep === 0 || loading}
                startIcon={<ArrowBack />}
                fullWidth={isMobile}
                size={isMobile ? 'small' : 'medium'}
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  sx={{ 
                    bgcolor: '#10b981', 
                    '&:hover': { bgcolor: '#059669' },
                    width: isMobile ? '100%' : 'auto'
                  }}
                  endIcon={loading ? <CircularProgress size={isMobile ? 16 : 18} color="inherit" /> : <CheckCircle />}
                  size={isMobile ? 'small' : 'medium'}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                  fullWidth={isMobile}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                >
                  Next
                </Button>
              )}
            </Stack>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                Already have an account?{' '}
                <MuiLink 
                  component={Link} 
                  to="/login" 
                  underline="hover" 
                  fontWeight="bold"
                  sx={{ color: '#10b981' }}
                >
                  Sign In
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Paper>
      </Grid>
    </Box>
  );
}