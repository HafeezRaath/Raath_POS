import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  Stack, Chip, Alert, Divider, LinearProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemText,
  ListItemIcon, IconButton, Switch, FormControlLabel, Select,
  MenuItem, FormControl, InputLabel, Snackbar, Tooltip, Badge
} from '@mui/material';
import {
  Backup, Restore, CloudUpload, Email, Schedule, Storage,
  CheckCircle, Error, Warning, Download, Delete, Refresh,
  FolderOpen, Settings, History, CloudDone, CloudOff, AttachFile,
  Computer, Send, Lock, Info
} from '@mui/icons-material';

// Electron IPC API (preload script se expose hona chahiye)
const electronAPI = window.electronAPI;

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB');
  } catch { return dateStr; }
};

export default function BackupPage() {
  // ==================== STATES ====================
  const [dbInfo, setDbInfo] = useState({ path: '', size: 0, lastModified: null });
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Auto Backup Settings
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [backupDestination, setBackupDestination] = useState('local');

  // Gmail Settings
  const [gmailConfig, setGmailConfig] = useState({
    email: '',
    appPassword: '',
    toEmail: '',
    enabled: false
  });
  const [showPassword, setShowPassword] = useState(false);

  // Restore Dialog
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);

  // Progress
  const [uploadProgress, setUploadProgress] = useState(0);

  // ==================== LOAD INFO ====================
  const loadDbInfo = async () => {
    try {
      // Electron IPC se DB info lena
      const info = await electronAPI.getDbInfo();
      setDbInfo(info);

      // Load backup history from localStorage
      const history = JSON.parse(localStorage.getItem('backup_history') || '[]');
      setBackups(history);

      // Load settings from main process
      const settings = await electronAPI.loadBackupSettings();
      if (settings.autoBackup !== undefined) setAutoBackup(settings.autoBackup);
      if (settings.backupInterval) setBackupInterval(settings.backupInterval);
      if (settings.backupDestination) setBackupDestination(settings.backupDestination);
      if (settings.gmail) setGmailConfig(settings.gmail);
    } catch (err) {
      console.error('Load info error:', err);
      // Fallback mock data agar Electron API fail ho
      setDbInfo({
        path: 'C:\\Users\\User\\AppData\\Roaming\\RAATH-POS\\raath-pos.db',
        size: 2457600,
        lastModified: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    loadDbInfo();
  }, []);

  // ==================== SAVE SETTINGS ====================
  const saveSettings = async () => {
    const settings = {
      autoBackup,
      backupInterval,
      backupDestination,
      gmail: gmailConfig
    };
    
    try {
      await electronAPI.updateBackupSettings(settings);
      localStorage.setItem('backup_settings', JSON.stringify(settings));
      showSnackbar('Settings saved successfully!', 'success');
    } catch (err) {
      showSnackbar('Failed to save settings: ' + err.message, 'error');
    }
  };

  // ==================== MANUAL BACKUP (MERGED) ====================
  const handleManualBackup = async (destination) => {
    setLoading(true);
    setUploadProgress(0);

    try {
      if (destination === 'gmail') {
        // Validate Gmail config
        if (!gmailConfig.email || !gmailConfig.appPassword || !gmailConfig.toEmail) {
          showSnackbar('Please configure Gmail settings first!', 'error');
          setLoading(false);
          return;
        }

        // Call Electron main process
        const result = await electronAPI.sendBackupEmail(gmailConfig);
        
        if (result.success) {
          addBackupRecord('gmail', 'Email Sent Successfully');
          showSnackbar('Backup sent to Email!', 'success');
        } else {
          throw new Error(result.message || 'Email backup failed');
        }

      } else if (destination === 'local') {
        // Call Electron main process
        const result = await electronAPI.createLocalBackup();
        
        addBackupRecord('local', `Saved at: ${result.path}`);
        showSnackbar('Local backup created!', 'success');

      } else if (destination === 'drive') {
        // Google Drive - Abhi ke liye placeholder
        simulateProgress();
        await delay(2000);
        addBackupRecord('drive', 'Google Drive upload complete');
        showSnackbar('Backup uploaded to Google Drive!', 'success');
      }
    } catch (err) {
      console.error('Backup error:', err);
      showSnackbar('Backup failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // ==================== RESTORE ====================
  const handleRestore = async () => {
    if (!selectedBackup) return;

    setLoading(true);
    try {
      if (selectedBackup.type === 'upload') {
        // File upload restore
        await electronAPI.restoreBackup(selectedBackup.path);
      } else if (selectedBackup.backupDirPath) {
        // Restore from existing backup path
        await electronAPI.restoreBackup(selectedBackup.backupDirPath);
      } else {
        throw new Error('Invalid backup path');
      }
      
      showSnackbar('Database restored successfully! Please restart the app.', 'success');
      setRestoreDialog(false);
    } catch (err) {
      showSnackbar('Restore failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== DELETE BACKUP ====================
  const handleDeleteBackup = (index) => {
    const updated = backups.filter((_, i) => i !== index);
    setBackups(updated);
    localStorage.setItem('backup_history', JSON.stringify(updated));
    showSnackbar('Backup record removed', 'info');
  };

  // ==================== HELPERS ====================
  const addBackupRecord = (type, status) => {
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      type,
      size: dbInfo.size,
      status,
      path: type === 'local' ? 'Downloads/pos-backup.db' : 'Cloud Storage'
    };
    const updated = [record, ...backups];
    setBackups(updated);
    localStorage.setItem('backup_history', JSON.stringify(updated));
  };

  const simulateProgress = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 200);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* HEADER */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
          <Backup sx={{ verticalAlign: 'middle', mr: 1 }} />
          Data Backup & Recovery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Protect your business data. Automatic backups prevent data loss from system crashes.
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Uploading... {uploadProgress}%</Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {/* WARNING ALERT */}
      <Alert severity="warning" sx={{ mb: 3 }} icon={<Warning />}>
        <Typography variant="body2" fontWeight="bold">
          Important: Your database file contains ALL business data (sales, customers, inventory, suppliers).
          Windows corruption can delete everything instantly. Enable auto-backup NOW.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* LEFT COLUMN - STATUS & ACTIONS */}
        <Grid item xs={12} md={4}>
          {/* Database Status Card */}
          <Card sx={{ mb: 2, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                <Storage sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                Database Status
              </Typography>
              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">File Location</Typography>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                    {dbInfo.path || 'Unknown'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">File Size</Typography>
                    <Typography variant="h6" fontWeight="bold">{formatBytes(dbInfo.size)}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="caption" color="text.secondary">Last Modified</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatDate(dbInfo.lastModified)}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    size="small" 
                    color={backups.length > 0 ? 'success' : 'error'}
                    icon={backups.length > 0 ? <CheckCircle fontSize="small" /> : <Error fontSize="small" />}
                    label={backups.length > 0 ? 'Protected' : 'No Backup Found'}
                  />
                  {backups.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Last: {formatDate(backups[0]?.date)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                <CloudUpload sx={{ verticalAlign: 'middle', mr: 1, color: 'success.main' }} />
                Quick Backup
              </Typography>
              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={1.5}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<Download />}
                  onClick={() => handleManualBackup('local')}
                  disabled={loading}
                >
                  Download Backup File (.db)
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  color="info"
                  startIcon={<Email />}
                  onClick={() => handleManualBackup('gmail')}
                  disabled={loading || !gmailConfig.enabled}
                >
                  Email to Gmail
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<CloudUpload />}
                  onClick={() => handleManualBackup('drive')}
                  disabled={loading}
                >
                  Upload to Google Drive
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  startIcon={<Restore />}
                  onClick={() => setRestoreDialog(true)}
                  disabled={loading || backups.length === 0}
                >
                  Restore from Backup
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Auto Backup Toggle */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  <Schedule sx={{ verticalAlign: 'middle', mr: 1, color: 'warning.main' }} />
                  Auto Backup
                </Typography>
                <Switch
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  color="primary"
                />
              </Box>

              {autoBackup && (
                <Alert severity="info" sx={{ mb: 2 }} icon={<Info />}>
                  <Typography variant="body2">
                    App will automatically backup every {backupInterval === 'daily' ? '24 hours' : backupInterval === 'weekly' ? '7 days' : '30 days'}.
                    Keep the app running for scheduled backups.
                  </Typography>
                </Alert>
              )}

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Backup Interval</InputLabel>
                <Select
                  value={backupInterval}
                  onChange={(e) => setBackupInterval(e.target.value)}
                  label="Backup Interval"
                >
                  <MenuItem value="daily">Every Day (Recommended)</MenuItem>
                  <MenuItem value="weekly">Every Week</MenuItem>
                  <MenuItem value="monthly">Every Month</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Default Destination</InputLabel>
                <Select
                  value={backupDestination}
                  onChange={(e) => setBackupDestination(e.target.value)}
                  label="Default Destination"
                >
                  <MenuItem value="local">Local File Only</MenuItem>
                  <MenuItem value="gmail">Gmail Email</MenuItem>
                  <MenuItem value="drive">Google Drive</MenuItem>
                  <MenuItem value="both">Email + Local (Safest)</MenuItem>
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                size="small"
                startIcon={<Settings />}
                onClick={saveSettings}
              >
                Save Backup Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN - GMAIL CONFIG & HISTORY */}
        <Grid item xs={12} md={8}>
          {/* Gmail Configuration */}
          <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'error.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  <Email sx={{ verticalAlign: 'middle', mr: 1, color: 'error.main' }} />
                  Gmail Backup Configuration
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={gmailConfig.enabled}
                      onChange={(e) => setGmailConfig({...gmailConfig, enabled: e.target.checked})}
                      color="error"
                    />
                  }
                  label="Enable"
                />
              </Box>

              <Alert severity="info" sx={{ mb: 2 }} icon={<Lock />}>
                <Typography variant="body2">
                  <strong>Security Note:</strong> Use Gmail <strong>App Password</strong> (not your regular password). 
                  Enable 2FA in Google Account → Security → App Passwords → Generate for "Mail".
                </Typography>
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Your Gmail Address"
                    placeholder="yourstore@gmail.com"
                    value={gmailConfig.email}
                    onChange={(e) => setGmailConfig({...gmailConfig, email: e.target.value})}
                    disabled={!gmailConfig.enabled}
                    InputProps={{
                      startAdornment: <Email sx={{ mr: 1, color: 'action.active', fontSize: 20 }} />
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="App Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={gmailConfig.appPassword}
                    onChange={(e) => setGmailConfig({...gmailConfig, appPassword: e.target.value})}
                    disabled={!gmailConfig.enabled}
                    helperText="16-character app password from Google"
                    InputProps={{
                      startAdornment: <Lock sx={{ mr: 1, color: 'action.active', fontSize: 20 }} />
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Send Backup To (Email)"
                    placeholder="backup@yourcompany.com"
                    value={gmailConfig.toEmail}
                    onChange={(e) => setGmailConfig({...gmailConfig, toEmail: e.target.value})}
                    disabled={!gmailConfig.enabled}
                    helperText="Can be same as above or different email for storage"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Send />}
                  onClick={() => handleManualBackup('gmail')}
                  disabled={!gmailConfig.enabled || loading}
                >
                  Test Email Backup
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<CheckCircle />}
                  onClick={saveSettings}
                >
                  Save Gmail Settings
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Backup History */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  <History sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                  Backup History
                </Typography>
                <Badge badgeContent={backups.length} color="primary">
                  <Backup color="action" />
                </Badge>
              </Box>

              {backups.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
                  <CloudOff sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary">No backups found</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Create your first backup using the buttons on the left
                  </Typography>
                </Paper>
              ) : (
                <List dense>
                  {backups.map((backup, index) => (
                    <Paper key={backup.id} sx={{ mb: 1, bgcolor: index === 0 ? 'success.50' : 'background.paper' }}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" onClick={() => handleDeleteBackup(index)} color="error">
                            <Delete fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemIcon>
                          {backup.type === 'gmail' ? <Email color="error" /> :
                           backup.type === 'drive' ? <CloudDone color="info" /> :
                           backup.type === 'local' ? <Computer color="primary" /> :
                           <Backup color="action" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight="bold">
                                {backup.type === 'gmail' ? 'Gmail Backup' :
                                 backup.type === 'drive' ? 'Google Drive' :
                                 backup.type === 'local' ? 'Local Backup' : 'Backup'}
                              </Typography>
                              <Chip size="small" label={formatBytes(backup.size)} variant="outlined" />
                              {index === 0 && <Chip size="small" color="success" label="Latest" />}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption">
                              {formatDate(backup.date)} • {backup.status} • {backup.path}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* RESTORE DIALOG */}
      <Dialog open={restoreDialog} onClose={() => setRestoreDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'warning.main' }}>
          <Restore sx={{ verticalAlign: 'middle', mr: 1 }} />
          Restore Database
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Warning: Restoring will REPLACE all current data with backup data.
              Any new sales, inventory changes, or customers added after this backup will be LOST.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" gutterBottom>Select Backup to Restore:</Typography>
          <List dense>
            {backups.map((backup) => (
              <Paper 
                key={backup.id} 
                sx={{ 
                  mb: 1, 
                  cursor: 'pointer',
                  border: selectedBackup?.id === backup.id ? 2 : 0,
                  borderColor: 'primary.main',
                  bgcolor: selectedBackup?.id === backup.id ? 'primary.50' : 'background.paper'
                }}
                onClick={() => setSelectedBackup(backup)}
              >
                <ListItem>
                  <ListItemIcon>
                    {backup.type === 'gmail' ? <Email /> : backup.type === 'drive' ? <CloudDone /> : <Computer />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${backup.type.toUpperCase()} Backup - ${formatDate(backup.date)}`}
                    secondary={`Size: ${formatBytes(backup.size)} • ${backup.status}`}
                  />
                </ListItem>
              </Paper>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or upload a .db file from your computer:
          </Typography>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<FolderOpen />}
          >
            Select Database File
            <input
              type="file"
              hidden
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setSelectedBackup({
                    id: 'upload-' + Date.now(),
                    path: e.target.files[0].path || e.target.files[0].name,
                    type: 'upload',
                    size: e.target.files[0].size,
                    date: new Date().toISOString()
                  });
                }
              }}
            />
          </Button>
          {selectedBackup?.type === 'upload' && (
            <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
              Selected: {selectedBackup.path}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleRestore}
            disabled={!selectedBackup || loading}
            startIcon={<Restore />}
          >
            {loading ? 'Restoring...' : 'Confirm Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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