import type { AnalysisResponse } from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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