import type { AnalysisResponse } from "../types/api";

const API_URL = "http://localhost:8080";
// const API_URL = "https://bcd36238-7e1c-4241-afe5-380ccefd764b-dev.e1-us-east-azure.choreoapis.dev/thread-dump-analyzer/tdat-backend/v1.0";
// const API_URL = import.meta.env.VITE_API_BASE_URL;

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

  const response = await fetch(`${API_URL}/parse`, {
    method: "POST",
    body: formData, 
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};