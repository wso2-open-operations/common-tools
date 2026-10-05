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

declare global {
  interface Window {
    config?: {
      WASTE_DASHBOARD_BACKEND_BASE_URL?: string;
    };
  }
}

export interface ApiConfig {
  backendUrl: string;
  configError: string | null;
}

const MISSING_CONFIG_ERROR =
  "Missing required configuration: WASTE_DASHBOARD_BACKEND_BASE_URL. " +
  "Copy public/config.js.example to public/config.js and set it.";

// Reads window.config rather than throwing, so a missing/misconfigured
// config.js surfaces as a renderable error state (see App.tsx) instead of
// failing module evaluation before React ever mounts the error boundary.
export function getApiConfig(): ApiConfig {
  const backendUrl = window.config?.WASTE_DASHBOARD_BACKEND_BASE_URL;
  if (!backendUrl) {
    return { backendUrl: "", configError: MISSING_CONFIG_ERROR };
  }
  return { backendUrl, configError: null };
}

// Frozen at module load; import getApiConfig() directly if you ever need
// to react to a runtime config change instead.
export const apiConfig: ApiConfig = getApiConfig();
export const BACKEND_BASE_URL = apiConfig.backendUrl;
