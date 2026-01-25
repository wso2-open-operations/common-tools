export interface ThreadSnapshot {
  dump_name: string;
  state: string;
  stack_trace: string[];
  elapsed_time_s: number;
  cpu_time_ms: number;
  cpu_percent: number;
}

export interface Thread {
  id: string;
  name: string;
  native_id: number;
  thread_pool: string;
  snapshots: ThreadSnapshot[];
}

export interface AnalysisResponse {
  session_id: string;
  timestamp: string;
  threads: Thread[];
  errors?: string[];
}