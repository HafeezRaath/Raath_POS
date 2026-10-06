import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  DollarSign,
} from '../components/ui/icons';
import Button from '../components/ui/Button';
import Input, { Select, Textarea } from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import { useAuth } from '../AuthContext';
import db from '../database/db';

const STEPS = ['Account Info', 'Business Details', 'Review'];

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing & Fashion' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'mobile', label: 'Mobile Shop' },
  { value: 'grocery', label: 'Grocery / Kirana' },
  { value: 'pharmacy', label: 'Pharmacy / Medical' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES = [
  { value: 'PKR', label: 'PKR - Pakistani Rupee', symbol: 'Rs.' },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { value: 'AED', label: 'AED - UAE Dirham', symbol: 'د.إ' },
  { value: 'SAR', label: 'SAR - Saudi Riyal', symbol: '﷼' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
];

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
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    shopName: '',
    shopAddress: '',
    businessType: 'retail',
    currency: 'PKR',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (error) setError('');
  };

  const validateStep = () => {
    if (activeStep === 0) {
      if (!form.name || !form.email || !form.phone || !form.password || !form.confirmPassword) {
        setError('All fields are required');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        setError('Please enter a valid email address');
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
    } else if (activeStep === 1) {
      if (!form.shopName || !form.shopAddress) {
        setError('Shop name and address are required');
        return false;
      }
    } else if (activeStep === 2 && !agreed) {
      setError('Please agree to the terms and conditions');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setActiveStep((prev) => prev + 1);
  };
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError('');

    try {
      if (register) {
        const shopData = {
          name: form.name,
          shopName: form.shopName,
          phone: form.phone,
          businessType: form.businessType,
          currency: form.currency,
          shopAddress: form.shopAddress,
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
      }

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
        status: 'active',
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-indigo-600/30">
            <Store size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Shop Account</h2>
          <p className="text-xs text-slate-500 mt-1">Set up your store and admin credentials</p>
        </div>

        {/* Stepper Progress Header */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((stepName, idx) => {
            const isCompleted = activeStep > idx;
            const isCurrent = activeStep === idx;
            return (
              <div key={stepName} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-sm'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                  </div>
                  <span
                    className={`text-[11px] font-semibold mt-1 hidden sm:block ${
                      isCurrent ? 'text-indigo-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {stepName}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 -mt-4 transition-all ${
                      activeStep > idx ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <Alert type="danger" className="mb-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 1: Account Info */}
        {activeStep === 0 && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <Input
              label="Full Name"
              name="name"
              placeholder="e.g. Muhammad Hafeez"
              value={form.name}
              onChange={handleChange}
              icon={User}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                icon={Mail}
                required
              />
              <Input
                label="Phone Number"
                name="phone"
                placeholder="03001234567"
                value={form.phone}
                onChange={handleChange}
                icon={Phone}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  icon={Lock}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  icon={Lock}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Business Details */}
        {activeStep === 1 && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <Input
              label="Shop / Business Name"
              name="shopName"
              placeholder="e.g. Raath Departmental Store"
              value={form.shopName}
              onChange={handleChange}
              icon={Store}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Business Type"
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
              >
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Currency"
                name="currency"
                value={form.currency}
                onChange={handleChange}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea
              label="Shop Address"
              name="shopAddress"
              rows={3}
              placeholder="Full shop street address, city"
              value={form.shopAddress}
              onChange={handleChange}
              required
            />
          </div>
        )}

        {/* Step 3: Review */}
        {activeStep === 2 && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
              <div className="pb-3 space-y-1.5">
                <span className="font-bold text-slate-900 block text-sm">Account Overview</span>
                <div className="grid grid-cols-2 gap-1 text-slate-600">
                  <span>Name:</span>
                  <span className="font-semibold text-slate-900">{form.name}</span>
                  <span>Email:</span>
                  <span className="font-semibold text-slate-900">{form.email}</span>
                  <span>Phone:</span>
                  <span className="font-semibold text-slate-900">{form.phone}</span>
                </div>
              </div>

              <div className="pt-3 space-y-1.5">
                <span className="font-bold text-slate-900 block text-sm">Shop Details</span>
                <div className="grid grid-cols-2 gap-1 text-slate-600">
                  <span>Shop Name:</span>
                  <span className="font-semibold text-slate-900">{form.shopName}</span>
                  <span>Type:</span>
                  <span className="font-semibold text-slate-900">
                    {BUSINESS_TYPES.find((t) => t.value === form.businessType)?.label ||
                      form.businessType}
                  </span>
                  <span>Currency:</span>
                  <span className="font-semibold text-slate-900">{form.currency}</span>
                  <span>Address:</span>
                  <span className="font-semibold text-slate-900">{form.shopAddress}</span>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-600">
                I agree to the Terms of Service and Privacy Policy for Raath POS.
              </span>
            </label>
          </div>
        )}

        {/* Step Navigation Actions */}
        <div className="mt-8 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          {activeStep > 0 ? (
            <Button
              variant="outline"
              size="md"
              onClick={handleBack}
              icon={ArrowLeft}
              disabled={loading}
            >
              Back
            </Button>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="md">
                Cancel
              </Button>
            </Link>
          )}

          {activeStep < STEPS.length - 1 ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              iconRight={ArrowRight}
              className="ml-auto"
            >
              Next Step
            </Button>
          ) : (
            <Button
              variant="success"
              size="md"
              onClick={handleSubmit}
              loading={loading}
              icon={CheckCircle}
              className="ml-auto"
            >
              Complete Registration
            </Button>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-800 underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}