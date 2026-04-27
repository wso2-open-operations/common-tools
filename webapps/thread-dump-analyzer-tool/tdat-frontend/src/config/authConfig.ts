import type { BaseURLAuthClientConfig } from "@asgardeo/auth-react";

const authConfig: BaseURLAuthClientConfig = {
    signInRedirectURL: window.location.origin,
    signOutRedirectURL: window.location.origin,
    clientID: window.configs?.ASGARDEO_CLIENT_ID ?? import.meta.env.VITE_ASGARDEO_CLIENT_ID ?? "",
    baseUrl: window.configs?.ASGARDEO_BASE_URL ?? import.meta.env.VITE_ASGARDEO_BASE_URL ?? "",
    scope: ["openid", "email", "profile"],
};

export default authConfig;