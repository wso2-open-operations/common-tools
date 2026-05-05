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

import type { JobInitResponse, JobStatusResponse } from "@/types/api";

const apiUrl = String(window?.configs?.apiUrl || "");
const API_BASE_URL = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

type TokenGetter = () => Promise<string>;

const authHeader = async (getAccessToken: TokenGetter): Promise<HeadersInit> => {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}` };
};

export const uploadThreadDumps = async (
  dumps: File[],
  usages: File[],
  getAccessToken: TokenGetter
): Promise<JobInitResponse> => {
  const formData = new FormData();

  dumps.forEach((file) => {
    formData.append("thread_dumps", file);
  });

  usages.forEach((file) => {
    formData.append("thread_usages", file);
  });

  const response = await fetch(`${API_BASE_URL}/api/v1/analyze/jobs`, {
    method: "POST",
    body: formData,
    headers: await authHeader(getAccessToken),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};

export const getJobStatus = async (
  jobId: string,
  getAccessToken: TokenGetter
): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze/jobs/${jobId}`, {
    headers: await authHeader(getAccessToken),
  });

  if (!response.ok) {
    throw new Error(`Job status check failed: ${response.statusText}`);
  }

  return response.json();
};
