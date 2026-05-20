import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import { useState } from "react";
import Header from "./components/Header";
import SignatureForm from "./components/SignatureForm";
import SignaturePreview from "./components/SignaturePreview";
import { theme } from "./theme";
import type { SignatureData } from "./types";

const initialData: SignatureData = {
  name: "",
  designation: "",
  workPhone: "",
  personalPhone: "",
  medium: "",
  linkedin: "",
};

export default function App() {
  const [data, setData] = useState<SignatureData>(initialData);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {/* Ambient glow */}
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            zIndex: 0,
            background: `
              radial-gradient(ellipse at 15% 40%, rgba(255, 115, 0, 0.07) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 70%, rgba(255, 115, 0, 0.05) 0%, transparent 55%)
            `,
          }}
        />
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Header />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 3,
              maxWidth: 1400,
              mx: "auto",
              px: { xs: 2, md: 4 },
              pb: 8,
              pt: 4,
            }}
          >
            <SignatureForm data={data} onChange={setData} />
            <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 }, alignSelf: "start" }}>
              <SignaturePreview data={data} />
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
