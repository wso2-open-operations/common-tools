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
  const required: (keyof AppConfig)[] = [
    "ASGARDEO_BASE_URL",
    "AUTH_SIGN_IN_REDIRECT_URL",
    "AUTH_SIGN_OUT_REDIRECT_URL",
    "ASGARDEO_CLIENT_ID",
  ];
  for (const key of required) {
    if (!cfg[key]) {
      throw new Error(`window.config.${key} is missing or empty. Check /config.js.`);
    }
  }
  return cfg;
}
