import { Box, Tooltip } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { useColorMode } from '@context/ColorModeContext';

const TRACK_WIDTH = 60;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;

const ThemeToggle = () => {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMode();
    }
  };

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} arrow>
      <Box
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        tabIndex={0}
        onClick={toggleMode}
        onKeyDown={handleKeyDown}
        sx={(theme) => ({
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          px: '7px',
          borderRadius: TRACK_HEIGHT / 2,
          border: `1px solid ${theme.palette.surface.borderStrong}`,
          bgcolor: theme.palette.surface.inset,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            borderColor: theme.palette.text.secondary,
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.brand.main}`,
            outlineOffset: 2,
          },
        })}
      >
        {/* Sliding thumb */}
        <Box
          sx={(theme) => ({
            position: 'absolute',
            top: THUMB_INSET,
            left: isDark ? `calc(100% - ${THUMB_SIZE + THUMB_INSET}px)` : THUMB_INSET,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: '50%',
            bgcolor: theme.palette.background.paper,
            boxShadow: theme.palette.mode === 'dark'
              ? '0 2px 6px rgba(0,0,0,0.6)'
              : '0 2px 6px rgba(0,0,0,0.18)',
            transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          })}
        />

        {/* Sun icon (left) */}
        <LightModeOutlinedIcon
          sx={(theme) => ({
            position: 'relative',
            zIndex: 1,
            fontSize: 16,
            color: !isDark ? theme.palette.warning.main : theme.palette.text.disabled,
            transition: 'color 0.22s ease',
          })}
        />

        {/* Moon icon (right) */}
        <DarkModeOutlinedIcon
          sx={(theme) => ({
            position: 'relative',
            zIndex: 1,
            fontSize: 15,
            color: isDark ? theme.palette.brand.main : theme.palette.text.disabled,
            transition: 'color 0.22s ease',
          })}
        />
      </Box>
    </Tooltip>
  );
};

export default ThemeToggle;
