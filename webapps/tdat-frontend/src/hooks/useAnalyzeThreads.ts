import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { uploadThreadDumps, getJobStatus } from "@api/analyze";
import { useAnalysisData } from "@context/AnalysisContext";
import type { JobInitResponse } from "@/types/api";

export const useAnalyzeThreads = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const { setAnalysisData } = useAnalysisData();

  const mutation = useMutation<JobInitResponse, Error, { dumps: File[]; usages: File[] }>({
    mutationFn: ({ dumps, usages }) => uploadThreadDumps(dumps, usages),
    onSuccess: ({ job_id }) => setJobId(job_id),
  });

  const query = useQuery({
    queryKey: ["jobStatus", jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 3000;
    },
  });

  useEffect(() => {
    if (query.data?.status === "completed" && query.data.result) {
      setAnalysisData(query.data.result);
      setJobId(null);
    }
  }, [query.data]);

  return { mutation, query };
};