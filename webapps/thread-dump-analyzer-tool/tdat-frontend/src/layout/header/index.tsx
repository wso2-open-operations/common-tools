// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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

import { useState } from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Button, Menu, MenuItem,
  ListItemIcon, ListItemText,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';
import '@fontsource-variable/inter/index.css';

import logoLight from '@assets/WSO2-Logo-Black.webp';
import logoDark from '@assets/WSO2-Logo-White.webp';
import { useExportReport } from '@hooks/useExportReport';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '@mui/material';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  const { signOut } = useAuthContext();
  const theme = useTheme();
  const logo = theme.palette.mode === 'dark' ? logoDark : logoLight;
  const location = useLocation();
  const isUploadPage = location.pathname === '/';
  const { exportReport, isExporting, exported, hasData } = useExportReport();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={(theme) => ({
        bgcolor: theme.palette.surface.headerBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: theme.zIndex.drawer + 1,
        borderBottom: `1px solid ${theme.palette.surface.border}`,
        color: theme.palette.text.primary,
      })}
    >
      <Toolbar>
        {!isUploadPage && (
          <IconButton
            edge="start"
            aria-label="open drawer"
            onClick={toggleSidebar}
            sx={(theme) => ({
              mr: 1,
              color: theme.palette.text.secondary,
              '&:hover': { bgcolor: theme.palette.surface.hoverBg },
            })}
          >
            <MenuIcon />
          </IconButton>
        )}

        <img
          src={logo}
          alt="WSO2_Logo"
          style={{
            height: '1.5rem',
            marginLeft: '4px',
            marginRight: '10px',
            borderRadius: '6px',
          }}
        />
        <Typography
          variant="h5"
          noWrap
          component="div"
          sx={(theme) => ({
            fontFamily: 'inherit',
            flexGrow: 1,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            color: theme.palette.text.primary,
            letterSpacing: '-0.01em',
          })}
        >
          Thread Dump Analyzer
        </Typography>

        {!isUploadPage && (
          <Button
            size="small"
            variant="outlined"
            disabled={!hasData || isExporting}
            onClick={exportReport}
            startIcon={exported
              ? <CheckIcon sx={(theme) => ({ fontSize: '18px !important', color: theme.palette.severity.success.main })} />
              : <FileDownloadOutlinedIcon sx={{ fontSize: '18px !important' }} />}
            sx={(theme) => ({
              mr: 1,
              borderRadius: 2,
              borderColor: exported ? theme.palette.severity.success.border : theme.palette.surface.borderStrong,
              bgcolor: exported ? theme.palette.severity.success.bg : 'transparent',
              color: exported ? theme.palette.severity.success.text : theme.palette.text.secondary,
              fontSize: '0.8rem',
              px: 2,
              '&:hover': {
                borderColor: exported ? theme.palette.severity.success.border : theme.palette.text.secondary,
                bgcolor: exported ? theme.palette.severity.success.bg : theme.palette.surface.hoverBg,
              },
              '&.Mui-disabled': { opacity: 0.4 },
            })}
          >
            {exported ? 'Exported' : 'Export Report'}
          </Button>
        )}

        <ThemeToggle />

        <IconButton
          onClick={(e) => setSettingsAnchor(e.currentTarget)}
          sx={(theme) => ({
            ml: 1,
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.palette.surface.borderStrong}`,
            borderRadius: 2,
            width: 36,
            height: 36,
            '&:hover': {
              bgcolor: theme.palette.surface.hoverBg,
              borderColor: theme.palette.text.secondary,
            },
          })}
        >
          <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Menu
          anchorEl={settingsAnchor}
          open={Boolean(settingsAnchor)}
          onClose={() => setSettingsAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: (theme) => ({
                mt: 0.5,
                minWidth: 160,
                borderRadius: 2,
                border: `1px solid ${theme.palette.surface.border}`,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 18px rgba(0,0,0,0.5)'
                  : '0 4px 12px rgba(0,0,0,0.08)',
              }),
            },
          }}
        >
          <MenuItem
            onClick={() => { setSettingsAnchor(null); signOut(); }}
            sx={{ fontSize: '0.85rem', py: 1 }}
          >
            <ListItemIcon>
              <LogoutIcon sx={(theme) => ({ fontSize: 18, color: theme.palette.text.secondary })} />
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}>Logout</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
