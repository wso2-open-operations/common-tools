// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

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
            border: "0.75px solid #f14e23",
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
