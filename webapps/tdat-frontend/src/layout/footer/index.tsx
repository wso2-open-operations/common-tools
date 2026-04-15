import { Box, Typography } from '@mui/material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        mt: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        textAlign: 'center',
        bgcolor: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Typography variant="caption" sx={{ color: '#8b949e', fontSize: '0.7rem' }}>
        Thread Dump Analyzer Tool &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
};

export default Footer;
