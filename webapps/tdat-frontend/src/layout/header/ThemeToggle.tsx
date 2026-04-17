import { useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useColorMode } from '@context/ColorModeContext';
import type { ColorModePreference } from '@src/theme';

const OPTIONS: Array<{
  value: ColorModePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'light', label: 'Light', icon: <LightModeOutlinedIcon sx={{ fontSize: 18 }} /> },
  { value: 'dark', label: 'Dark', icon: <DarkModeOutlinedIcon sx={{ fontSize: 18 }} /> },
  { value: 'system', label: 'System', icon: <SettingsBrightnessOutlinedIcon sx={{ fontSize: 18 }} /> },
];

const ThemeToggle = () => {
  const { preference, resolvedMode, setPreference } = useColorMode();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handleSelect = (value: ColorModePreference) => {
    setPreference(value);
    setAnchor(null);
  };

  const ActiveIcon = resolvedMode === 'dark'
    ? <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />
    : <LightModeOutlinedIcon sx={{ fontSize: 20 }} />;

  return (
    <>
      <Tooltip title="Appearance" arrow>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label="Change theme"
          sx={(theme) => ({
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.palette.surface.borderStrong}`,
            borderRadius: 2,
            width: 36,
            height: 36,
            '&:hover': {
              bgcolor: theme.palette.surface.hoverBg,
              borderColor: theme.palette.text.secondary,
            },
          })}
        >
          {ActiveIcon}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              mt: 0.5,
              minWidth: 160,
              borderRadius: 2,
              border: `1px solid ${theme.palette.surface.border}`,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 18px rgba(0,0,0,0.5)'
                : '0 4px 12px rgba(0,0,0,0.08)',
            }),
          },
        }}
      >
        {OPTIONS.map(({ value, label, icon }) => {
          const isActive = preference === value;
          return (
            <MenuItem
              key={value}
              onClick={() => handleSelect(value)}
              sx={{ fontSize: '0.85rem', py: 1, gap: 1 }}
            >
              <ListItemIcon sx={(theme) => ({ color: theme.palette.text.secondary, minWidth: '28px !important' })}>
                {icon}
              </ListItemIcon>
              <ListItemText
                slotProps={{ primary: { sx: { fontSize: '0.85rem', fontWeight: isActive ? 600 : 400 } } }}
              >
                {label}
              </ListItemText>
              {isActive && (
                <CheckIcon
                  sx={(theme) => ({ fontSize: 16, color: theme.palette.brand.main, ml: 'auto' })}
                />
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default ThemeToggle;
