import { Box, CircularProgress, Typography } from '@mui/material';

interface PreLoaderProps {
  isLoading?: boolean;
  message?: string;
}

const PreLoader = ({ isLoading = true, message }: PreLoaderProps) => {
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 2,
        background: theme.palette.mode === 'dark' ? '#0a0d12' : '#0d1117',
      })}
    >
      {isLoading && <CircularProgress sx={(theme) => ({ color: theme.palette.brand.main })} size={36} />}
      {message && (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default PreLoader;
