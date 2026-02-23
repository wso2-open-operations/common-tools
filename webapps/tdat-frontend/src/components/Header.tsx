import { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Drawer, Box } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '@mui/material/styles';
import logo from '../assets/wso2-logo.svg';

interface HeaderProps {
  onToggleTheme: () => void;
  onSignOut?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, onSignOut }) => {
  const theme = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Sidebar width when expanded and collapsed
  const drawerWidth = 240;
  const collapsedWidth = 65;

  return (
    <>
      {/* Added zIndex to ensure Header stays above the Drawer */}
      <AppBar 
        position="sticky" 
        color="default" 
        elevation={1} 
        sx={{ bgcolor: 'background.paper', zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {/* 1. Menu Icon moved here, directly inside the Toolbar */}
          <IconButton
            edge="start"
            color="inherit"
            aria-label="open drawer"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo and Title */}
          <img src={logo} alt='WSO2_Logo' height="40" />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', ml: 1 }}>
            Thread Dump Analyzer
          </Typography>

          {/* Theme Toggle */}
          <IconButton sx={{ ml: 1 }} onClick={onToggleTheme} color="inherit">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          {/* Logout Button */}
          {onSignOut && (
            <IconButton sx={{ ml: 1 }} onClick={onSignOut} color="inherit" title="Logout">
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* 2. Drawer moved OUTSIDE the AppBar */}
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
            top: '70px', // Matches your Header height
            height: 'calc(100% - 70px)',
            transition: 'width 0.2s',
            overflowX: 'hidden',
            overflowY: 'auto',
          },
        }}
      >
        {/* You will place your Sidebar Links/List here later */}
        <Box sx={{ p: 2 }}>
          {/* Placeholder for sidebar content */}
        </Box>
      </Drawer>
    </>
  );
};

export default Header;