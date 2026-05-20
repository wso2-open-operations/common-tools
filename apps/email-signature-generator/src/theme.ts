import { createTheme } from "@mui/material/styles";

const WSO2_ORANGE = "#FF7200";
const WSO2_ORANGE_DARK = "#E55A00";
const WSO2_ORANGE_LIGHT = "#FF9133";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: WSO2_ORANGE,
      light: WSO2_ORANGE_LIGHT,
      dark: WSO2_ORANGE_DARK,
      contrastText: "#ffffff",
    },
    background: {
      default: "#080808",
      paper: "#111111",
    },
    text: {
      primary: "#f0f0f0",
      secondary: "#888888",
    },
    divider: "#222222",
  },
  typography: {
    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.03em" },
    h2: { fontWeight: 600, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600, letterSpacing: "-0.01em" },
    body1: { fontSize: "0.95rem" },
    caption: {
      fontFamily: '"Space Mono", "JetBrains Mono", monospace',
      fontSize: "0.75rem",
    },
  },
  shape: { borderRadius: 14 },
  spacing: 8,
  components: {
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#0d0d0d",
            borderRadius: 10,
            "& fieldset": { borderColor: "#2a2a2a" },
            "&:hover fieldset": { borderColor: "#444444" },
            "&.Mui-focused fieldset": {
              borderColor: WSO2_ORANGE,
              boxShadow: `0 0 0 3px rgba(255, 115, 0, 0.12)`,
            },
          },
          "& .MuiInputLabel-root": {
            color: "#666666",
            fontSize: "0.85rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          },
          "& .MuiInputLabel-root.Mui-focused": { color: WSO2_ORANGE },
          "& .MuiInputAdornment-root .lucide": { color: "#555555", width: 16, height: 16 },
          "& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root .lucide": {
            color: WSO2_ORANGE,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 10, fontWeight: 600, letterSpacing: "0.02em" },
        contained: {
          backgroundColor: WSO2_ORANGE,
          "&:hover": { backgroundColor: WSO2_ORANGE_DARK },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#111111",
          border: "1px solid #1e1e1e",
        },
      },
    },
  },
});
