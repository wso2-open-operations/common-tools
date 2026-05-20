import { AuthProvider } from "@asgardeo/auth-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getAppConfig } from "./config";
import "./index.css";

const cfg = getAppConfig();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider
      config={{
        clientID: cfg.ASGARDEO_CLIENT_ID,
        baseUrl: cfg.ASGARDEO_BASE_URL,
        signInRedirectURL: cfg.AUTH_SIGN_IN_REDIRECT_URL,
        signOutRedirectURL: cfg.AUTH_SIGN_OUT_REDIRECT_URL,
        scope: ["openid", "profile"],
        disableTrySignInSilently: true,
      }}
    >
      <App />
    </AuthProvider>
  </StrictMode>
);
