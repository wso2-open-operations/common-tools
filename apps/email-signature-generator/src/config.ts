export interface AppConfig {
  ASGARDEO_BASE_URL: string;
  AUTH_SIGN_IN_REDIRECT_URL: string;
  AUTH_SIGN_OUT_REDIRECT_URL: string;
  ASGARDEO_CLIENT_ID: string;
}

export function getAppConfig(): AppConfig {
  const cfg = (window as Window & { config?: AppConfig }).config;
  if (!cfg) {
    throw new Error(
      "window.config is not defined. Ensure /config.js is loaded before the app bundle."
    );
  }
  return cfg;
}
