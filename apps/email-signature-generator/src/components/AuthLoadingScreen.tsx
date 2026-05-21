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
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import wso2Logo from "../assets/wso2-logo-white.png";

interface Props {
  error?: Error | null;
  onRetry?: () => void;
}

export default function AuthLoadingScreen({ error, onRetry }: Props) {
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
          bgcolor: "background.default",
        }}
      >
        <Box
          component="img"
          src={wso2Logo}
          alt="WSO2"
          sx={{ width: 120, mb: 1 }}
        />
        {error ? (
          <>
            <Typography sx={{ fontSize: "13px", fontWeight: 500, color: "error.main" }}>
              Sign-in failed. Please try again.
            </Typography>
            {onRetry && (
              <Button
                variant="contained"
                size="large"
                onClick={onRetry}
                sx={{
                  mt: 1,
                  bgcolor: "#f14e23",
                  "&:hover": { bgcolor: "#c93d1b" },
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "1rem",
                }}
              >
                Retry sign-in
              </Button>
            )}
          </>
        ) : (
          <>
            <LinearProgress
              sx={{
                width: 150,
                borderRadius: 1,
                "& .MuiLinearProgress-bar": { bgcolor: "#f14e23" },
                bgcolor: "#1e1e1e",
              }}
            />
            <Typography sx={{ fontSize: "13px", fontWeight: 500, color: "text.secondary" }}>
              Getting things ready...
            </Typography>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
}
