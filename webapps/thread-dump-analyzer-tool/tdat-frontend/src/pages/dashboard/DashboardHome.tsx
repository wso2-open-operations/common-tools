import React, { useState, useMemo, useEffect } from 'react';
import { Box, Grid, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalysisData } from '@context/AnalysisContext';
import type { Thread, ThreadSnapshot, AIInsights } from '@/types/api';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import { STATE_ORDER, stateColors } from './constants';
import type { DashboardSummary, ThreadCluster, LongRunningThread, HighCpuThread } from './types';
import SummaryCards from './components/SummaryCards';
import StateDistributionCard from './components/StateDistributionCard';
import KeyFindingsCard from './components/KeyFindingsCard';
import ThreadActivityCard from './components/ThreadActivityCard';
import AIInsightsCard from './components/AIInsightsCard';
import ExecutiveSummaryCard from './components/ExecutiveSummaryCard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHealthScore(snapshots: ThreadSnapshot[]): number {
    if (snapshots.length === 0) return 100;
    const total = snapshots.length;
    const blocked = snapshots.filter(s => s.state === 'BLOCKED').length;
    const waiting = snapshots.filter(s => s.state === 'WAITING').length;
    const timedWaiting = snapshots.filter(s => s.state === 'TIMED_WAITING').length;
    const penalty = (blocked / total) * 50 + (waiting / total) * 15 + (timedWaiting / total) * 5;
    return Math.max(0, Math.round(100 - penalty));
}

function getClusterKey(stackTrace: string[]): string {
    for (const line of stackTrace) {
        const trimmed = line.trim();
        if (trimmed.startsWith('at ')) return trimmed.substring(3).trim();
    }
    return stackTrace[0]?.trim() || 'Unknown';
}

// ─── Component ────────────────────────────────────────────────────────────────

const DashboardHome: React.FC = () => {
    const { data } = useAnalysisData();
    const theme = useTheme();
    const navigate = useNavigate();
    const navigateToThread = useNavigateToThread();
    const [selectedDump, setSelectedDump] = useState<string>('');
    const [activityTab, setActivityTab] = useState(0);

    const handleBlockedClick = () => {
        navigate('/thread-explorer', { state: { stateFilter: 'BLOCKED' } });
    };

    const threads: Thread[] = data?.threads ?? [];
    const aiInsights: AIInsights | undefined = data?.ai_insights;

    // Unique dump names, sorted naturally
    const dumpNames = useMemo(() => {
        const names = new Set<string>();
        threads.forEach(t => t.snapshots.forEach(s => names.add(s.dump_name)));
        return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [threads]);

    useEffect(() => {
        if (dumpNames.length > 0 && !dumpNames.includes(selectedDump)) {
            setSelectedDump(dumpNames[0]);
        }
    }, [dumpNames, selectedDump]);

    // Latest snapshot per thread (for summary cards)
    const latestSnapshots = useMemo((): ThreadSnapshot[] =>
        threads.flatMap(t => t.snapshots.length > 0 ? [t.snapshots[t.snapshots.length - 1]] : []),
        [threads]
    );

    const latestDumpCount = useMemo((): number => {
        if (dumpNames.length === 0) return 0;
        const lastDump = dumpNames[dumpNames.length - 1];
        return threads.filter(t => t.snapshots.some(s => s.dump_name === lastDump)).length;
    }, [threads, dumpNames]);

    const trendPercent = useMemo((): number | null => {
        if (dumpNames.length < 2) return null;
        const prev = dumpNames[dumpNames.length - 2];
        const curr = dumpNames[dumpNames.length - 1];
        const prevCount = threads.filter(t => t.snapshots.some(s => s.dump_name === prev)).length;
        const currCount = threads.filter(t => t.snapshots.some(s => s.dump_name === curr)).length;
        if (prevCount === 0) return null;
        return parseFloat(((currCount - prevCount) / prevCount * 100).toFixed(1));
    }, [threads, dumpNames]);

    const criticalIssues = useMemo((): number =>
        threads.filter(t => t.snapshots.some(s => s.risk_level === 'CRITICAL')).length,
        [threads]
    );

    const summary: DashboardSummary = useMemo(() => ({
        threadCount: latestDumpCount,
        criticalIssues,
        blockedThreads: latestSnapshots.filter(s => s.state === 'BLOCKED').length,
        healthScore: computeHealthScore(latestSnapshots),
        trendPercent,
    }), [latestSnapshots, latestDumpCount, trendPercent, criticalIssues]);

    // Snapshots for the currently selected dump
    const selectedSnapshots = useMemo((): Array<{ thread: Thread; snapshot: ThreadSnapshot }> => {
        const effectiveDump = dumpNames.includes(selectedDump) ? selectedDump : dumpNames[0] ?? '';
        const result: Array<{ thread: Thread; snapshot: ThreadSnapshot }> = [];
        threads.forEach(t => {
            const snap = t.snapshots.find(s => s.dump_name === effectiveDump);
            if (snap) result.push({ thread: t, snapshot: snap });
        });
        return result;
    }, [threads, selectedDump, dumpNames]);

    const stateDistribution = useMemo((): Record<string, number> => {
        const counts: Record<string, number> = {};
        selectedSnapshots.forEach(({ snapshot }) => {
            const state = snapshot.state?.trim() || 'N/A';
            counts[state] = (counts[state] ?? 0) + 1;
        });
        return counts;
    }, [selectedSnapshots]);

    const colors = useMemo(() => stateColors(theme), [theme]);
    const pieData = useMemo(() =>
        STATE_ORDER
            .filter(s => (stateDistribution[s] ?? 0) > 0)
            .map((s, idx) => ({ id: idx, value: stateDistribution[s] ?? 0, color: colors[s], label: s })),
        [stateDistribution, colors]
    );

    const longRunningThreads = useMemo((): LongRunningThread[] =>
        [...selectedSnapshots]
            .filter(({ snapshot }) => snapshot.elapsed_time_s > 0)
            .sort((a, b) => b.snapshot.elapsed_time_s - a.snapshot.elapsed_time_s)
            .slice(0, 25)
            .map(({ thread, snapshot }) => ({
                threadName: thread.name,
                state: snapshot.state?.trim() || 'N/A',
                elapsedSeconds: snapshot.elapsed_time_s,
            })),
        [selectedSnapshots]
    );

    const highCpuThreads = useMemo((): HighCpuThread[] =>
        [...selectedSnapshots]
            .filter(({ snapshot }) => snapshot.cpu_percent > 0)
            .sort((a, b) => b.snapshot.cpu_percent - a.snapshot.cpu_percent)
            .slice(0, 25)
            .map(({ thread, snapshot }) => ({
                threadName: thread.name,
                state: snapshot.state?.trim() || 'N/A',
                cpuPercent: snapshot.cpu_percent,
                cpuTimeMs: snapshot.cpu_time_ms,
            })),
        [selectedSnapshots]
    );

    const threadClusters = useMemo((): ThreadCluster[] => {
        const clusterMap = new Map<string, Array<{ thread: Thread; snapshot: ThreadSnapshot }>>();
        selectedSnapshots.forEach(({ thread, snapshot }) => {
            const key = getClusterKey(snapshot.stack_trace);
            if (!clusterMap.has(key)) clusterMap.set(key, []);
            clusterMap.get(key)!.push({ thread, snapshot });
        });
        return [...clusterMap.entries()]
            .map(([key, items]) => {
                const stateCounts: Record<string, number> = {};
                items.forEach(({ snapshot }) => {
                    const st = snapshot.state?.trim() || 'N/A';
                    stateCounts[st] = (stateCounts[st] ?? 0) + 1;
                });
                const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
                return { clusterName: key, count: items.length, dominantState, threadNames: items.map(i => i.thread.name) };
            })
            .filter(c => c.count > 1)
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }, [selectedSnapshots]);

    const keyFindings = useMemo(() => {
        type FindingItem = { label: string; description: string; severity: 'critical' | 'high' | 'medium' | 'info'; affectedThreads: string[] };
        const findings: FindingItem[] = [];

        const deadlocked = threads.filter(t => t.snapshots.some(s => s.issues?.some(i => i.toLowerCase().includes('deadlock'))));
        if (deadlocked.length > 0) findings.push({ label: 'Deadlock Detected', description: 'Threads are permanently blocked waiting on each other\'s locks. The JVM cannot self-recover — a restart is likely required.', severity: 'critical', affectedThreads: deadlocked.map(t => t.name) });

        const deadlockedSet = new Set(deadlocked.map(t => t.name));
        const critical = threads.filter(t => !deadlockedSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'CRITICAL'));
        if (critical.length > 0) findings.push({ label: 'Critical Risk', description: 'Threads flagged at the highest severity — extreme CPU consumption, sudden blockage spikes, or stuck I/O threads causing active service degradation.', severity: 'critical', affectedThreads: critical.map(t => t.name) });

        const criticalSet = new Set([...deadlocked, ...critical].map(t => t.name));
        const high = threads.filter(t => !criticalSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'HIGH'));
        if (high.length > 0) findings.push({ label: 'High Risk', description: 'Threads with significant performance issues such as prolonged lock waits, database/JDBC stalls, HTTP worker saturation, or GC pressure.', severity: 'high', affectedThreads: high.map(t => t.name) });

        if (dumpNames.length > 0) {
            const lastDump = dumpNames[dumpNames.length - 1];
            const blocked = threads.filter(t => {
                const snap = t.snapshots.find(s => s.dump_name === lastDump);
                return snap?.state === 'BLOCKED' && !criticalSet.has(t.name) && !high.map(x => x.name).includes(t.name);
            });
            if (blocked.length > 0) findings.push({ label: 'Blocked Threads', description: 'Threads waiting to acquire a monitor lock currently held by another thread in the latest snapshot. Indicates contention on a shared resource.', severity: 'medium', affectedThreads: blocked.map(t => t.name) });
        }

        return findings;
    }, [threads, dumpNames]);

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 2000, mx: 'auto' }}>
            <Grid container spacing={3}>

                {/* Row 1: Top Stat Cards */}
                <Grid size={{ xs: 12 }}>
                    <SummaryCards summary={summary} onBlockedClick={handleBlockedClick} />
                </Grid>

                {/* Row 2: Left main content */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Grid container spacing={3}>

                        {/* Layer 1: Pie chart + Executive Summary */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <StateDistributionCard
                                dumpNames={dumpNames}
                                selectedDump={selectedDump}
                                onDumpChange={setSelectedDump}
                                pieData={pieData}
                                stateDistribution={stateDistribution}
                                totalSelectedThreads={selectedSnapshots.length}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <ExecutiveSummaryCard aiInsights={aiInsights} />
                        </Grid>

                        {/* Layer 2: Key Findings full-width */}
                        <Grid size={{ xs: 12 }}>
                            <KeyFindingsCard keyFindings={keyFindings} onThreadClick={navigateToThread} />
                        </Grid>

                    </Grid>
                </Grid>

                {/* Row 2: Right sidebar */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <AIInsightsCard aiInsights={aiInsights} />
                </Grid>

                {/* Row 3: Tabbed data tables (full width) */}
                <Grid size={{ xs: 12 }}>
                    <ThreadActivityCard
                        threadClusters={threadClusters}
                        longRunningThreads={longRunningThreads}
                        highCpuThreads={highCpuThreads}
                        onThreadClick={navigateToThread}
                        activityTab={activityTab}
                        onTabChange={setActivityTab}
                    />
                </Grid>

            </Grid>
        </Box>
    );
};

export default DashboardHome;
