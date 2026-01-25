import React from 'react';
import {
    Box, CssBaseline, Typography, Chip,
    Paper, TextField
} from '@mui/material';
import Grid from '@mui/material/Grid';
import Sidebar from '../components/Sidebar';
import SearchIcon from '@mui/icons-material/Search';

const DashboardPage: React.FC = () => {
    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 70px)' }}>
            <CssBaseline />

            <Sidebar />
            
            {/* Thread Pool Implementation*/}
            <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f8f9fa', overflow: 'auto' }}>

                <Box mb={3}>
                    <Typography variant="h5" fontWeight="bold">http-nio-8080</Typography>
                    <Typography variant="body2" color="text.secondary">50 threads in this pool</Typography>
                </Box>

                <Paper component="form" sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400, mb: 3, bgcolor: '#f1f3f4' }} elevation={0}>
                    <SearchIcon sx={{ p: '10px', color: 'text.secondary'}} />
                    <TextField
                        variant="standard"
                        placeholder="Search threads by name or ID..."
                        slotProps={{
                            input: {
                                disableUnderline: true,
                            },
                        }}
                        sx={{ ml: 1, flex: 1 }}
                    />
                </Paper>

                {/* Thread Details */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={1} sx={{ borderBottom: '1px solid #eee', pb: 1, mb: 2 }}>
                        <Grid size={{ xs: 2 }}><Typography variant="caption" fontWeight="bold">Thread ID</Typography></Grid>
                        <Grid size={{ xs: 3 }}><Typography variant="caption" fontWeight="bold">Thread Name</Typography></Grid>
                        <Grid size={{ xs: 2 }}><Typography variant="caption" fontWeight="bold">Last Known State</Typography></Grid>
                        <Grid size={{ xs: 1.5 }}><Typography variant="caption" fontWeight="bold">Avg CPU (%)</Typography></Grid>
                        <Grid size={{ xs: 1.5 }}><Typography variant="caption" fontWeight="bold">Max CPU (%)</Typography></Grid>
                        <Grid size={{ xs: 2 }}><Typography variant="caption" fontWeight="bold">Avg User Time</Typography></Grid>
                    </Grid>

                    <Grid container spacing={1} alignItems="center">
                        <Grid size={{ xs: 2 }}><Typography variant="body2">0x00007fd1ef626b90</Typography></Grid>
                        <Grid size={{ xs: 3 }}><Typography variant="body2">http-nio-8080-89</Typography></Grid>
                        <Grid size={{ xs: 2 }}><Chip label="BLOCKED" color="error" size="small" variant="outlined" sx={{ bgcolor: '#ffebee', border: 'none' }} /></Grid>
                        <Grid size={{ xs: 1.5 }}><Typography variant="body2" color="info">40.87%</Typography></Grid>
                        <Grid size={{ xs: 1.5 }}><Typography variant="body2" color="warning.main">80.36%</Typography></Grid>
                        <Grid size={{ xs: 2 }}><Typography variant="body2">4500ms</Typography></Grid>
                    </Grid>
                </Paper>
            </Box>
        </Box>
    );
};

export default DashboardPage;