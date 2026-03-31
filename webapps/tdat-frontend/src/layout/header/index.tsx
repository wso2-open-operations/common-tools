import { AppBar, Toolbar, Typography, IconButton, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';

import logo from '@assets/wso2-logo.svg';

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
      color="default"
      elevation={1}
      sx={{ bgcolor: 'background.paper', zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
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

        <img src={logo} alt="WSO2_Logo" height="45" />
        <Typography
          variant="h5"
          noWrap
          component="div"
          sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', ml: 0.5 }}
        >
          Thread Dump Analyzer
        </Typography>

        <Button
          sx={{
            ml: 1,
            borderRadius: 5,
            borderColor: 'grey.300',
            '&:hover': { borderColor: 'grey.500' },
          }}
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={() => signOut()}
          color="inherit"
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
