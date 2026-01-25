import { useMutation } from "@tanstack/react-query";
import { uploadThreadDumps } from "../api/analyze";
import type { AnalysisResponse } from "../types/api";

export const useAnalyzeThreads = () => {
  return useMutation<AnalysisResponse, Error, { dumps: File[]; usages: File[] }>({
    mutationFn: ({ dumps, usages }) => uploadThreadDumps(dumps, usages),
  });
};