import React from 'react';
import { Box, Typography } from '@mui/material';

const Footer: React.FC = () => {
  return (
    <Box 
      component="footer" 
      sx={{ 
        display: 'absolute',
        py: 3, 
        mt: 'auto',
        borderTop: 1, 
        borderColor: 'divider',
        textAlign: 'center'
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Thread Dump Analyzer Tool &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
};

export default Footer;