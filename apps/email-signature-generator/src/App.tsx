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
import { ThemeProvider } from "@mui/material/styles";
import { useAuthContext } from "@asgardeo/auth-react";
import { useEffect, useRef, useState } from "react";
import AuthLoadingScreen from "./components/AuthLoadingScreen";
import Header from "./components/Header";
import SignatureForm from "./components/SignatureForm";
import SignaturePreview from "./components/SignaturePreview";
import { theme } from "./theme";
import type { SignatureData } from "./types";

interface IDTokenClaims {
  jobtitle?: string;
}

const initialData: SignatureData = {
  name: "",
  designation: "",
  workPhone: "",
  personalPhone: "",
  medium: "",
  linkedin: "",
  customUrl: "",
  customUrlLabel: "",
};

export default function App() {
  const { state, getBasicUserInfo, getDecodedIDToken, signIn } = useAuthContext();
  const [data, setData] = useState<SignatureData>(initialData);
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState<Error | null>(null);
  const signInTriggered = useRef(false);

  useEffect(() => {
    if (!state.isLoading && !state.isAuthenticated && !signInTriggered.current) {
      signInTriggered.current = true;
      signIn().catch((err: Error) => {
        console.error("Asgardeo signIn failed", err);
        setAuthError(err);
        signInTriggered.current = false;
      });
    }
  }, [state.isLoading, state.isAuthenticated]); // signIn is a stable identity from auth context

  useEffect(() => {
    if (!state.isAuthenticated) return;
    Promise.allSettled([getBasicUserInfo(), getDecodedIDToken()])
      .then(([userInfoResult, idTokenResult]) => {
        const name =
          userInfoResult.status === "fulfilled"
            ? (userInfoResult.value.displayName ?? "")
            : "";
        const jobTitle =
          idTokenResult.status === "fulfilled"
            ? ((idTokenResult.value as IDTokenClaims).jobtitle ?? "")
            : "";
        if (name) setDisplayName(name);
        setData((prev) => ({ ...prev, name, designation: jobTitle }));
      })
      .catch((err: Error) => {
        console.error("Failed to load user profile", err);
      });
  }, [state.isAuthenticated]); // getBasicUserInfo and getDecodedIDToken are stable identities

  if (!state.isAuthenticated) {
    return (
      <AuthLoadingScreen
        error={authError}
        onRetry={() => {
          setAuthError(null);
          signInTriggered.current = false;
          signIn().catch((err: Error) => {
            console.error("Asgardeo signIn failed", err);
            setAuthError(err);
          });
        }}
      />
    );
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
