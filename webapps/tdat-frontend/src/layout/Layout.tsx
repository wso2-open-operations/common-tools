import { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';
import { Outlet } from 'react-router-dom';

import Header from '@layout/header';
import Sidebar from '@layout/sidebar';
import Footer from '@layout/footer';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: `
          radial-gradient(ellipse at 18% 8%, rgba(196,181,243,0.22) 0%, transparent 55%),
          radial-gradient(ellipse at 72% 55%, rgba(255,197,150,0.18) 0%, transparent 55%),
          #f5f6fa`,
        backgroundAttachment: 'fixed',
      }}
    >
      <CssBaseline />

      <Header
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar isSidebarOpen={isSidebarOpen} />

        <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>

      <Footer />
    </Box>
  );
};

export default Layout;
