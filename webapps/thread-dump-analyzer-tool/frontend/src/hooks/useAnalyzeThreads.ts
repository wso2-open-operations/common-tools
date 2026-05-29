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

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@asgardeo/auth-react";
import { uploadThreadDumps, getJobStatus } from "@api/analyze";
import { useAnalysisData } from "@context/AnalysisContext";
import type { JobInitResponse } from "@/types/api";

export const useAnalyzeThreads = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const { setAnalysisData } = useAnalysisData();
  const { getAccessToken } = useAuthContext();

  const mutation = useMutation<JobInitResponse, Error, { dumps: File[]; usages: File[] }>({
    mutationFn: ({ dumps, usages }) => uploadThreadDumps(dumps, usages, getAccessToken),
    onSuccess: ({ job_id }) => {
      console.info("[TDAT] analysis job submitted", { jobId: job_id });
      setJobId(job_id);
    },
    onError: (err) => {
      console.error("[TDAT] analysis job submission failed", err);
    },
  });

  // Poll job status every 3s; dynamic refetchInterval returns false when job reaches terminal state, stopping polls.
  const query = useQuery({
    queryKey: ["jobStatus", jobId],
    queryFn: () => getJobStatus(jobId!, getAccessToken),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 3000;
    },
  });

  useEffect(() => {
    if (query.error) {
      console.error("[TDAT] job status poll error", { jobId, error: query.error });
    }
  }, [query.error, jobId]);

  useEffect(() => {
    if (query.data?.status === "completed" && query.data.result) {
      console.info("[TDAT] analysis job completed", { jobId, threads: query.data.result.threads?.length ?? 0, errors: query.data.result.errors?.length ?? 0 });
      setAnalysisData(query.data.result);
      setJobId(null);
    }
    if (query.data?.status === "failed") {
      console.error("[TDAT] analysis job reported failed status", { jobId });
      setJobId(null);
    }
  }, [query.data]);

  return { mutation, query };
};
