import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider,
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
          top: '70px',
          height: 'calc(100% - 70px)',
          transition: 'width 0.2s',
          overflowX: 'hidden',
          overflowY: 'auto',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
        <Box sx={{ flexGrow: 1, p: 1, mt: 0.5 }}>
          <List>
            <ListItem disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                selected={isDashboard}
                onClick={() => navigate('/dashboard')}
                sx={{
                  minHeight: 48,
                  justifyContent: isSidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                  bgcolor: isDashboard ? '#ff6d00 !important' : 'transparent',
                  color: isDashboard ? 'white' : 'inherit',
                  borderRadius: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center' }}>
                  <DashboardIcon sx={{ color: isDashboard ? 'white' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText primary="Dashboard" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ display: 'block', mt: 1 }}>
              <ListItemButton
                selected={isThreadExplorer}
                onClick={() => navigate('/thread-explorer')}
                sx={{
                  minHeight: 48,
                  justifyContent: isSidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                  bgcolor: isThreadExplorer ? '#ff6d00 !important' : 'transparent',
                  color: isThreadExplorer ? 'white' : 'inherit',
                  borderRadius: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center' }}>
                  <ListAltIcon sx={{ color: isThreadExplorer ? 'white' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText primary="Thread Explorer" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ display: 'block', mt: 1 }}>
              <ListItemButton
                selected={isLockContention}
                onClick={() => navigate('/lock-contention')}
                sx={{
                  minHeight: 48,
                  justifyContent: isSidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                  bgcolor: isLockContention ? '#ff6d00 !important' : 'transparent',
                  color: isLockContention ? 'white' : 'inherit',
                  borderRadius: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center' }}>
                  <LockOutlinedIcon sx={{ color: isLockContention ? 'white' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText primary="Lock Contention" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ my: 2 }} />
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={handleNewSession}
            sx={{
              border: '1px solid #ccc',
              borderRadius: 1,
              justifyContent: isSidebarOpen ? 'initial' : 'center',
              px: 2.5,
              py: 0.45,
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center' }}>
              <RefreshIcon />
            </ListItemIcon>
            <ListItemText primary="New Session" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
          </ListItemButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
