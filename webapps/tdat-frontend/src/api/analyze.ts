import type { AnalysisResponse } from "../types/api";

// Read Configurations
const apiUrl = String(window?.configs?.apiUrl || "");
const API_BASE_URL = apiUrl.endsWith("/")
  ? apiUrl.slice(0, -1)
  : apiUrl;

export const uploadThreadDumps = async (
  dumps: File[],
  usages: File[]
): Promise<AnalysisResponse> => {

  const formData = new FormData();

  // Append all thread dumps
  dumps.forEach((file) => {
    formData.append("thread_dumps", file);
  });

  // Append all usage files
  usages.forEach((file) => {
    formData.append("thread_usages", file);
  });

  const response = await fetch(`${API_BASE_URL}/parse`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};