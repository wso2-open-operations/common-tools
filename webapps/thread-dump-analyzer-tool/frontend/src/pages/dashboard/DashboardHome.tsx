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

import React, { useState, useMemo, useEffect } from 'react';
import { Box, Grid, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalysisData } from '@context/AnalysisContext';
import type { Thread, ThreadSnapshot, AiInsights } from '@/types/api';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import { STATE_ORDER, stateColors } from './constants';
import type { DashboardSummary, ThreadCluster, LongRunningThread, HighCpuThread } from './types';
import {
    type FindingSeverity,
    SEVERITY_ORDER,
    categorizeIssue,
    CRITICAL_RISK_FALLBACK,
} from '../../utils/ruleCategories';
import SummaryCards from './components/SummaryCards';
import StateDistributionCard from './components/StateDistributionCard';
import KeyFindingsCard from './components/KeyFindingsCard';
import ThreadActivityCard from './components/ThreadActivityCard';
import AiInsightsCard from './components/AiInsightsCard';
import ExecutiveSummaryCard from './components/ExecutiveSummaryCard';

// Helpers

// Extracts the first stack frame (blocking point) to cluster threads blocked on the same operation.
function getClusterKey(stackTrace: string[]): string {
    for (const line of stackTrace) {
        const trimmed = line.trim();
        if (trimmed.startsWith('at ')) return trimmed.substring(3).trim();
    }
    return stackTrace[0]?.trim() || 'Unknown';
}

// Component

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
    const aiInsights: AiInsights | undefined = data?.ai_insights;

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

    // Latest snapshot per thread (for summary cards) from the latest dump
    const latestSnapshots = useMemo((): ThreadSnapshot[] => {
        if (dumpNames.length === 0) return [];
        const latestDump = dumpNames[dumpNames.length - 1];
        return threads
            .map(t => t.snapshots.find(s => s.dump_name === latestDump))
            .filter((s): s is ThreadSnapshot => s !== undefined);
    }, [threads, dumpNames]);

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

    const keyFindings = useMemo(() => {
        type FindingItem = { label: string; description: string; severity: FindingSeverity; affectedThreads: string[] };
        const buckets = new Map<string, FindingItem>();

        threads.forEach(t => {
            const seen = new Set<string>();
            let matchedCritical = false;
            t.snapshots.forEach(s => {
                (s.issues ?? []).forEach(issue => {
                    const cat = categorizeIssue(issue);
                    if (!cat || seen.has(cat.label)) return;
                    seen.add(cat.label);
                    if (cat.severity === 'critical') matchedCritical = true;

                    let bucket = buckets.get(cat.label);
                    if (!bucket) {
                        bucket = { label: cat.label, description: cat.description, severity: cat.severity, affectedThreads: [] };
                        buckets.set(cat.label, bucket);
                    }
                    bucket.affectedThreads.push(t.name);
                });
            });

            // Surface CRITICAL-risk threads that didn't match any specific critical rule,
            // so the Key Findings "Critical Risk" band always reflects the Critical Issues stat.
            if (!matchedCritical && t.snapshots.some(s => s.risk_level === 'CRITICAL')) {
                const { label, description, severity } = CRITICAL_RISK_FALLBACK;
                let bucket = buckets.get(label);
                if (!bucket) {
                    bucket = { label, description, severity, affectedThreads: [] };
                    buckets.set(label, bucket);
                }
                bucket.affectedThreads.push(t.name);
            }
        });

        return [...buckets.values()].sort((a, b) => {
            const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
            return sev !== 0 ? sev : b.affectedThreads.length - a.affectedThreads.length;
        });
    }, [threads]);

    // Count distinct critical findings (issue categories), not the threads within them.
    const criticalIssues = useMemo((): number =>
        keyFindings.filter(f => f.severity === 'critical').length,
        [keyFindings]
    );

    const summary: DashboardSummary = useMemo(() => ({
        threadCount: latestDumpCount,
        criticalIssues,
        blockedThreads: latestSnapshots.filter(s => s.state === 'BLOCKED').length,
        healthScore: data?.health_score ?? 100,
        healthFactors: data?.health_factors ?? [],
        trendPercent,
    }), [latestSnapshots, latestDumpCount, trendPercent, criticalIssues, data]);

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

    // Group threads by stack trace to identify common contention patterns.
    // Keep clusters with 2+ threads, sorted by frequency, limited to top 20.
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
                    <AiInsightsCard aiInsights={aiInsights} />
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
