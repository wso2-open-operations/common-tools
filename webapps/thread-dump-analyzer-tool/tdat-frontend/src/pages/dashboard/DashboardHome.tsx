// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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

// Helpers

type FindingSeverity = 'critical' | 'high' | 'medium' | 'info';

interface RuleCategory {
    test: RegExp;
    label: string;
    description: string;
    severity: FindingSeverity;
}

// Maps backend Grule issue strings (from rules.grl) to dashboard-friendly titles, descriptions, and severities. 
// Order matters - first match wins, so place more specific patterns above generic fallbacks.
const RULE_CATEGORIES: RuleCategory[] = [
    { test: /deadlock/i, label: 'Deadlock Detected', description: 'Threads are permanently blocked in a monitor lock cycle. The JVM cannot self-recover — a restart is likely required.', severity: 'critical' },
    { test: /runaway cpu/i, label: 'Runaway CPU Threads', description: 'Threads are consuming an entire CPU core (≥100%). Likely an infinite loop or runaway computation.', severity: 'critical' },
    { test: /thread starvation/i, label: 'Thread Starvation', description: 'A single thread is consuming >95% CPU, starving all other threads of scheduling time.', severity: 'critical' },
    { test: /pool exhaustion|stuck waiting for a database connection/i, label: 'Database Connection Pool Exhaustion', description: 'Threads are stuck waiting for a JDBC connection from an exhausted pool. Increase maxActive, shorten queries, or fix connection leaks.', severity: 'critical' },
    { test: /passthrough http worker.*backend i\/o/i, label: 'PassThrough Backend I/O Stall', description: 'WSO2 PassThrough HTTP workers are blocked on slow or unresponsive backend services. Investigate backend latency and connection timeouts.', severity: 'critical' },
    { test: /passthrough.*stuck on network i\/o/i, label: 'PassThrough Network I/O Stall', description: 'WSO2 PassThrough I/O threads are stuck in network read/write with 0% CPU. Indicates a slow client or slow backend.', severity: 'critical' },
    { test: /sudden blockage spike/i, label: 'Sudden Blockage Spike', description: 'Blocked thread percentage jumped sharply between dumps — a new contention hotspot has emerged.', severity: 'critical' },
    { test: /critical lock contention/i, label: 'Critical Lock Contention', description: '20+ threads are serialized behind the same monitor lock — a transport-level throughput failure.', severity: 'critical' },
    { test: /catastrophic thread leak/i, label: 'Catastrophic Thread Leak', description: 'JVM hosts 5000+ live threads. Each is a GC root, causing sustained high CPU from GC overhead even when threads are idle.', severity: 'critical' },
    { test: /thread blocked for > 10s/i, label: 'Prolonged Blocked Threads', description: 'Threads have been BLOCKED for over 10 seconds, waiting on a monitor lock held by another thread.', severity: 'high' },
    { test: /sustained high cpu/i, label: 'Sustained High CPU Usage', description: 'Threads are consuming >30% CPU — investigate for heavy computation, large data parsing, or tight loops.', severity: 'high' },
    { test: /database\/jdbc operations/i, label: 'Database/JDBC Stalls', description: 'Threads have been executing JDBC/SQL operations for >5 seconds. Check for slow queries, missing indexes, or pool exhaustion.', severity: 'high' },
    { test: /worker thread pool member/i, label: 'Thread Pool Saturation Warning', description: 'Worker threads are stuck — if multiple threads exhibit this, the thread pool will saturate and reject new requests.', severity: 'high' },
    { test: /heavy mediation/i, label: 'Heavy Mediation on I/O Thread', description: 'WSO2 PassThrough I/O threads are doing heavy XSLT/Script work that should be offloaded to SynapseWorker threads.', severity: 'high' },
    { test: /system-wide blockage/i, label: 'System-Wide Blockage', description: 'Over 25% of all threads are BLOCKED. Locate the root lock holder and investigate immediately.', severity: 'high' },
    { test: /gc activity detected/i, label: 'GC Pause Activity', description: 'Threads are parked or waiting due to JVM garbage collection. Tune heap size, or consider switching to G1GC or ZGC.', severity: 'high' },
    { test: /long monitor wait/i, label: 'Prolonged Lock Waits', description: 'Threads have been waiting to acquire a specific monitor lock for over 10 seconds.', severity: 'high' },
    { test: /high lock contention/i, label: 'High Lock Contention', description: '3 or more threads are competing for the same monitor lock. Reduce synchronization scope or use concurrent data structures.', severity: 'high' },
    { test: /timer\/scheduler blocked/i, label: 'Timer/Scheduler Blocked', description: 'A scheduler thread cannot acquire a lock — scheduled jobs may be missed or delayed.', severity: 'high' },
    { test: /ldap\/active directory/i, label: 'LDAP/User Store Timeouts', description: 'Threads are delayed by slow LDAP/Active Directory user store responses. Check LDAP server health and connection timeouts.', severity: 'high' },
    { test: /oauth2 token/i, label: 'OAuth2 Token Bottleneck', description: 'Threads are stuck inside OAuth2 token validation or issuance flows. Check token persistence DB and cache hit rates.', severity: 'high' },
    { test: /http thread bottleneck/i, label: 'HTTP Request Bottleneck', description: 'Tomcat HTTP/HTTPS workers have been active or blocked for over 5 seconds — thread pool may be nearing saturation.', severity: 'high' },
    { test: /hazelcast/i, label: 'Distributed Cache Contention', description: 'Threads are blocked on Hazelcast distributed cache synchronization. Check cluster health and hot keys.', severity: 'high' },
    { test: /blocked waiting for a monitor lock/i, label: 'Severe Lock Contention', description: 'Threads are BLOCKED waiting for a monitor lock. Identify the holder and inspect its stack to determine why the lock is held.', severity: 'high' },
    { test: /recursive lock contention/i, label: 'Recursive Lock Contention', description: 'Threads acquire the same lock more than once in their own call stack — re-entrant or nested locking.', severity: 'medium' },
    { test: /native thread issue/i, label: 'Native/Socket Block', description: 'Threads are RUNNABLE with 0% CPU — likely blocked inside a native or socket call.', severity: 'medium' },
    { test: /thread leak suspected/i, label: 'Thread Leak Suspected', description: 'Thread count is growing consistently between dumps. Investigate unclosed ExecutorServices or unbounded thread pools.', severity: 'medium' },
    { test: /long idle duration/i, label: 'Long Idle Threads', description: 'Threads have been WAITING or TIMED_WAITING for over 10 seconds. Check for abandoned work or unresponsive external resources.', severity: 'medium' },
    { test: /standalone thread/i, label: 'Standalone Threads', description: 'Threads do not belong to any configured thread pool — informational classification only.', severity: 'info' },
];

const SEVERITY_ORDER: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

function categorizeIssue(issue: string): RuleCategory | null {
    for (const cat of RULE_CATEGORIES) if (cat.test.test(issue)) return cat;
    return null;
}

function computeHealthScore(snapshots: ThreadSnapshot[]): number {
    if (snapshots.length === 0) return 100;
    const total = snapshots.length;
    const blocked = snapshots.filter(s => s.state === 'BLOCKED').length;
    const waiting = snapshots.filter(s => s.state === 'WAITING').length;
    const timedWaiting = snapshots.filter(s => s.state === 'TIMED_WAITING').length;
    const penalty = (blocked / total) * 50 + (waiting / total) * 15 + (timedWaiting / total) * 5;
    return Math.max(0, Math.round(100 - penalty));
}

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
                const label = 'Critical Risk Threads';
                let bucket = buckets.get(label);
                if (!bucket) {
                    bucket = {
                        label,
                        description: 'Threads flagged as CRITICAL risk by the analysis engine. Open in Thread Explorer to inspect the stack trace and recommendation.',
                        severity: 'critical',
                        affectedThreads: [],
                    };
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