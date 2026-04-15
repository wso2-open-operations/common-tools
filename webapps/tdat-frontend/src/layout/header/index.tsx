import { AppBar, Toolbar, Typography, IconButton, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';
import '@fontsource-variable/inter/index.css';

import logo from '@assets/WSO2.png';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  const { signOut } = useAuthContext();
  const location = useLocation();
  const isUploadPage = location.pathname === '/';

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

        <img src={logo} alt="WSO2_Logo" height="36" style={{ marginRight: '8px', borderRadius: '6px' }} />
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ fontFamily: 'inherit', flexGrow: 1, fontWeight: 700, display: 'flex', alignItems: 'center', ml: 0.5, color: '#0d1117', letterSpacing: '-0.01em' }}
        >
          Thread Dump Analyzer
        </Typography>

        <Button
          sx={{
            ml: 1,
            borderRadius: 2,
            borderColor: 'rgba(0,0,0,0.12)',
            color: '#4b5563',
            fontSize: '0.8rem',
            px: 2,
            '&:hover': { borderColor: 'rgba(0,0,0,0.25)', bgcolor: 'rgba(0,0,0,0.03)' },
          }}
          variant="outlined"
          startIcon={<LogoutIcon sx={{ fontSize: '18px !important' }} />}
          onClick={() => signOut()}
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
