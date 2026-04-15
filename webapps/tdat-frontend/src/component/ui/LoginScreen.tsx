import { Box, Container, Paper, Typography, Button } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuthContext } from '@asgardeo/auth-react';

const LoginScreen = () => {
  const { signIn } = useAuthContext();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1c2333 100%)',
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
          background: 'radial-gradient(circle, rgba(255,109,0,0.08) 0%, transparent 70%)',
        },
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              bgcolor: 'rgba(255,109,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#ff6d00' }}>T</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1, letterSpacing: '-0.02em' }}>
            Thread Dump Analyzer
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, lineHeight: 1.6 }}>
            Internal tool for diagnosing JVM performance issues.
            <br />
            <Box component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>WSO2 Employees Only</Box>
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
