export interface DashboardSummary {
    threadCount: number;
    criticalIssues: number;
    blockedThreads: number;
    healthScore: number;
    trendPercent: number | null;
}

export interface ThreadCluster {
    clusterName: string;
    count: number;
    dominantState: string;
    threadNames: string[];
}

export interface LongRunningThread {
    threadName: string;
    state: string;
    elapsedSeconds: number;
}

export interface HighCpuThread {
    threadName: string;
    state: string;
    cpuPercent: number;
    cpuTimeMs: number;
}
