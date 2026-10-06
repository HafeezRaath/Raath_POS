import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  User,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  Key,
} from '../components/ui/icons';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
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
      setForgotError('Please enter your username or email address');
      return;
    }

    if (forgotEmail.toLowerCase() === 'admin@posit.com' || forgotEmail.toLowerCase() === 'admin') {
      setFoundUser({
        name: 'Admin User',
        email: 'admin@posit.com',
        password: 'admin123',
        role: 'admin',
      });
      return;
    }

    setForgotLoading(true);
    try {
      let user = await db.getUserByEmail(forgotEmail.trim().toLowerCase());
      if (!user && db.getUserByUsername) {
        user = await db.getUserByUsername(forgotEmail.trim().toLowerCase());
      }
      if (!user) {
        setForgotError('No account found with this username or email');
        setForgotLoading(false);
        return;
      }
      setFoundUser({
        name: user.name,
        email: user.email,
        password: user.password || user.password_hash || 'N/A',
        role: user.role,
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

    if (!form.email.trim() || !form.password) {
      setError('Please enter username/email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await login(form.email, form.password);

      if (result.success) {
        const { role } = result;
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

      setError(result.error || 'Invalid username/email or password');
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-indigo-600/30">
            <Store size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">RAATH POS</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to your point of sale management</p>
        </div>

        {error && (
          <Alert type="danger" className="mb-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username or Email"
            name="email"
            placeholder="admin or admin@posit.com"
            value={form.email}
            onChange={handleChange}
            disabled={loading}
            icon={User}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 select-none">Password</label>
              <button
                type="button"
                onClick={handleForgotOpen}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
                icon={Lock}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700"
          >
            Sign In to Dashboard
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-semibold">Or</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-indigo-600 hover:text-indigo-800 underline">
              Create Account
            </Link>
          </p>
        </div>

        {/* Demo Login Credentials Box */}
        <div className="mt-6 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
          <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-0.5">
            Quick Demo Login
          </p>
          <p className="text-xs text-amber-800">
            <span className="font-mono font-semibold">admin</span> /{' '}
            <span className="font-mono font-semibold">admin123</span>
          </p>
          <Button
            size="xs"
            variant="outline"
            className="mt-2 text-amber-800 border-amber-300 hover:bg-amber-100/70"
            onClick={() => setForm({ email: 'admin', password: 'admin123' })}
          >
            Auto-Fill Credentials
          </Button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={handleForgotClose}
        title="Forgot Password"
        description="Retrieve your registered credentials"
        maxWidth="sm"
        footer={
          !foundUser ? (
            <>
              <Button variant="outline" size="sm" onClick={handleForgotClose} disabled={forgotLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleForgotSubmit}
                loading={forgotLoading}
                disabled={!forgotEmail.trim()}
              >
                Find Account
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleForgotClose}>
                Close
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  setForm({ email: foundUser.email, password: foundUser.password });
                  handleForgotClose();
                }}
              >
                Auto-Fill & Sign In
              </Button>
            </>
          )
        }
      >
        {!foundUser ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Enter your registered username or email to retrieve your password.
            </p>
            {forgotError && <Alert type="danger">{forgotError}</Alert>}
            <Input
              label="Username or Email"
              value={forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                if (forgotError) setForgotError('');
              }}
              placeholder="e.g. admin or admin@posit.com"
              icon={User}
              disabled={forgotLoading}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Alert type="success">Account found! Here are your credentials:</Alert>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Name</span>
                <p className="text-sm font-bold text-slate-800">{foundUser.name}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                <p className="text-sm text-slate-800">{foundUser.email}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Role</span>
                <div className="mt-0.5">
                  <Badge variant="indigo">{foundUser.role?.toUpperCase() || 'USER'}</Badge>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Password</span>
                <div className="mt-1 flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-mono text-sm font-bold text-indigo-600 tracking-wider">
                    {foundUser.password}
                  </span>
                  <Button
                    size="xs"
                    variant={copied ? 'success' : 'outline'}
                    icon={copied ? Check : Copy}
                    onClick={handleCopyPassword}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}