import React from 'react';
import { Box, CssBaseline } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const DashboardLayout: React.FC<{ isSidebarOpen: boolean }> = ({ isSidebarOpen }) => {
    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 70px)' }}>
            <CssBaseline />

            <Sidebar isSidebarOpen={isSidebarOpen} />

            {/* Main Content Area */}
            <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f8f9fa', overflow: 'auto' }}>
                <Outlet />
            </Box>
        </Box>
    );
};

export default DashboardLayout;