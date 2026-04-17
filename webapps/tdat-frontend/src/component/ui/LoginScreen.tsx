import { useEffect, useMemo } from 'react';
import { Box, Container, Paper, Typography, Button, ThemeProvider, CssBaseline } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuthContext } from '@asgardeo/auth-react';
import pulseOrange from '@assets/pulse-orange.svg';
import { themeSettings } from '@src/theme';

const LoginScreen = () => {
  const { signIn } = useAuthContext();
  const lightTheme = useMemo(() => themeSettings('light'), []);

  useEffect(() => {
    document.title = 'WSO2 Thread Dump Analyzer';
  }, []);

  return (
    <ThemeProvider theme={lightTheme}>
    <CssBaseline />
    <Box
      sx={(theme) => ({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 40%, #f1f3f5 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,109,0,0.06) 0%, transparent 70%)',
        },
      })}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            border: `1px solid ${theme.palette.surface.border}`,
            bgcolor: theme.palette.surface.translucent,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          })}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <img src={pulseOrange} alt="TDAT" width={100} height={100} />
          </Box>
          <Typography
            variant="h5"
            sx={(theme) => ({
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 1,
              letterSpacing: '-0.02em',
            })}
          >
            WSO2 Thread Dump Analyzer Tool
          </Typography>
          <Typography
            variant="body2"
            sx={(theme) => ({ color: theme.palette.text.secondary, mb: 4, lineHeight: 1.6 })}
          >
            Internal tool for diagnosing JVM performance issues.
            <br />
            <Box
              component="span"
              sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 600 })}
            >
              WSO2 Employees Only
            </Box>
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => signIn()}
            startIcon={<LoginIcon />}
            sx={(theme) => ({
              bgcolor: theme.palette.brand.main,
              color: theme.palette.brand.contrast,
              py: 1.5,
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: 2.5,
              boxShadow: theme.palette.brand.shadow,
              '&:hover': {
                bgcolor: theme.palette.brand.hover,
                boxShadow: '0 6px 20px rgba(255,109,0,0.4)',
              },
            })}
          >
            Sign In
          </Button>
        </Paper>
      </Container>
    </Box>
    </ThemeProvider>
  );
};

export default LoginScreen;
