import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useAnalysisData } from '@context/AnalysisContext';

const drawerWidth = 240;
const collapsedWidth = 65;

interface SidebarProps {
  isSidebarOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearSession } = useAnalysisData();

  const handleNewSession = () => {
    if (window.confirm('Are you sure to start a new session? This will clear current analysis data.')) {
      clearSession();
      navigate('/');
    }
  };

  const isDashboard = location.pathname === '/dashboard';
  const isThreadExplorer = location.pathname === '/thread-explorer';
  const isLockContention = location.pathname === '/lock-contention';

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isSidebarOpen ? drawerWidth : collapsedWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        [`& .MuiDrawer-paper`]: {
          width: isSidebarOpen ? drawerWidth : collapsedWidth,
          boxSizing: 'border-box',
          top: '64px',
          height: 'calc(100% - 64px)',
          transition: 'width 0.2s',
          overflowX: 'hidden',
          overflowY: 'auto',
          bgcolor: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
        <Box sx={{ flexGrow: 1, p: 1.5, mt: 0.5 }}>
          {isSidebarOpen && (
            <Box sx={{ px: 1.5, mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#8b949e', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Navigation
              </Typography>
            </Box>
          )}
          <List>
            {[
              { active: isDashboard, label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
              { active: isThreadExplorer, label: 'Thread Explorer', icon: <ListAltIcon />, path: '/thread-explorer' },
              { active: isLockContention, label: 'Lock Contention', icon: <LockOutlinedIcon />, path: '/lock-contention' },
            ].map((item) => (
              <ListItem key={item.path} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                <ListItemButton
                  selected={item.active}
                  onClick={() => navigate(item.path)}
                  sx={{
                    minHeight: 44,
                    justifyContent: isSidebarOpen ? 'initial' : 'center',
                    px: 2,
                    borderRadius: 2,
                    bgcolor: item.active ? 'rgba(255,237,213,0.7) !important' : 'transparent',
                    color: item.active ? '#ea580c' : '#4b5563',
                    borderLeft: item.active ? '3px solid #ff6d00' : '3px solid transparent',
                    '&:hover': {
                      bgcolor: item.active ? 'rgba(255,237,213,0.7)' : 'rgba(0,0,0,0.03)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 2 : 'auto', justifyContent: 'center' }}>
                    {React.cloneElement(item.icon, { sx: { color: item.active ? '#ff6d00' : '#6b7280', fontSize: 20 } })}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    sx={{ opacity: isSidebarOpen ? 1 : 0 }}
                    slotProps={{ primary: { sx: { fontSize: '0.85rem', fontWeight: item.active ? 600 : 500 } } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Divider sx={{ mb: 1.5 }} />
          <ListItemButton
            onClick={handleNewSession}
            sx={{
              borderRadius: 2,
              justifyContent: isSidebarOpen ? 'initial' : 'center',
              px: 2,
              py: 1,
              border: '1px solid rgba(0,0,0,0.08)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 2 : 'auto', justifyContent: 'center' }}>
              <RefreshIcon sx={{ fontSize: 20, color: '#6b7280' }} />
            </ListItemIcon>
            <ListItemText
              primary="New Session"
              sx={{ opacity: isSidebarOpen ? 1 : 0 }}
              slotProps={{ primary: { sx: { fontSize: '0.82rem', fontWeight: 500, color: '#374151' } } }}
            />
          </ListItemButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
