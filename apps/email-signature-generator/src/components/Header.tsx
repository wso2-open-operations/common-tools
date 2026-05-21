import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useAuthContext } from "@asgardeo/auth-react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";

interface Props {
  displayName: string;
}

export default function Header({ displayName }: Props) {
  const { signOut } = useAuthContext();

  return (
    <Box
      component={motion.header}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      sx={{
        textAlign: "center",
        py: 6,
        px: 3,
        position: "relative",
      }}
    >
      {/* User info + sign out */}
      <Box
        data-testid="user-display"
        sx={{
          position: "absolute",
          top: 16,
          right: 24,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        {displayName && (
          <Typography
            data-testid="display-name-text"
            variant="body2"
            sx={{
              color: "text.secondary",
              fontFamily: '"Space Mono", monospace',
              fontSize: "0.75rem",
            }}
          >
            {displayName}
          </Typography>
        )}
        <Button
          size="small"
          onClick={() => signOut()}
          startIcon={<LogOut size={14} />}
          sx={{
            color: "text.secondary",
            textTransform: "none",
            fontSize: "0.75rem",
            "&:hover": { color: "#f14e23" },
          }}
        >
          Sign out
        </Button>
      </Box>

      <Box
        component="img"
        src="https://wso2.cachefly.net/wso2/sites/all/image_resources/logos/WSO2-Logo-White.png"
        alt="WSO2"
        sx={{ width: 120, mb: 3, display: "block", mx: "auto" }}
      />
      <Typography
        variant="h2"
        sx={{
          fontSize: { xs: "2rem", md: "2.8rem" },
          fontWeight: 700,
          color: "#f14e23",
          letterSpacing: "-0.03em",
          mb: 1,
        }}
      >
        Email Signature Generator
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          fontFamily: '"Space Mono", monospace',
          fontSize: "0.8rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        WSO2 Internal Tool — Generate your official email signature
      </Typography>
    </Box>
  );
}
