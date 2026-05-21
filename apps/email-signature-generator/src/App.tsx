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
import CircularProgress from "@mui/material/CircularProgress";
import { ThemeProvider } from "@mui/material/styles";
import { useAuthContext } from "@asgardeo/auth-react";
import { useEffect, useState } from "react";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
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
  const { state, getBasicUserInfo } = useAuthContext();
  const [data, setData] = useState<SignatureData>(initialData);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!state.isAuthenticated) return;
    getBasicUserInfo()
      .then((userInfo) => {
        if (userInfo.displayName) {
          setDisplayName(userInfo.displayName);
          setData((prev) => ({ ...prev, name: userInfo.displayName! }));
        }
      })
      .catch(() => {});
  }, [state.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
          }}
        >
          <CircularProgress sx={{ color: "#f14e23" }} />
        </Box>
      </ThemeProvider>
    );
  }

  if (!state.isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Box>
          <Header displayName={displayName} />
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
            <Box
              sx={{
                position: { lg: "sticky" },
                top: { lg: 24 },
                alignSelf: "start",
              }}
            >
              <SignaturePreview data={data} />
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
