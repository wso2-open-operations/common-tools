import type { AnalysisResponse } from "../types/api";

const API_URL = "http://localhost:8080";

export const uploadThreadDumps = async (
  dumps: File[], 
  usages: File[]
): Promise<AnalysisResponse> => {
  const formData = new FormData();

  // Append all dump files
  dumps.forEach((file) => {
    formData.append("thread_dumps", file);
  });

  // Append all usage files (logic in Go relies on array index order)
  usages.forEach((file) => {
    formData.append("thread_usages", file);
  });

  const response = await fetch(`${API_URL}/parse`, {
    method: "POST",
    body: formData, 
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};