import { describe, it, expect, afterEach } from "vitest";
import { getAppConfig } from "../config";

describe("getAppConfig", () => {
  afterEach(() => {
    delete (window as any).config;
  });

  it("throws when window.config is not defined", () => {
    expect(() => getAppConfig()).toThrow(
      "window.config is not defined. Ensure /config.js is loaded before the app bundle."
    );
  });

  it("returns the config when window.config is set", () => {
    (window as any).config = {
      ASGARDEO_BASE_URL: "https://api.asgardeo.io/t/wso2",
      AUTH_SIGN_IN_REDIRECT_URL: "http://localhost:3000",
      AUTH_SIGN_OUT_REDIRECT_URL: "http://localhost:3000",
      ASGARDEO_CLIENT_ID: "test-client-id",
    };
    const cfg = getAppConfig();
    expect(cfg.ASGARDEO_CLIENT_ID).toBe("test-client-id");
    expect(cfg.ASGARDEO_BASE_URL).toBe("https://api.asgardeo.io/t/wso2");
  });
});
