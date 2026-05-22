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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/analyze/jobs`, {
      method: "POST",
      body: formData,
      headers: await authHeader(getAccessToken),
    });
  } catch {
    // fetch() rejects only on network-level failure; the gateway timing out a slow upload lands here.
    throw new Error(
      "Network error while uploading. The upload may have been cut off by the server or gateway — try again, or upload fewer/smaller files at once."
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(`Upload failed (HTTP ${response.status}): ${detail}`);
  }

  return response.json();
};

export const getJobStatus = async (
  jobId: string,
  getAccessToken: TokenGetter
): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/analyze/jobs/${jobId}`, {
    headers: await authHeader(getAccessToken),
  });

  if (!response.ok) {
    throw new Error(`Job status check failed: ${response.statusText}`);
  }

  return response.json();
};
