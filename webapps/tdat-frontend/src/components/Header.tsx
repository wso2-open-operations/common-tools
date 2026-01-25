import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Box, 
  Typography, 
  IconButton, 
  useTheme 
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

interface HeaderProps {
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme }) => {
  const theme = useTheme();

  return (
    <AppBar 
      position="relative" 
      color="transparent" 
      elevation={0} 
      sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}
    >
      <Toolbar sx={{ minHeight: '70px !important' }}>
        {/* Logo Box (Purple) */}
        <Box 
          sx={{ 
            backgroundColor: '#673ab7', 
            borderRadius: 1, 
            width: 40, 
            height: 40, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            mr: 2 
          }}
        >
          <DescriptionIcon sx={{ color: 'white' }} />
        </Box>

        {/* Title and Subtitle */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
            Thread Dump Analyzer
          </Typography>
        </Box>

        {/* Theme Toggle Button */}
        <IconButton onClick={onToggleTheme} color="inherit">
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Header;