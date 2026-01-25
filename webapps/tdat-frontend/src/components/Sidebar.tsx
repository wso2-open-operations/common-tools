import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, Typography,
  Collapse, Chip, IconButton
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';

// Sidebar width when expanded and collapsed
const drawerWidth = 240;
const collapsedWidth = 65;

// Mock Data as placeholders
const threadPools = [
  { name: 'http-nio-8080', count: 50, tag: 'HTTP' },
  { name: 'PassThroughMessageProcessor', count: 30, tag: 'WSO2' },
  { name: 'async-executor', count: 20, tag: 'Executor' },
  { name: 'GC task thread', count: 4, tag: 'JVM' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [openPools, setOpenPools] = useState(true);
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

          {isSidebarOpen && (
            <>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ px: 2, mb: 1 }}>
                Thread Groupings
              </Typography>

              <ListItemButton onClick={() => setOpenPools(!openPools)} sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 35 }}><Box component="span" sx={{ fontSize: 18 }}><LayersOutlinedIcon /></Box></ListItemIcon>
                <ListItemText primary={`Thread Pools (${threadPools.length})`} />
                {openPools ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>

              <Collapse in={openPools} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {threadPools.map((pool, index) => (
                    <ListItemButton
                      key={index}
                      // Clicking a pool could also go to thread explorer with a filter
                      onClick={() => navigate('/dashboard/thread-explorer')}
                      sx={{ pl: 4, mb: 0.5, borderRadius: 1, bgcolor: index === 0 ? '#fff3e0' : 'transparent' }}
                    >
                      <ListItemText
                        primary={pool.name}
                        secondary={`${pool.count} threads`}
                        slotProps={{
                          primary: {
                            fontSize: '0.9rem',
                            fontWeight: index === 0 ? 'bold' : 'normal',
                            noWrap: true,
                          },
                        }}
                      />
                      <Chip label={pool.tag} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </>
          )}
        </Box>

        <Divider />
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={() => navigate('/')}
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