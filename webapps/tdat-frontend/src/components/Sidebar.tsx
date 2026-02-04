import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider,
  IconButton
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import { useAnalysisData } from '../context/AnalysisContext';

// Sidebar width when expanded and collapsed
const drawerWidth = 240;
const collapsedWidth = 65;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearSession } = useAnalysisData();

  const handleNewSession = () => {
    if (window.confirm("Are you sure to start a new session? This will clear current analysis data.")) {
      clearSession();
      navigate('/'); 
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // If path is exactly '/dashboard', Dashboard is active
  const isDashboard = location.pathname === '/dashboard';
  // If path includes 'thread-explorer', that is active
  const isThreadExplorer = location.pathname.includes('/dashboard/thread-explorer');

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

        <Box sx={{ display: 'flex', justifyContent: isSidebarOpen ? 'flex-end' : 'center', p: 1 }}>
          <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ flexGrow: 1, p: 1 }}>
          <List>
            {/* Dashboard Button */}
            <ListItem disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                selected={isDashboard}
                onClick={() => navigate('/dashboard')} // Navigate to default
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

            {/* Thread Explorer Button */}
            <ListItem disablePadding sx={{ display: 'block', mt: 1 }}>
              <ListItemButton
                selected={isThreadExplorer}
                onClick={() => navigate('/dashboard/thread-explorer')}
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
          </List>

          <Divider sx={{ my: 2 }} />
        </Box>

        <Divider />
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={handleNewSession}
            sx={{ border: '1px solid #ccc', borderRadius: 1, justifyContent: isSidebarOpen ? 'initial' : 'center', px: 2.5, py: 0.45 }}
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