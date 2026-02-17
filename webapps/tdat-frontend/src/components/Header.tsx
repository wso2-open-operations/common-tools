import React from 'react';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '@mui/material/styles';

interface HeaderProps {
  onToggleTheme: () => void;
  onSignOut?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, onSignOut }) => {
  const theme = useTheme();

  return (
    <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
      <Toolbar>
        {/* Title */}
        <img src="../src/assets/wso2-logo.svg" alt='WSO2 Logo' height="40" /> 
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: ' center', ml: 0.25}}>
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
  );
};

export default Header;