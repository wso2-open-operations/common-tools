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

export interface AIInsights {
  executive_summary: string;
  pattern_recognition: string;
  recommended_actions: string;
}

export interface JobInitResponse {
  job_id: string;
}

export interface JobStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AnalysisResponse;
}

export interface AnalysisResponse {
  session_id: string;
  timestamp: string;
  threads: Thread[];
  thread_pools?: Record<string, ThreadPoolInfo>;
  ai_insights?: AIInsights;
  errors?: string[];
}