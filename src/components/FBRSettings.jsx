// ============================================================
// FBRSettings.jsx - Client FBR Configuration Panel (FIXED)
// ============================================================

import React, { useState, useEffect } from 'react';
import { 
  getClientConfig, 
  setClientConfig, 
  clearClientConfig,
  validateConfig,
  testFBRConnection,
  isFBRConfigured 
} from '../services/fbrService';
import { startAutoSync, stopAutoSync, getFBRStats } from '../services/fbrSync';

export default function FBRSettings() {
  const [config, setConfig] = useState({
    posId: '',
    businessNtn: '',
    businessName: '',
    authToken: '',
    isSandbox: true,
    taxRate: 18,
    saleType: 'T1000139',
    defaultHsCode: '85171200',
  });
  const [errors, setErrors] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // FIXED: Toast notification state (alert ki jagah)
  const [toast, setToast] = useState(null);

  // FIXED: Modal confirmation state (confirm ki jagah)
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    const saved = getClientConfig();
    if (saved) setConfig(prev => ({ ...prev, ...saved }));
    loadStats();
  }, []);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadStats = async () => {
    const s = await getFBRStats();
    setStats(s);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setErrors([]);
    setTestResult(null);
  };

  const handleSave = () => {
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setClientConfig(config);
    setErrors([]);
    // FIXED: alert ki jagah toast
    setToast({ type: 'success', message: '✅ FBR Configuration Saved!' });

    // Restart sync with new config
    stopAutoSync();
    startAutoSync();
  };

  const handleTest = async () => {
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    setTestResult(null);
    const result = await testFBRConnection(config);
    setTestResult(result);
    setLoading(false);
  };

  // FIXED: Native confirm ki jagah modal state use karo
  const handleClearClick = () => {
    setShowClearModal(true);
  };

  const handleClearConfirm = () => {
    clearClientConfig();
    stopAutoSync();
    setConfig({
      posId: '',
      businessNtn: '',
      businessName: '',
      authToken: '',
      isSandbox: true,
      taxRate: 18,
      saleType: 'T1000139',
      defaultHsCode: '85171200',
    });
    setStats(null);
    setShowClearModal(false);
    setToast({ type: 'info', message: '🗑️ FBR settings cleared' });
  };

  const handleClearCancel = () => {
    setShowClearModal(false);
  };

  const handleManualSync = async () => {
    setLoading(true);
    const { syncPendingInvoices } = await import('../services/fbrSync');
    await syncPendingInvoices();
    await loadStats();
    setLoading(false);
    setToast({ type: 'success', message: '🔄 Sync completed!' });
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto', position: 'relative' }}>
      {/* FIXED: Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          padding: '12px 20px',
          borderRadius: 8,
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease',
        }}>
          {toast.message}
        </div>
      )}

      {/* FIXED: Clear Confirmation Modal */}
      {showClearModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626' }}>⚠️ Confirm Delete</h3>
            <p style={{ color: '#4b5563', marginBottom: 20 }}>
              Are you sure? This will remove all FBR settings including POS ID, Auth Token, and sync history.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleClearCancel}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearConfirm}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>🏛️ FBR Digital Invoicing Configuration</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        Configure FBR integration for this POS terminal. Your client must register 
        on <a href="https://iris.fbr.gov.pk" target="_blank" rel="noopener noreferrer">iris.fbr.gov.pk</a> first.
      </p>

      {/* Status Card */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: 12, 
          marginBottom: 24 
        }}>
          <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
          <StatCard label="Synced" value={stats.synced} color="#10b981" />
          <StatCard label="Failed" value={stats.failed} color="#ef4444" />
          <StatCard label="Today" value={stats.todaySynced} color="#3b82f6" />
        </div>
      )}

      {/* Config Form */}
      <div style={{ background: '#f9fafb', padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h3>API Credentials</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            POS ID (from FBR IRIS)
          </label>
          <input
            name="posId"
            value={config.posId}
            onChange={handleChange}
            placeholder="e.g. 123456"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            Business NTN / CNIC
          </label>
          <input
            name="businessNtn"
            value={config.businessNtn}
            onChange={handleChange}
            placeholder="e.g. 1234567-8 or 35201-1234567-8"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            Business Name (as registered with FBR)
          </label>
          <input
            name="businessName"
            value={config.businessName}
            onChange={handleChange}
            placeholder="e.g. ABC Traders"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            Auth Token (from FBR IRIS Portal)
          </label>
          <input
            name="authToken"
            type="password"
            value={config.authToken}
            onChange={handleChange}
            placeholder="Paste your FBR API token here"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              Tax Rate (%)
            </label>
            <input
              name="taxRate"
              type="number"
              value={config.taxRate}
              onChange={handleChange}
              min="0"
              max="100"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              Default HS Code
            </label>
            <input
              name="defaultHsCode"
              value={config.defaultHsCode}
              onChange={handleChange}
              placeholder="85171200"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              name="isSandbox"
              checked={config.isSandbox}
              onChange={handleChange}
            />
            <span style={{ fontWeight: 600 }}>Use Sandbox (Testing Mode)</span>
          </label>
          <p style={{ fontSize: 12, color: '#6b7280', marginLeft: 24, marginTop: 2 }}>
            Keep checked until FBR approves your live integration.
          </p>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {errors.map((e, i) => <p key={i} style={{ color: '#dc2626', margin: '4px 0', fontSize: 14 }}>⚠️ {e}</p>)}
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div style={{ 
          background: testResult.success ? '#f0fdf4' : '#fef2f2', 
          border: `1px solid ${testResult.success ? '#86efac' : '#fecaca'}`, 
          padding: 12, 
          borderRadius: 8, 
          marginBottom: 16 
        }}>
          <p style={{ color: testResult.success ? '#16a34a' : '#dc2626', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            {testResult.success ? '✅ Connection Successful' : '❌ Connection Failed'}
          </p>
          {testResult.reference && <p style={{ margin: 0, fontSize: 13 }}>FBR Reference: {testResult.reference}</p>}
          {testResult.error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>Error: {testResult.error}</p>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button 
          onClick={handleSave}
          style={{ 
            padding: '10px 24px', 
            background: '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 14
          }}
        >
          💾 Save Configuration
        </button>

        <button 
          onClick={handleTest}
          disabled={loading}
          style={{ 
            padding: '10px 24px', 
            background: '#7c3aed', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontWeight: 'bold',
            fontSize: 14
          }}
        >
          {loading ? 'Testing...' : '🧪 Test Connection'}
        </button>

        <button 
          onClick={handleManualSync}
          disabled={loading}
          style={{ 
            padding: '10px 24px', 
            background: '#059669', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontWeight: 'bold',
            fontSize: 14
          }}
        >
          🔄 Manual Sync Now
        </button>

        <button 
          onClick={handleClearClick}
          style={{ 
            padding: '10px 24px', 
            background: '#dc2626', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 14
          }}
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Help */}
      <div style={{ marginTop: 32, padding: 16, background: '#eff6ff', borderRadius: 8, fontSize: 13 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>📖 How to get these values?</h4>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, margin: 0 }}>
          <li>Go to <a href="https://iris.fbr.gov.pk" target="_blank" rel="noopener noreferrer">iris.fbr.gov.pk</a></li>
          <li>Login with your NTN/CNIC</li>
          <li>Go to <strong>Point of Sale (POS)</strong> → <strong>POS Client Registration</strong></li>
          <li>Register your POS device, get <strong>POS ID</strong></li>
          <li>Generate <strong>Auth Token</strong> from the portal</li>
          <li>Enter your registered <strong>Business Name</strong> and <strong>NTN</strong> exactly as on FBR</li>
          <li>Save here → Test → Switch off Sandbox when ready for live</li>
        </ol>
        <p style={{ marginTop: 8, color: '#92400e', fontWeight: 600 }}>
          Sandbox Token (Testing): 906b1cd8-0d10-3a91-8234-8ec88e376bd7
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ 
      background: 'white', 
      padding: 16, 
      borderRadius: 8, 
      textAlign: 'center',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{value || 0}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}