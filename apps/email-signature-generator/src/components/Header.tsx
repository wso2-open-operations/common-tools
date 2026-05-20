import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";

export default function Header() {
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
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "60px",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #FF7300, transparent)",
        },
      }}
    >
      <Box
        component="img"
        src="https://wso2.cachefly.net/wso2/sites/all/image_resources/logos/wso2-orange-logo.png"
        alt="WSO2"
        sx={{ width: 120, mb: 3, display: "block", mx: "auto" }}
      />
      <Typography
        variant="h2"
        sx={{
          fontSize: { xs: "2rem", md: "2.8rem" },
          fontWeight: 700,
          background: "linear-gradient(135deg, #FF7300 0%, #FF9133 50%, #FF7300 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
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
