import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '@mui/material/styles';
import logo from '../assets/wso2-logo.svg';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onToggleTheme: () => void;
  onSignOut?: () => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, onSignOut,  toggleSidebar }) => {
  const theme = useTheme();

  //Get current Location of the user
  const location = useLocation();
  const isUploadPage = location.pathname === '/';

  return (
    <AppBar 
      position="sticky" 
      color="default" 
      elevation={1} 
      sx={{ bgcolor: 'background.paper', zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        {/* Menu Icon triggering the passed down toggle function */}
        {!isUploadPage && (
        <IconButton
          edge="start"
          color="inherit"
          aria-label="open drawer"
          onClick={toggleSidebar}
          sx={{ mr: 1 }}
        >
          <MenuIcon />
        </IconButton>
        )}

        {/* Logo and Title */}
        <img src={logo} alt='WSO2_Logo' height="45" />
        <Typography variant="h5" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', ml: 0.5 }}>
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