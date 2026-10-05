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

import { createOxygenTheme, ClassicTheme } from "@wso2/oxygen-ui";

// Light-only: this dashboard runs unattended on a TV and must never switch
// to dark mode. ClassicTheme (our base) ships its own "dark" colorScheme,
// and MUI's CssVarsProvider defaults to following the OS/browser preference
// - so declaring only "light" here left that inherited dark scheme reachable
// whenever the TV's browser reported prefers-color-scheme: dark. Defining
// "dark" as an exact copy of "light" closes that gap: there is nothing left
// to switch to that looks any different.
// WSO2 brand orange - matches Oxygen UI's own ClassicTheme default.
const palette = {
  primary: { main: "#ff7300" },
  success: { main: "#1f7a4d" },
  warning: { main: "#9a6b0c" },
  error: { main: "#c0392b" },
  background: {
    default: "#f5f5f4",
    paper: "#ffffff",
  },
  text: {
    primary: "#20211f",
    secondary: "#5c5d59",
  },
};

export const dashboardTheme = createOxygenTheme(
  {
    colorSchemes: {
      light: { palette },
      dark: { palette },
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    },
    shape: {
      borderRadius: 16,
    },
  },
  ClassicTheme
);
