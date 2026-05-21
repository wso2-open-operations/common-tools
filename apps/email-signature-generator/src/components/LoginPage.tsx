import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { useAuthContext } from "@asgardeo/auth-react";
import { theme } from "../theme";

export default function LoginPage() {
  const { signIn } = useAuthContext();

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          px: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 3,
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "#f14e23",
            },
          }}
        >
          <Box
            component="img"
            src="https://wso2.cachefly.net/wso2/sites/all/image_resources/logos/WSO2-Logo-White.png"
            alt="WSO2"
            sx={{ width: 100, mb: 3, display: "block", mx: "auto" }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "#f14e23",
              mb: 1,
            }}
          >
            Email Signature Generator
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 4,
              fontFamily: '"Space Mono", monospace',
              fontSize: "0.75rem",
              letterSpacing: "0.05em",
            }}
          >
            WSO2 Internal Tool — Sign in to continue
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => signIn()}
            fullWidth
            sx={{
              bgcolor: "#f14e23",
              "&:hover": { bgcolor: "#c93d1b" },
              borderRadius: 2,
              py: 1.5,
              fontWeight: 600,
              textTransform: "none",
              fontSize: "1rem",
            }}
          >
            Sign in with Asgardeo
          </Button>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
