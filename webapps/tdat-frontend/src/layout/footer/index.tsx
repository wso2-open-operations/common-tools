import { Box, Typography } from '@mui/material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={(theme) => ({
        py: 2,
        mt: 'auto',
        borderTop: `1px solid ${theme.palette.surface.border}`,
        textAlign: 'center',
        bgcolor: theme.palette.surface.footerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      })}
    >
      <Typography
        variant="caption"
        sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: '0.7rem' })}
      >
        Thread Dump Analyzer Tool &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
};

export default Footer;
