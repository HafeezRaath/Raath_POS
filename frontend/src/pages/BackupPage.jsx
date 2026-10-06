import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  Stack, Chip, Alert, Divider, LinearProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemText,
  ListItemIcon, IconButton, Switch, FormControlLabel, Select,
  MenuItem, FormControl, InputLabel, Snackbar, Tooltip, Badge,
  Avatar, useTheme, useMediaQuery, Collapse, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer
} from '../components/ui/tailwind-mui';
import {
  Backup, Restore, CloudUpload, CloudDone, CloudOff, Email, Schedule, Storage,
  CheckCircle, Error, Warning, Download, Delete, Refresh,
  FolderOpen, Settings, History, Computer, Send, Lock, Info,
  ExpandMore, ExpandLess, Close, CloudDownload, Visibility, VisibilityOff
} from '../components/ui/icons';
import {
  requestGoogleDriveToken,
  getSavedGoogleAuth,
  clearGoogleAuth,
  uploadBackupToDrive,
  listDriveBackups,
  downloadBackupFromDrive,
  deleteDriveBackup,
  getDriveStorageQuota,
  DEFAULT_CLIENT_ID
} from '../services/googleDriveService';
import {
  exportFullDatabase,
  downloadLocalBackupFile,
  restoreDatabaseFromPayload
} from '../services/backupService';

// ==================== GOOGLE BRAND ICON ====================
const GoogleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

// ==================== HELPERS ====================
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return dateStr; }
};

// ==================== RESPONSIVE ACTION CARD ====================
const ActionCard = React.memo(({ title, subtitle, icon, color, onClick, disabled, loading }) => (
  <Card 
    sx={{ 
      height: '100%',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      borderTop: 3,
      borderColor: `${color}.main`,
      transition: 'all 0.2s',
      '&:hover': disabled ? {} : { transform: 'translateY(-3px)', boxShadow: 3 },
      '&:active': disabled ? {} : { transform: 'scale(0.98)' }
    }}
    onClick={disabled ? undefined : onClick}
  >
    <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
      <Box sx={{ 
        p: 1.2, 
        bgcolor: `${color}.50`, 
        borderRadius: 2, 
        color: `${color}.main`,
        display: 'inline-flex',
        mb: 1
      }}>
        {icon}
      </Box>
      <Typography variant="body2" fontWeight="bold" noWrap>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" noWrap>
          {subtitle}
        </Typography>
      )}
      {loading && <LinearProgress sx={{ mt: 1 }} />}
    </CardContent>
  </Card>
));

// ==================== MAIN COMPONENT ====================
export default function BackupPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // ==================== STATES ====================
  const [dbInfo, setDbInfo] = useState({ path: '', size: 0, lastModified: null, recordCount: 0 });
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploadProgress, setUploadProgress] = useState(0);

  // Google Drive State
  const [gdriveAuth, setGdriveAuth] = useState(null);
  const [gdriveQuota, setGdriveQuota] = useState(null);
  const [gdriveBackups, setGdriveBackups] = useState([]);
  const [showGdriveConfig, setShowGdriveConfig] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(() => {
    return localStorage.getItem('raath_gdrive_client_id') || DEFAULT_CLIENT_ID;
  });

  // Auto Backup Settings
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [backupDestination, setBackupDestination] = useState('drive');

  // Gmail Settings
  const [gmailConfig, setGmailConfig] = useState({
    email: '',
    appPassword: '',
    toEmail: '',
    enabled: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showGmailSettings, setShowGmailSettings] = useState(false);

  // Restore Dialog
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // ==================== SNACKBAR HELPER ====================
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ==================== LOAD DB INFO & LOCAL BACKUP HISTORY ====================
  const loadDbInfo = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.getDbInfo) {
        const info = await window.electronAPI.getDbInfo();
        setDbInfo({
          path: info.path || 'Electron SQLite Database',
          size: info.size || 0,
          lastModified: info.lastModified || new Date().toISOString(),
          recordCount: info.records || 0
        });
      } else {
        // Browser IndexedDB estimate
        let estimatedSize = 2500000;
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          estimatedSize = estimate.usage || estimatedSize;
        }
        setDbInfo({
          path: 'Browser IndexedDB Storage (All Tables)',
          size: estimatedSize,
          lastModified: new Date().toISOString(),
          recordCount: 0
        });
      }

      const history = JSON.parse(localStorage.getItem('backup_history') || '[]');
      setBackups(history);

      const savedSettings = localStorage.getItem('backup_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.autoBackup !== undefined) setAutoBackup(settings.autoBackup);
        if (settings.backupInterval) setBackupInterval(settings.backupInterval);
        if (settings.backupDestination) setBackupDestination(settings.backupDestination);
        if (settings.gmail) setGmailConfig(settings.gmail);
      }
    } catch (err) {
      console.error('Load DB info error:', err);
    }
  }, []);

  // ==================== LOAD GOOGLE DRIVE STATUS & BACKUPS ====================
  const loadGoogleDriveData = useCallback(async () => {
    const auth = getSavedGoogleAuth();
    setGdriveAuth(auth);

    if (!auth) {
      setGdriveBackups([]);
      setGdriveQuota(null);
      return;
    }

    setLoadingDrive(true);
    try {
      // 1. Load Quota
      try {
        const quota = await getDriveStorageQuota();
        if (quota) setGdriveQuota(quota);
      } catch (qErr) {
        console.warn('Could not fetch Drive quota:', qErr.message);
      }

      // 2. Load cloud backups list from Raath_POS_Backups folder
      const files = await listDriveBackups();
      setGdriveBackups(files);
    } catch (err) {
      console.error('Failed to load Google Drive data:', err);
      // If token is invalid or expired, clear it
      if (err.message && (err.message.includes('401') || err.message.includes('invalid') || err.message.includes('expired'))) {
        clearGoogleAuth();
        setGdriveAuth(null);
        showSnackbar('Google Drive session expired. Please reconnect.', 'warning');
      }
    } finally {
      setLoadingDrive(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadDbInfo();
    loadGoogleDriveData();
  }, [loadDbInfo, loadGoogleDriveData]);

  // ==================== CONNECT GOOGLE DRIVE ====================
  const handleConnectGoogleDrive = async () => {
    setLoadingDrive(true);
    try {
      const clientId = clientIdInput.trim() || DEFAULT_CLIENT_ID;
      localStorage.setItem('raath_gdrive_client_id', clientId);
      const auth = await requestGoogleDriveToken(clientId);
      setGdriveAuth(auth);
      showSnackbar(`Connected as ${auth.user?.email || 'Google User'}!`, 'success');
      await loadGoogleDriveData();
    } catch (err) {
      console.error('Google Drive connection failed:', err);
      showSnackbar(`Google Drive connection failed: ${err.message}`, 'error');
    } finally {
      setLoadingDrive(false);
    }
  };

  // ==================== DISCONNECT GOOGLE DRIVE ====================
  const handleDisconnectGoogleDrive = () => {
    clearGoogleAuth();
    setGdriveAuth(null);
    setGdriveBackups([]);
    setGdriveQuota(null);
    showSnackbar('Google Drive disconnected.', 'info');
  };

  // ==================== SAVE CLIENT ID ====================
  const handleSaveClientId = () => {
    const cid = clientIdInput.trim();
    if (!cid) {
      localStorage.removeItem('raath_gdrive_client_id');
      setClientIdInput(DEFAULT_CLIENT_ID);
      showSnackbar('Reset to default Google Client ID', 'info');
    } else {
      localStorage.setItem('raath_gdrive_client_id', cid);
      showSnackbar('Saved custom Client ID. Please reconnect.', 'success');
    }
    setShowGdriveConfig(false);
  };

  // ==================== LOCAL BACKUP (DOWNLOAD JSON/DB) ====================
  const handleLocalBackup = async () => {
    setLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.createLocalBackup) {
        const result = await window.electronAPI.createLocalBackup();
        addBackupRecord('local', `SQLite Saved at: ${result.path || 'Downloads'}`);
        showSnackbar('Local backup created successfully!', 'success');
      } else {
        // Browser / Universal DB Export
        showSnackbar('Generating complete database export...', 'info');
        const payload = await exportFullDatabase();
        downloadLocalBackupFile(payload);
        addBackupRecord('local', `JSON Export: ${payload.stats?.totalRecords || 0} records across ${payload.stats?.totalStores || 0} tables`);
        showSnackbar('Backup downloaded to your computer!', 'success');
      }
    } catch (err) {
      console.error('Local backup error:', err);
      showSnackbar(`Local backup failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== GOOGLE DRIVE BACKUP (UPLOAD) ====================
  const handleDriveBackup = async () => {
    if (!gdriveAuth) {
      // Prompt user to connect
      await handleConnectGoogleDrive();
      return;
    }

    setLoading(true);
    setUploadProgress(10);
    try {
      showSnackbar('Exporting all database stores...', 'info');
      const payload = await exportFullDatabase();
      setUploadProgress(40);

      showSnackbar('Uploading backup file to Google Drive...', 'info');
      const uploadedFile = await uploadBackupToDrive(payload, (percent) => {
        setUploadProgress(40 + Math.round(percent * 0.55));
      });

      addBackupRecord('drive', `Google Drive: ${uploadedFile.name}`);
      showSnackbar('Backup successfully uploaded to Google Drive!', 'success');

      // Refresh list
      await loadGoogleDriveData();
    } catch (err) {
      console.error('Drive backup error:', err);
      showSnackbar(`Google Drive upload failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // ==================== RESTORE FROM GOOGLE DRIVE ====================
  const handleRestoreFromDrive = async (file) => {
    if (!window.confirm(`Are you sure you want to restore "${file.name}"? This will overwrite existing data with data from this backup.`)) {
      return;
    }

    setRestoring(true);
    try {
      showSnackbar(`Downloading ${file.name} from Google Drive...`, 'info');
      const backupPayload = await downloadBackupFromDrive(file.id);

      showSnackbar('Restoring database tables...', 'info');
      const result = await restoreDatabaseFromPayload(backupPayload);

      showSnackbar(result.message || 'Database restored successfully! Please refresh.', 'success');
      loadDbInfo();
    } catch (err) {
      console.error('Drive restore error:', err);
      showSnackbar(`Restore from Drive failed: ${err.message}`, 'error');
    } finally {
      setRestoring(false);
    }
  };

  // ==================== DELETE FROM GOOGLE DRIVE ====================
  const handleDeleteFromDrive = async (file) => {
    if (!window.confirm(`Permanently delete "${file.name}" from Google Drive?`)) {
      return;
    }

    setLoadingDrive(true);
    try {
      await deleteDriveBackup(file.id);
      showSnackbar(`Backup deleted from Google Drive.`, 'info');
      await loadGoogleDriveData();
    } catch (err) {
      console.error('Delete from Drive error:', err);
      showSnackbar(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setLoadingDrive(false);
    }
  };

  // ==================== RESTORE LOCAL FILE ====================
  const handleRestoreUploadedFile = async () => {
    if (!uploadedFile) {
      showSnackbar('Please select a backup file first.', 'warning');
      return;
    }

    setRestoring(true);
    try {
      const fileName = uploadedFile.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        // Universal JSON payload restore
        const fileText = await uploadedFile.text();
        const payload = JSON.parse(fileText);
        const result = await restoreDatabaseFromPayload(payload);
        showSnackbar(result.message || 'Database restored from JSON successfully!', 'success');
      } else if (fileName.endsWith('.db') || fileName.endsWith('.sqlite') || fileName.endsWith('.sqlite3')) {
        // Electron SQLite restore
        if (window.electronAPI && window.electronAPI.restoreBackup) {
          await window.electronAPI.restoreBackup(uploadedFile.path || uploadedFile.name);
          showSnackbar('SQLite database restored successfully! Please restart the app.', 'success');
        } else {
          throw new Error('.db files can only be restored in Electron desktop mode. Please use .json backups in browser.');
        }
      } else {
        throw new Error('Unsupported file format. Please upload a .json or .db file.');
      }

      setRestoreDialog(false);
      setUploadedFile(null);
      loadDbInfo();
    } catch (err) {
      console.error('File restore error:', err);
      showSnackbar(`Restore failed: ${err.message}`, 'error');
    } finally {
      setRestoring(false);
    }
  };

  // ==================== SAVE AUTO-BACKUP SETTINGS ====================
  const saveSettings = async () => {
    const settings = {
      autoBackup,
      backupInterval,
      backupDestination,
      gmail: gmailConfig
    };
    
    try {
      localStorage.setItem('backup_settings', JSON.stringify(settings));
      if (window.electronAPI && window.electronAPI.updateBackupSettings) {
        await window.electronAPI.updateBackupSettings(settings);
      }
      showSnackbar('Backup settings saved successfully!', 'success');
    } catch (err) {
      showSnackbar('Failed to save settings: ' + err.message, 'error');
    }
  };

  // ==================== EMAIL BACKUP ====================
  const handleEmailBackup = async () => {
    if (!gmailConfig.email || !gmailConfig.appPassword || !gmailConfig.toEmail) {
      showSnackbar('Please configure your Gmail settings first!', 'error');
      setShowGmailSettings(true);
      return;
    }

    setLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.sendBackupEmail) {
        const result = await window.electronAPI.sendBackupEmail(gmailConfig);
        if (result.success) {
          addBackupRecord('gmail', `Email sent to ${gmailConfig.toEmail}`);
          showSnackbar('Backup sent to your email!', 'success');
        } else {
          throw new Error(result.message || 'Email backup failed');
        }
      } else {
        // In browser, export and provide instructions or open mail client
        const payload = await exportFullDatabase();
        downloadLocalBackupFile(payload);
        addBackupRecord('gmail', `Browser exported for emailing to ${gmailConfig.toEmail}`);
        showSnackbar('Backup exported! Please attach the downloaded file to your email.', 'info');
      }
    } catch (err) {
      console.error('Email backup error:', err);
      showSnackbar(`Email backup failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RECORD TRACKING ====================
  const addBackupRecord = (type, status) => {
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      type,
      size: dbInfo.size,
      status,
      path: type === 'local' ? 'Local Storage' : type === 'drive' ? 'Google Drive' : 'Gmail'
    };
    const updated = [record, ...backups.slice(0, 49)];
    setBackups(updated);
    localStorage.setItem('backup_history', JSON.stringify(updated));
  };

  const handleDeleteHistoryItem = (index) => {
    const updated = backups.filter((_, i) => i !== index);
    setBackups(updated);
    localStorage.setItem('backup_history', JSON.stringify(updated));
    showSnackbar('History item removed', 'info');
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      p: isMobile ? 1 : 2.5, 
      maxWidth: 1200, 
      mx: 'auto',
      pb: isMobile ? 8 : 4
    }}>
      {/* HEADER */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        mb: 2.5,
        gap: 1.5 
      }}>
        <Box>
          <Typography 
            variant={isMobile ? 'h5' : 'h4'} 
            fontWeight="bold" 
            color="primary" 
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Backup sx={{ fontSize: isMobile ? 28 : 34 }} />
            {isMobile ? 'Cloud & Local Backup' : 'Data Backup & Cloud Recovery'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sync and protect your store data with Google Drive and local offline copies.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip 
            icon={gdriveAuth ? <CloudDone fontSize="small" /> : <CloudOff fontSize="small" />}
            label={gdriveAuth ? 'Drive Connected' : 'Drive Disconnected'}
            color={gdriveAuth ? 'success' : 'default'}
            size={isMobile ? 'small' : 'medium'}
            variant={gdriveAuth ? 'filled' : 'outlined'}
          />
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<Refresh />} 
            onClick={() => { loadDbInfo(); loadGoogleDriveData(); }}
            disabled={loading || loadingDrive}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {(loading || loadingDrive || restoring) && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {restoring ? 'Restoring database stores, please wait...' : 
             loading ? 'Processing backup...' : 'Syncing with Google Drive...'}
          </Typography>
        </Box>
      )}

      {uploadProgress > 0 && uploadProgress < 100 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight="bold">
            Uploading to Google Drive: {uploadProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 1 }} />
        </Box>
      )}

      {/* QUICK ACTION TILES */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <ActionCard 
            title="Google Drive" 
            subtitle={gdriveAuth ? '1-Click Cloud Sync' : 'Connect & Backup'}
            icon={<GoogleIcon size={26} />} 
            color="secondary"
            onClick={handleDriveBackup}
            disabled={loading || restoring}
            loading={loading && uploadProgress > 0}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <ActionCard 
            title="Download Backup" 
            subtitle="Local JSON/DB file"
            icon={<Download fontSize="medium" />} 
            color="primary"
            onClick={handleLocalBackup}
            disabled={loading || restoring}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <ActionCard 
            title="Restore Data" 
            subtitle="From File or Drive"
            icon={<Restore fontSize="medium" />} 
            color="warning"
            onClick={() => setRestoreDialog(true)}
            disabled={loading || restoring}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <ActionCard 
            title="Email Backup" 
            subtitle={gmailConfig.enabled ? 'Configured' : 'Setup Gmail'}
            icon={<Email fontSize="medium" />} 
            color="info"
            onClick={handleEmailBackup}
            disabled={loading || restoring}
          />
        </Grid>
      </Grid>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <Grid container spacing={isMobile ? 2 : 3}>
        {/* LEFT COLUMN: GOOGLE DRIVE INTEGRATION & DB STATUS */}
        <Grid item xs={12} md={6}>
          {/* GOOGLE DRIVE INTEGRATION CARD */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: '#4285F4' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GoogleIcon size={22} /> Google Drive Integration
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => setShowGdriveConfig(!showGdriveConfig)}
                  title="Client ID Settings"
                >
                  <Settings fontSize="small" />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* CLIENT ID SETTINGS COLLAPSE */}
              <Collapse in={showGdriveConfig}>
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                    Google OAuth Client ID (Optional Customization)
                  </Typography>
                  <TextField 
                    fullWidth 
                    size="small" 
                    value={clientIdInput} 
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="Enter your Google Cloud Client ID"
                    helperText="Default ID works out of the box. Only change if using your own GCP project."
                    sx={{ mb: 1 }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" onClick={handleSaveClientId}>
                      Save Client ID
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => {
                      setClientIdInput(DEFAULT_CLIENT_ID);
                      localStorage.removeItem('raath_gdrive_client_id');
                      showSnackbar('Reset to default client ID', 'info');
                    }}>
                      Reset Default
                    </Button>
                  </Stack>
                </Paper>
              </Collapse>

              {gdriveAuth ? (
                // CONNECTED STATE
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar 
                      src={gdriveAuth.user?.picture} 
                      sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}
                    >
                      {gdriveAuth.user?.name ? gdriveAuth.user.name[0] : 'G'}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold" noWrap>
                        {gdriveAuth.user?.name || 'Google Account'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {gdriveAuth.user?.email || 'Connected'}
                      </Typography>
                    </Box>
                    <Chip size="small" color="success" label="Active" />
                  </Box>

                  {/* STORAGE QUOTA BAR */}
                  {gdriveQuota && gdriveQuota.limit > 0 && (
                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Google Drive Storage
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {formatBytes(gdriveQuota.usage)} / {formatBytes(gdriveQuota.limit)}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, Math.round((gdriveQuota.usage / gdriveQuota.limit) * 100))} 
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  )}

                  <Alert severity="success" icon={<CloudDone />} sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      Backups are stored safely in <strong>Raath_POS_Backups</strong> on Google Drive.
                    </Typography>
                  </Alert>

                  <Stack direction={isMobile ? 'column' : 'row'} spacing={1}>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      color="primary"
                      startIcon={<CloudUpload />}
                      onClick={handleDriveBackup}
                      disabled={loading || restoring}
                    >
                      Backup Now to Drive
                    </Button>
                    <Button 
                      fullWidth={isMobile}
                      variant="outlined" 
                      color="error"
                      onClick={handleDisconnectGoogleDrive}
                      disabled={loading || restoring}
                    >
                      Disconnect
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                // DISCONNECTED STATE
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CloudOff sx={{ fontSize: 44, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Connect Your Google Drive
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 360, mx: 'auto' }}>
                    Automatically store encrypted backups in your Google Drive cloud storage. Restore your business records anytime on any computer.
                  </Typography>

                  <Button 
                    variant="contained" 
                    size="large"
                    startIcon={<GoogleIcon size={20} />}
                    onClick={handleConnectGoogleDrive}
                    disabled={loadingDrive}
                    sx={{ 
                      bgcolor: '#4285F4', 
                      '&:hover': { bgcolor: '#3367D6' },
                      textTransform: 'none',
                      fontWeight: 'bold',
                      px: 3
                    }}
                  >
                    {loadingDrive ? 'Connecting...' : 'Connect Google Drive'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* DATABASE STATUS CARD */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="primary" /> Database Information
              </Typography>
              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Storage Location</Typography>
                  <Typography 
                    variant="body2" 
                    fontFamily="monospace" 
                    sx={{ wordBreak: 'break-all', fontSize: isMobile ? '0.75rem' : '0.85rem' }}
                  >
                    {dbInfo.path || 'Local Browser Database'}
                  </Typography>
                </Box>

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Database Size</Typography>
                    <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                      {formatBytes(dbInfo.size)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Protection Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip 
                        size="small" 
                        color={backups.length > 0 || gdriveBackups.length > 0 ? 'success' : 'error'}
                        icon={backups.length > 0 || gdriveBackups.length > 0 ? <CheckCircle fontSize="small" /> : <Error fontSize="small" />}
                        label={backups.length > 0 || gdriveBackups.length > 0 ? 'Protected' : 'No Backups'}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          {/* AUTO BACKUP SCHEDULE CARD */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'warning.main' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Schedule color="warning" /> Auto Backup Schedule
                </Typography>
                <Switch 
                  checked={autoBackup} 
                  onChange={(e) => setAutoBackup(e.target.checked)} 
                  color="primary"
                />
              </Box>

              <Collapse in={autoBackup}>
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      Automatic backups protect against sudden hardware failure or accidental deletion.
                    </Typography>
                  </Alert>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Backup Frequency</InputLabel>
                        <Select 
                          value={backupInterval} 
                          onChange={(e) => setBackupInterval(e.target.value)} 
                          label="Backup Frequency"
                        >
                          <MenuItem value="daily">Daily (Recommended)</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Default Target</InputLabel>
                        <Select 
                          value={backupDestination} 
                          onChange={(e) => setBackupDestination(e.target.value)} 
                          label="Default Target"
                        >
                          <MenuItem value="drive">Google Drive Cloud</MenuItem>
                          <MenuItem value="local">Local File</MenuItem>
                          <MenuItem value="gmail">Gmail Email</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<Settings />} 
                    onClick={saveSettings}
                  >
                    Save Auto Backup Settings
                  </Button>
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN: CLOUD BACKUPS & LOCAL HISTORY */}
        <Grid item xs={12} md={6}>
          {/* GOOGLE DRIVE CLOUD BACKUPS LIST */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: '#34A853' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudDone sx={{ color: '#34A853' }} /> Cloud Backups (Drive)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Files stored in `Raath_POS_Backups` folder
                  </Typography>
                </Box>
                <Badge badgeContent={gdriveBackups.length} color="success">
                  <IconButton size="small" onClick={loadGoogleDriveData} disabled={loadingDrive}>
                    <Refresh fontSize="small" />
                  </IconButton>
                </Badge>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {!gdriveAuth ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <GoogleIcon size={32} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Connect Google Drive on the left to see your cloud backups.
                  </Typography>
                </Paper>
              ) : gdriveBackups.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <CloudOff sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No cloud backups found yet in your Google Drive folder.
                  </Typography>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<CloudUpload />}
                    onClick={handleDriveBackup}
                    sx={{ mt: 1.5 }}
                    disabled={loading || restoring}
                  >
                    Create First Drive Backup
                  </Button>
                </Paper>
              ) : (
                <List dense sx={{ maxHeight: 340, overflow: 'auto' }}>
                  {gdriveBackups.map((file, idx) => (
                    <Paper 
                      key={file.id} 
                      variant="outlined" 
                      sx={{ 
                        mb: 1, 
                        p: 1.2, 
                        bgcolor: idx === 0 ? 'rgba(52, 168, 83, 0.05)' : 'background.paper',
                        borderColor: idx === 0 ? '#34A853' : 'divider'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {file.name}
                            </Typography>
                            {idx === 0 && (
                              <Chip size="small" label="Latest" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatDate(file.createdTime)} • {formatBytes(file.size)}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Restore from this cloud backup">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={() => handleRestoreFromDrive(file)}
                              disabled={restoring}
                            >
                              <Restore fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete file from Google Drive">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteFromDrive(file)}
                              disabled={loadingDrive || restoring}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Paper>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* LOCAL BACKUP HISTORY */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History color="primary" /> Local Activity History
                </Typography>
                <Chip size="small" label={`${backups.length} records`} />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {backups.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary">
                    No local backup activity logged yet.
                  </Typography>
                </Paper>
              ) : (
                <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {backups.slice(0, 10).map((b, idx) => (
                    <ListItem 
                      key={b.id || idx}
                      secondaryAction={
                        <IconButton size="small" color="error" onClick={() => handleDeleteHistoryItem(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      }
                      sx={{ px: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {b.type === 'drive' ? <CloudDone color="success" fontSize="small" /> :
                         b.type === 'gmail' ? <Email color="info" fontSize="small" /> :
                         <Computer color="primary" fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Typography variant="body2" fontWeight="bold">
                            {b.type === 'drive' ? 'Google Drive' : b.type === 'gmail' ? 'Gmail' : 'Local Backup'}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(b.date)} • {b.status}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* GMAIL CONFIGURATION CARD */}
          <Card sx={{ borderLeft: 4, borderColor: 'error.main' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email color="error" /> Email Backup (Gmail)
                </Typography>
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={gmailConfig.enabled} 
                      onChange={(e) => setGmailConfig({ ...gmailConfig, enabled: e.target.checked })} 
                      color="error"
                    />
                  }
                  label={gmailConfig.enabled ? 'Enabled' : 'Disabled'}
                />
              </Box>

              <Button 
                size="small" 
                variant="outlined" 
                fullWidth 
                startIcon={showGmailSettings ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowGmailSettings(!showGmailSettings)}
                sx={{ mb: 1 }}
              >
                {showGmailSettings ? 'Hide Gmail Settings' : 'Configure Gmail Settings'}
              </Button>

              <Collapse in={showGmailSettings}>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Alert severity="info" icon={<Lock />} sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      Use a 16-character Google <strong>App Password</strong> generated under Google Account → Security.
                    </Typography>
                  </Alert>

                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Sender Gmail Address" 
                    value={gmailConfig.email} 
                    onChange={(e) => setGmailConfig({ ...gmailConfig, email: e.target.value })}
                    placeholder="mystore@gmail.com"
                  />

                  <TextField 
                    fullWidth 
                    size="small" 
                    label="16-Char App Password" 
                    type={showPassword ? 'text' : 'password'}
                    value={gmailConfig.appPassword} 
                    onChange={(e) => setGmailConfig({ ...gmailConfig, appPassword: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    InputProps={{
                      endAdornment: (
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      )
                    }}
                  />

                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Recipient Email" 
                    value={gmailConfig.toEmail} 
                    onChange={(e) => setGmailConfig({ ...gmailConfig, toEmail: e.target.value })}
                    placeholder="owner@gmail.com"
                  />

                  <Stack direction="row" spacing={1}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      size="small" 
                      startIcon={<Send />} 
                      onClick={handleEmailBackup}
                      disabled={loading}
                    >
                      Send Test Email
                    </Button>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      size="small" 
                      startIcon={<CheckCircle />} 
                      onClick={saveSettings}
                    >
                      Save
                    </Button>
                  </Stack>
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* RESTORE DIALOG */}
      <Dialog 
        open={restoreDialog} 
        onClose={() => !restoring && setRestoreDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
            <Restore />
            <Typography variant="h6" fontWeight="bold">Restore Database</Typography>
          </Box>
          <IconButton size="small" onClick={() => setRestoreDialog(false)} disabled={restoring}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: isMobile ? 1.5 : 2.5 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Important: Restoring will overwrite existing data with records from the chosen backup.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Option 1: Upload a Local Backup File (.json or .db)
          </Typography>

          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2.5, 
              textAlign: 'center', 
              borderStyle: 'dashed', 
              borderWidth: 2, 
              bgcolor: 'grey.50',
              mb: 3
            }}
          >
            <FolderOpen sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              {uploadedFile ? uploadedFile.name : 'Select or drop your backup file'}
            </Typography>
            {uploadedFile && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Size: {formatBytes(uploadedFile.size)}
              </Typography>
            )}
            <Button
              variant="contained"
              component="label"
              size="small"
              startIcon={<CloudUpload />}
              disabled={restoring}
            >
              Choose Backup File
              <input
                type="file"
                hidden
                accept=".json,.db,.sqlite,.sqlite3"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadedFile(e.target.files[0]);
                  }
                }}
              />
            </Button>
          </Paper>

          {gdriveBackups.length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Option 2: Restore Directly from Google Drive Cloud
              </Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 1, p: 1 }}>
                {gdriveBackups.map((file) => (
                  <ListItem 
                    key={file.id} 
                    button 
                    onClick={() => {
                      setRestoreDialog(false);
                      handleRestoreFromDrive(file);
                    }}
                    sx={{ borderRadius: 1, mb: 0.5, bgcolor: 'background.paper' }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <GoogleIcon size={18} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={<Typography variant="body2" fontWeight="bold">{file.name}</Typography>}
                      secondary={<Typography variant="caption">{formatDate(file.createdTime)} • {formatBytes(file.size)}</Typography>}
                    />
                    <Button size="small" color="warning" variant="outlined">
                      Restore
                    </Button>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRestoreDialog(false)} disabled={restoring}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleRestoreUploadedFile}
            disabled={!uploadedFile || restoring}
            startIcon={<Restore />}
          >
            {restoring ? 'Restoring...' : 'Restore from Selected File'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR NOTIFICATIONS */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ 
          vertical: 'bottom', 
          horizontal: isMobile ? 'center' : 'right' 
        }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled"
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
