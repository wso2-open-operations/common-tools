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

import logo from '@assets/wso2-logo_black.png';
import { useExportReport } from '@hooks/useExportReport';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  const { signOut } = useAuthContext();
  const location = useLocation();
  const isUploadPage = location.pathname === '/';
  const { exportReport, isExporting, exported, hasData } = useExportReport();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Toolbar>
        {!isUploadPage && (
          <IconButton
            edge="start"
            aria-label="open drawer"
            onClick={toggleSidebar}
            sx={{ mr: 1, color: '#4b5563', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <img src={logo} alt="WSO2_Logo" height="40" style={{ marginRight: '2px', borderRadius: '6px' }} />
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ fontFamily: 'inherit', flexGrow: 1, fontWeight: 700, display: 'flex', alignItems: 'center', color: '#0d1117', letterSpacing: '-0.01em' }}
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
              ? <CheckIcon sx={{ fontSize: '18px !important', color: '#16a34a' }} />
              : <FileDownloadOutlinedIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              mr: 1,
              borderRadius: 2,
              borderColor: exported ? 'rgba(187,247,208,0.7)' : 'rgba(0,0,0,0.12)',
              bgcolor: exported ? 'rgba(240,253,244,0.7)' : 'transparent',
              color: exported ? '#16a34a' : '#4b5563',
              fontSize: '0.8rem',
              px: 2,
              '&:hover': { borderColor: exported ? 'rgba(187,247,208,0.9)' : 'rgba(0,0,0,0.25)', bgcolor: exported ? 'rgba(240,253,244,0.8)' : 'rgba(0,0,0,0.03)' },
              '&.Mui-disabled': { opacity: 0.4 },
            }}
          >
            {exported ? 'Exported' : 'Export Report'}
          </Button>
        )}

        <IconButton
          onClick={(e) => setSettingsAnchor(e.currentTarget)}
          sx={{
            color: '#4b5563',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 2,
            width: 36,
            height: 36,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.25)' },
          }}
        >
          <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Menu
          anchorEl={settingsAnchor}
          open={Boolean(settingsAnchor)}
          onClose={() => setSettingsAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 0.5, minWidth: 160, borderRadius: 2, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } } }}
        >
          <MenuItem
            onClick={() => { setSettingsAnchor(null); signOut(); }}
            sx={{ fontSize: '0.85rem', py: 1 }}
          >
            <ListItemIcon><LogoutIcon sx={{ fontSize: 18, color: '#6b7280' }} /></ListItemIcon>
            <ListItemText slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}>Logout</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
