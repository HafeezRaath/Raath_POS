// QA-060: blank white page ki jagah proper Access Denied page
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied({ pageName }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('raath_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('raath_tenant_id');
    localStorage.removeItem('raath_shop_name');
    window.location.href = '/login';
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', p: 3 }}>
      <Paper sx={{ p: 4, maxWidth: 420, textAlign: 'center', borderRadius: 3 }}>
        <LockIcon sx={{ fontSize: 56, color: '#f59e0b', mb: 2 }} />
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {pageName
            ? `Aapke role ko "${pageName}" page dekhne ki ijazat nahi hai.`
            : 'Aapke role ko ye page dekhne ki ijazat nahi hai.'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
          Apne administrator se rabta karein agar aapko access chahiye.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Dashboard
          </Button>
          <Button variant="outlined" color="error" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
