import { Box, Container, Paper, Typography, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';
import { useAuthContext } from '@asgardeo/auth-react';

const LoginScreen = () => {
  const { signIn } = useAuthContext();

  return (
    <Container
      maxWidth="sm"
      sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Paper elevation={3} sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
        <Box sx={{ mb: 2, color: '#ff6d00', display: 'flex', justifyContent: 'center' }}>
          <LockIcon sx={{ fontSize: 60 }} />
        </Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Thread Dump Analyzer
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Internal tool for diagnosing JVM performance issues.
          <br />
          <strong>WSO2 Employees Only</strong>
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => signIn()}
          sx={{
            bgcolor: '#ff6d00',
            textTransform: 'none',
            px: 4,
            '&:hover': { bgcolor: '#e65100' },
          }}
        >
          <LoginIcon sx={{ mr: 1 }} /> Login
        </Button>
      </Paper>
    </Container>
  );
};

export default LoginScreen;
