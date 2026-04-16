import { useEffect } from 'react';
import { Box, Container, Paper, Typography, Button } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuthContext } from '@asgardeo/auth-react';
import pulseOrange from '@assets/pulse-orange.svg';

const LoginScreen = () => {
  const { signIn } = useAuthContext();

  useEffect(() => {
    document.title = 'WSO2 Thread Dump Analyzer';
  }, []);

  return (
    <Box
      sx={{
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
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.08)',
            bgcolor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
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
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1, letterSpacing: '-0.02em' }}>
            WSO2 Thread Dump Analyzer Tool 
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280', mb: 4, lineHeight: 1.6 }}>
            Internal tool for diagnosing JVM performance issues.
            <br />
            <Box component="span" sx={{ color: '#374151', fontWeight: 600 }}>WSO2 Employees Only</Box>
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => signIn()}
            startIcon={<LoginIcon />}
            sx={{
              bgcolor: '#ff6d00',
              py: 1.5,
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: 2.5,
              boxShadow: '0 4px 14px rgba(255,109,0,0.35)',
              '&:hover': { bgcolor: '#e65100', boxShadow: '0 6px 20px rgba(255,109,0,0.4)' },
            }}
          >
            Sign In
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginScreen;
