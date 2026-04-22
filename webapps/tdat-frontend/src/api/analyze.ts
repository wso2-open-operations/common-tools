import type { JobInitResponse, JobStatusResponse } from "@/types/api";

const apiUrl = String(window?.configs?.apiUrl || "");
const API_BASE_URL = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

export const uploadThreadDumps = async (
  dumps: File[],
  usages: File[]
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
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};

export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error(`Job status check failed: ${response.statusText}`);
  }

  return response.json();
};