// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

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
      sx={(theme) => ({
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
          bgcolor: theme.palette.surface.sidebarBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: `1px solid ${theme.palette.surface.border}`,
        },
      })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
        <Box sx={{ flexGrow: 1, p: 1.5, mt: 0.5 }}>
          {isSidebarOpen && (
            <Box sx={{ px: 1.5, mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={(theme) => ({
                  color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                })}
              >
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
                  sx={(theme) => ({
                    minHeight: 44,
                    justifyContent: isSidebarOpen ? 'initial' : 'center',
                    px: 2,
                    borderRadius: 2,
                    bgcolor: item.active ? `${theme.palette.brand.softBg} !important` : 'transparent',
                    color: item.active ? theme.palette.brand.softText : theme.palette.text.secondary,
                    borderLeft: item.active ? `3px solid ${theme.palette.brand.main}` : '3px solid transparent',
                    '&:hover': {
                      bgcolor: item.active ? theme.palette.brand.softBg : theme.palette.surface.hoverBg,
                    },
                  })}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 2 : 'auto', justifyContent: 'center' }}>
                    {React.cloneElement(item.icon, {
                      sx: (theme: import('@mui/material/styles').Theme) => ({
                        color: item.active ? theme.palette.brand.main : theme.palette.text.secondary,
                        fontSize: 20,
                      }),
                    })}
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
            sx={(theme) => ({
              borderRadius: 2,
              justifyContent: isSidebarOpen ? 'initial' : 'center',
              px: 2,
              py: 1,
              border: `1px solid ${theme.palette.surface.border}`,
              '&:hover': { bgcolor: theme.palette.surface.hoverBg },
            })}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 2 : 'auto', justifyContent: 'center' }}>
              <RefreshIcon sx={(theme) => ({ fontSize: 20, color: theme.palette.text.secondary })} />
            </ListItemIcon>
            <ListItemText
              primary="New Session"
              sx={{ opacity: isSidebarOpen ? 1 : 0 }}
              slotProps={{ primary: { sx: { fontSize: '0.82rem', fontWeight: 500 } } }}
            />
          </ListItemButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
