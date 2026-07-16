import React, { useState } from 'react';
import {
  Box, CardContent, Typography, TextField, Button,
  Avatar, Divider, Stack, Alert, IconButton, InputAdornment,
  CircularProgress, Paper, Grid, Link as MuiLink, Stepper,
  Step, StepLabel, Checkbox, FormControlLabel
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonAdd,
  Lock, Email, Person, Business, Phone, ArrowBack,
  ArrowForward, CheckCircle, LocationOn
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import db from '../database/db';

const steps = ['Account Info', 'Business Details', 'Review'];

export default function Signup() {
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
    setForm({ ...form, [e.target.name]: e.target.value });
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
        // If register exists but failed, show error (don't silently fallback)
        if (result.error && !result.error.includes('auth/network-request-failed')) {
          setError(result.error);
          setLoading(false);
          return;
        }
        // Network or other error — fall through to local DB
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
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Lock color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Lock color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
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
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Shop / Business Name"
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Business color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Shop Address"
              name="shopAddress"
              multiline
              rows={3}
              value={form.shopAddress}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><LocationOn color="action" /></InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              select
              label="Business Type"
              name="businessType"
              value={form.businessType}
              onChange={handleChange}
              SelectProps={{ native: true }}
            >
              <option value="retail">Retail Store</option>
              <option value="wholesale">Wholesale</option>
              <option value="restaurant">Restaurant / Cafe</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing & Fashion</option>
              <option value="shoes">Shoes</option>
              <option value="mobile">Mobile Shop</option>
              <option value="other">Other</option>
            </TextField>
            <TextField
              fullWidth
              select
              label="Currency"
              name="currency"
              value={form.currency}
              onChange={handleChange}
              SelectProps={{ native: true }}
            >
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="AED">AED - UAE Dirham</option>
            </TextField>
          </Stack>
        );
      case 2:
        return (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                <Person fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Account Information
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Name</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.name}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Email</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.email}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Phone</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.phone}</Typography></Grid>
              </Grid>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                <Business fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Business Details
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Shop Name</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.shopName}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Address</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.shopAddress}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Business Type</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.businessType}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Currency</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2">{form.currency}</Typography></Grid>
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
      p: 2
    }}>
      <Grid container justifyContent="center" maxWidth={600}>
        <Paper elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', width: '100%' }}>
          {/* Header */}
          <Box sx={{ bgcolor: 'success.main', p: 3, textAlign: 'center', color: 'white' }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'white', color: 'success.main', mx: 'auto', mb: 2 }}>
              <PersonAdd sx={{ fontSize: 32 }} />
            </Avatar>
            <Typography variant="h5" fontWeight="bold">Create Account</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Set up your RAATH POS system in minutes
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {renderStepContent(activeStep)}

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={activeStep === 0 || loading}
                startIcon={<ArrowBack />}
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
                  endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                >
                  Next
                </Button>
              )}
            </Stack>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <MuiLink component={Link} to="/login" underline="hover" fontWeight="bold">
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