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

export interface ThreadSnapshot {
  dump_name: string;
  state: string;
  stack_trace: string[];
  elapsed_time_s: number;
  cpu_time_ms: number;
  cpu_percent: number;
  risk_level?: string;
  issues?: string[];
  recommendation?: string;
}

export interface Thread {
  id: string;
  name: string;
  native_id: number;
  thread_pool: string;
  snapshots: ThreadSnapshot[];
}

export interface ThreadPoolInfo {
  description: string;
  expected_behavior: string;
}

export interface AiInsights {
  executive_summary: string;
  pattern_recognition: string;
  recommended_actions: string;
}

export interface JobInitResponse {
  job_id: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  created_at?: string;
  updated_at?: string;
  result?: AnalysisResponse;
  error?: string;
}

export interface HealthFactor {
  label: string;
  penalty: number;
}

export interface AnalysisResponse {
  session_id: string;
  timestamp: string;
  threads: Thread[];
  thread_pools?: Record<string, ThreadPoolInfo>;
  health_score: number;
  health_factors?: HealthFactor[];
  ai_insights?: AiInsights;
  errors?: string[];
}
