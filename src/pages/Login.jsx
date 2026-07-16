import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress, Paper,
  InputAdornment, IconButton, Link as MuiLink, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Card, CardContent
} from '@mui/material';
import { 
  Visibility, VisibilityOff, Email, Lock, Login as LoginIcon,
  Key, Close, ContentCopy, CheckCircle
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import db from '../database/db';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleForgotOpen = () => {
    setForgotOpen(true);
    setForgotEmail('');
    setForgotError('');
    setFoundUser(null);
    setCopied(false);
  };

  const handleForgotClose = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotError('');
    setFoundUser(null);
    setCopied(false);
  };

  const handleForgotSubmit = async () => {
    setForgotError('');
    setFoundUser(null);
    setCopied(false);

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      setForgotError('Please enter a valid email address');
      return;
    }

    // ===== DEMO FORGOT PASSWORD =====
    if (forgotEmail.toLowerCase() === 'admin@posit.com') {
      setFoundUser({
        name: 'Admin User',
        email: 'admin@posit.com',
        password: 'admin123',
        role: 'admin'
      });
      return;
    }

    setForgotLoading(true);
    try {
      const user = await db.getUserByEmail(forgotEmail.trim().toLowerCase());
      if (!user) {
        setForgotError('No account found with this email address');
        setForgotLoading(false);
        return;
      }
      setFoundUser({
        name: user.name,
        email: user.email,
        password: user.password || user.password_hash || 'N/A',
        role: user.role
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Failed to retrieve account. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (foundUser?.password) {
      navigator.clipboard.writeText(foundUser.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const result = await login(form.email, form.password);

      if (result.success) {
        const { role } = result;
        console.log('[Login] Success. Role pages:', role?.pages);

        if (role?.pages?.includes('dashboard')) {
          navigate('/', { replace: true });
        } else if (role?.pages?.includes('pos')) {
          navigate('/billing', { replace: true });
        } else if (role?.pages?.length > 0) {
          navigate('/' + role.pages[0], { replace: true });
        } else {
          setError('No pages assigned to your role. Contact admin.');
          return;
        }
        return;
      }

      setError(result.error || 'Invalid email or password');
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
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
      <Paper elevation={6} sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'success.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}>
            <LoginIcon sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to your RAATH POS account
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            disabled={loading}
            required
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }
            }}
          />
          <TextField
            fullWidth
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={handleChange}
            disabled={loading}
            required
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            }}
          />

          <Box sx={{ textAlign: 'right', mb: 2 }}>
            <MuiLink
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              onClick={handleForgotOpen}
              sx={{ color: 'primary.main', fontWeight: 500 }}
            >
              Forgot Password?
            </MuiLink>
          </Box>

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark' },
              borderRadius: 2,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '1rem'
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            OR
          </Typography>
        </Divider>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <MuiLink
              component={Link}
              to="/signup"
              underline="hover"
              fontWeight="bold"
              sx={{ color: 'success.main' }}
            >
              Create Account
            </MuiLink>
          </Typography>
        </Box>

        {/* DEMO LOGIN BOX */}
        <Box 
          sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'warning.50', 
            borderRadius: 2, 
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'warning.main'
          }}
        >
          <Typography variant="caption" color="warning.dark" display="block" fontWeight="bold" sx={{ mb: 0.5 }}>
            ⚡ DEMO LOGIN
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>admin@posit.com</strong> / <strong>admin123</strong>
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            sx={{ mt: 1, textTransform: 'none' }}
            onClick={() => {
              setForm({ email: 'admin@posit.com', password: 'admin123' });
            }}
          >
            Auto-Fill Demo Credentials
          </Button>
        </Box>
      </Paper>

      {/* FORGOT PASSWORD DIALOG */}
      <Dialog 
        open={forgotOpen} 
        onClose={handleForgotClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Forgot Password
            </Typography>
          </Box>
          <IconButton onClick={handleForgotClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {!foundUser ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your registered email address to retrieve your password.
              </Typography>

              {forgotError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {forgotError}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value);
                  if (forgotError) setForgotError('');
                }}
                disabled={forgotLoading}
                placeholder="your@email.com"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{ mb: 2 }}
              />
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                Account found! Here are your login credentials:
              </Alert>

              <Card variant="outlined" sx={{ bgcolor: 'grey.50', borderRadius: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      NAME
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {foundUser.name}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      EMAIL
                    </Typography>
                    <Typography variant="body1">
                      {foundUser.email}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      ROLE
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip 
                        label={foundUser.role?.toUpperCase() || 'USER'} 
                        color="primary" 
                        size="small" 
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      PASSWORD
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      mt: 0.5,
                      bgcolor: 'background.paper',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'divider'
                    }}>
                      <Typography 
                        variant="body1" 
                        fontWeight="bold" 
                        color="success.main"
                        sx={{ 
                          fontFamily: 'monospace',
                          letterSpacing: 1,
                          flex: 1
                        }}
                      >
                        {foundUser.password}
                      </Typography>
                      <Button
                        size="small"
                        variant={copied ? "contained" : "outlined"}
                        color={copied ? "success" : "primary"}
                        startIcon={copied ? <CheckCircle /> : <ContentCopy />}
                        onClick={handleCopyPassword}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                ⚠️ For security reasons, please change your password after login.
              </Typography>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          {!foundUser ? (
            <>
              <Button 
                onClick={handleForgotClose} 
                color="inherit"
                disabled={forgotLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleForgotSubmit}
                variant="contained"
                disabled={forgotLoading || !forgotEmail.trim()}
                startIcon={forgotLoading ? <CircularProgress size={16} /> : <Key />}
              >
                {forgotLoading ? 'Searching...' : 'Find Account'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleForgotClose} 
                color="inherit"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setForm({ email: foundUser.email, password: foundUser.password });
                  handleForgotClose();
                }}
                variant="contained"
                color="success"
                startIcon={<LoginIcon />}
              >
                Auto-Fill & Login
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}