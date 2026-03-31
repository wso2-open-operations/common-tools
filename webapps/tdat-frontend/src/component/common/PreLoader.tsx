import { Box, CircularProgress, Typography } from '@mui/material';

interface PreLoaderProps {
  isLoading?: boolean;
  message?: string;
}

const PreLoader = ({ isLoading = true, message }: PreLoaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 2,
        background: (theme) => theme.palette.background.default,
      }}
    >
      {isLoading && <CircularProgress sx={{ color: '#ff6d00' }} />}
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default PreLoader;
