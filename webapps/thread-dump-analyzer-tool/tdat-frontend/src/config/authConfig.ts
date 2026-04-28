// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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

import type { BaseURLAuthClientConfig } from "@asgardeo/auth-react";

const authConfig: BaseURLAuthClientConfig = {
    signInRedirectURL: window.location.origin,
    signOutRedirectURL: window.location.origin,
    clientID: window.configs?.ASGARDEO_CLIENT_ID ?? import.meta.env.VITE_ASGARDEO_CLIENT_ID ?? "",
    baseUrl: window.configs?.ASGARDEO_BASE_URL ?? import.meta.env.VITE_ASGARDEO_BASE_URL ?? "",
    scope: ["openid", "email", "profile"],
};

export default authConfig;
