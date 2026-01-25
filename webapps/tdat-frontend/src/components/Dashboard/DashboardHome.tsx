import React from 'react';
import { Typography, Box } from '@mui/material';

const DashboardHome: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Dashboard Overview
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Dashboard page
      </Typography>
    </Box>
  );
};

export default DashboardHome;