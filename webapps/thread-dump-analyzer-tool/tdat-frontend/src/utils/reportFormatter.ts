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

import type { AnalysisResponse, Thread, ThreadSnapshot, AIInsights } from '@/types/api';
import { deriveCulpritCentricData } from './lockContentionAnalysis';

const LINE_WIDTH = 80;
const DIVIDER = '='.repeat(LINE_WIDTH);

// ─── Helpers ────────────────────────────────────────────────────────────────

function centerText(text: string, width: number = LINE_WIDTH): string {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
}

function kvLine(key: string, value: string | number, keyWidth: number = 22): string {
    return `  ${String(key + ':').padEnd(keyWidth)} ${value}`;
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
}

function sectionHeader(title: string): string {
    return `${DIVIDER}
  ${title}
${DIVIDER}`;
}

function formatDuration(seconds: number): string {
    if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
    if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
    return `${seconds.toFixed(1)}s`;
}

function formatWaitTime(ms: number): string {
    if (ms >= 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

function waitSeverityTag(ms: number): string {
    if (ms >= 60_000) return '[CRITICAL]';
    if (ms >= 10_000) return '[HIGH]';
    if (ms >= 1_000) return '[WARN]';
    return '[OK]';
}

// ─── Table Generator ────────────────────────────────────────────────────────

interface TableColumn {
    header: string;
    maxWidth?: number;
    align?: 'left' | 'right';
}

function formatTable(columns: TableColumn[], rows: string[][]): string {
    if (rows.length === 0) return '  (none)\n';

    const widths = columns.map((col, i) => {
        const contentMax = Math.max(
            col.header.length,
            ...rows.map(row => (row[i] ?? '').length),
        );
        return col.maxWidth ? Math.min(contentMax, col.maxWidth) : contentMax;
    });

    const border = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

    const fmtRow = (cells: string[]): string => {
        const formatted = cells.map((cell, i) => {
            const t = truncate(cell, widths[i]);
            return columns[i].align === 'right'
                ? t.padStart(widths[i])
                : t.padEnd(widths[i]);
        });
        return '| ' + formatted.join(' | ') + ' |';
    };

    return [
        border,
        fmtRow(columns.map(c => c.header)),
        border,
        ...rows.map(row => fmtRow(row)),
        border,
    ].join('\n') + '\n';
}

// ─── Computation (mirrors DashboardHome) ────────────────────────────────────

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

function getLatestDumpSnapshots(threads: Thread[]): Array<{ thread: Thread; snapshot: ThreadSnapshot }> {
    const dumpNames = new Set<string>();
    threads.forEach(t => t.snapshots.forEach(s => dumpNames.add(s.dump_name)));
    const sorted = [...dumpNames].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const latestDump = sorted[sorted.length - 1] ?? '';

    const result: Array<{ thread: Thread; snapshot: ThreadSnapshot }> = [];
    threads.forEach(t => {
        const snap = t.snapshots.find(s => s.dump_name === latestDump);
        if (snap) result.push({ thread: t, snapshot: snap });
    });
    return result;
}

function getDumpNames(threads: Thread[]): string[] {
    const names = new Set<string>();
    threads.forEach(t => t.snapshots.forEach(s => names.add(s.dump_name)));
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// ─── Section Formatters ─────────────────────────────────────────────────────

function formatHeader(sessionId: string, timestamp: string): string {
    return [
        DIVIDER,
        centerText('THREAD DUMP ANALYSIS REPORT'),
        DIVIDER,
        `  Generated:   ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
        `  Session:     ${sessionId}`,
        `  Snapshot:    ${timestamp}`,
    ].join('\n');
}

function formatExecutiveSummary(aiInsights?: AIInsights): string {
    const header = sectionHeader('EXECUTIVE SUMMARY');
    const body = aiInsights?.executive_summary?.trim()
        || 'No executive summary available.';
    return `${header}

${body}`;
}

function formatMetrics(
    threadCount: number,
    healthScore: number,
    blockedCount: number,
    criticalCount: number,
    deadlockCycles: number,
    maxWaitTimeMs: number,
    stateDistribution: Record<string, number>,
): string {
    const header = sectionHeader('METRICS');
    const lines = [
        kvLine('Total Threads', threadCount),
        kvLine('Health Score', `${healthScore} / 100`),
        kvLine('Blocked Threads', blockedCount > 0 ? `${blockedCount}  ⚠` : String(blockedCount)),
        kvLine('Deadlock Cycles', deadlockCycles > 0 ? `${deadlockCycles}  ⚠` : String(deadlockCycles)),
        kvLine('CRITICAL Risk Threads', criticalCount > 0 ? `${criticalCount}  ⚠` : String(criticalCount)),
        ...(maxWaitTimeMs > 0 ? [kvLine('Max Wait Time', `${formatWaitTime(maxWaitTimeMs)}  ${waitSeverityTag(maxWaitTimeMs)}`)] : []),
        '',
        '  State Distribution:',
        ...Object.entries(stateDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([state, count]) =>
                `    ${state.padEnd(18)} ${String(count).padStart(5)}  (${((count / threadCount) * 100).toFixed(1)}%)`,
            ),
    ];
    return `${header}

${lines.join('\n')}`;
}

function formatKeyFindings(threads: Thread[], dumpNames: string[]): string {
    const header = sectionHeader('KEY FINDINGS');

    type Finding = { severity: string; label: string; description: string; affected: string[] };
    const findings: Finding[] = [];

    const deadlocked = threads.filter(t =>
        t.snapshots.some(s => s.issues?.some(i => i.toLowerCase().includes('deadlock'))),
    );
    if (deadlocked.length > 0) {
        findings.push({
            severity: 'CRITICAL',
            label: 'Deadlock Detected',
            description: 'Threads are permanently blocked waiting on each other\'s locks. The JVM cannot self-recover — a restart is likely required.',
            affected: deadlocked.map(t => t.name),
        });
    }

    const deadlockedSet = new Set(deadlocked.map(t => t.name));
    const critical = threads.filter(t =>
        !deadlockedSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'CRITICAL'),
    );
    if (critical.length > 0) {
        findings.push({
            severity: 'CRITICAL',
            label: 'Critical Risk',
            description: 'Threads flagged at the highest severity — extreme CPU consumption, sudden blockage spikes, or stuck I/O threads causing active service degradation.',
            affected: critical.map(t => t.name),
        });
    }

    const criticalSet = new Set([...deadlocked, ...critical].map(t => t.name));
    const high = threads.filter(t =>
        !criticalSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'HIGH'),
    );
    if (high.length > 0) {
        findings.push({
            severity: 'WARNING',
            label: 'High Risk',
            description: 'Threads with significant performance issues such as prolonged lock waits, database/JDBC stalls, HTTP worker saturation, or GC pressure.',
            affected: high.map(t => t.name),
        });
    }

    if (dumpNames.length > 0) {
        const lastDump = dumpNames[dumpNames.length - 1];
        const blocked = threads.filter(t => {
            const snap = t.snapshots.find(s => s.dump_name === lastDump);
            return snap?.state === 'BLOCKED' && !criticalSet.has(t.name) && !high.some(x => x.name === t.name);
        });
        if (blocked.length > 0) {
            findings.push({
                severity: 'WARNING',
                label: 'Blocked Threads',
                description: 'Threads waiting to acquire a monitor lock currently held by another thread in the latest snapshot. Indicates contention on a shared resource.',
                affected: blocked.map(t => t.name),
            });
        }
    }

    if (findings.length === 0) {
        return `${header}

  No critical findings detected.`;
    }

    const body = findings.map(f => {
        const affectedPreview = f.affected.slice(0, 5).join(', ');
        const overflow = f.affected.length > 5 ? `, ... +${f.affected.length - 5} more` : '';
        return [
            `  [${f.severity}] ${f.label}`,
            `    ${f.description}`,
            `    Affected (${f.affected.length}): ${affectedPreview}${overflow}`,
        ].join('\n');
    }).join('\n\n');

    return `${header}

${body}`;
}

function formatAIInsights(aiInsights?: AIInsights): string {
    const header = sectionHeader('AI INSIGHTS');

    const pattern = aiInsights?.pattern_recognition?.trim()
        ? `  --- Pattern Recognition ---

${aiInsights.pattern_recognition.trim()}`
        : '  --- Pattern Recognition ---\n\n  No specific patterns detected.';

    const actions = aiInsights?.recommended_actions?.trim()
        ? `  --- Recommended Actions ---

${aiInsights.recommended_actions.trim()}`
        : '  --- Recommended Actions ---\n\n  No specific recommendations available.';

    return `${header}

${pattern}

${actions}`;
}

function formatThreadClusters(
    snapshots: Array<{ thread: Thread; snapshot: ThreadSnapshot }>,
): string {
    const header = sectionHeader('THREAD CLUSTERS');

    const clusterMap = new Map<string, Array<{ thread: Thread; snapshot: ThreadSnapshot }>>();
    snapshots.forEach(({ thread, snapshot }) => {
        const key = getClusterKey(snapshot.stack_trace);
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        clusterMap.get(key)!.push({ thread, snapshot });
    });

    const clusters = [...clusterMap.entries()]
        .map(([key, items]) => {
            const stateCounts: Record<string, number> = {};
            items.forEach(({ snapshot }) => {
                const st = snapshot.state?.trim() || 'N/A';
                stateCounts[st] = (stateCounts[st] ?? 0) + 1;
            });
            const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
            return { clusterName: key, count: items.length, dominantState };
        })
        .filter(c => c.count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const columns: TableColumn[] = [
        { header: '#', maxWidth: 4, align: 'right' },
        { header: 'Count', maxWidth: 6, align: 'right' },
        { header: 'Cluster', maxWidth: 48 },
        { header: 'State', maxWidth: 14 },
    ];

    const rows = clusters.map((c, i) => [
        String(i + 1),
        String(c.count),
        c.clusterName,
        c.dominantState,
    ]);

    return `${header}

${formatTable(columns, rows)}`;
}

function formatLongRunning(
    snapshots: Array<{ thread: Thread; snapshot: ThreadSnapshot }>,
): string {
    const header = sectionHeader('LONG-RUNNING THREADS');

    const longRunning = [...snapshots]
        .filter(({ snapshot }) => snapshot.elapsed_time_s > 0)
        .sort((a, b) => b.snapshot.elapsed_time_s - a.snapshot.elapsed_time_s)
        .slice(0, 25);

    const columns: TableColumn[] = [
        { header: '#', maxWidth: 4, align: 'right' },
        { header: 'Thread Name', maxWidth: 42 },
        { header: 'State', maxWidth: 14 },
        { header: 'Duration', maxWidth: 10, align: 'right' },
    ];

    const rows = longRunning.map(({ thread, snapshot }, i) => [
        String(i + 1),
        thread.name,
        snapshot.state?.trim() || 'N/A',
        formatDuration(snapshot.elapsed_time_s),
    ]);

    return `${header}

${formatTable(columns, rows)}`;
}

function formatHighCpu(
    snapshots: Array<{ thread: Thread; snapshot: ThreadSnapshot }>,
): string {
    const header = sectionHeader('HIGH CPU THREADS');

    const highCpu = [...snapshots]
        .filter(({ snapshot }) => snapshot.cpu_percent > 0)
        .sort((a, b) => b.snapshot.cpu_percent - a.snapshot.cpu_percent)
        .slice(0, 25);

    const columns: TableColumn[] = [
        { header: '#', maxWidth: 4, align: 'right' },
        { header: 'Thread Name', maxWidth: 42 },
        { header: 'State', maxWidth: 14 },
        { header: 'CPU %', maxWidth: 8, align: 'right' },
        { header: 'CPU Time', maxWidth: 10, align: 'right' },
    ];

    const rows = highCpu.map(({ thread, snapshot }, i) => [
        String(i + 1),
        thread.name,
        snapshot.state?.trim() || 'N/A',
        `${snapshot.cpu_percent.toFixed(1)}%`,
        `${snapshot.cpu_time_ms}ms`,
    ]);

    return `${header}

${formatTable(columns, rows)}`;
}

function formatLockContention(threads: Thread[]): string {
    const header = sectionHeader('LOCK CONTENTION');
    const { culprits, orphanedLocks, deadlocks } = deriveCulpritCentricData(threads);

    if (culprits.length === 0 && orphanedLocks.length === 0 && deadlocks.length === 0) {
        return `${header}

  No lock contention detected.`;
    }

    const sections: string[] = [];

    // Deadlocks
    if (deadlocks.length > 0) {
        sections.push(`  [CRITICAL] ${deadlocks.length} Deadlock Cycle${deadlocks.length !== 1 ? 's' : ''} Detected`);
        deadlocks.forEach((cycle, i) => {
            sections.push(`
  Cycle ${i + 1}:`);
            cycle.threads.forEach(t => {
                sections.push(`    "${t.thread.name}" waiting on <${t.waitingOnAddress}> (${t.lockClassName})`);
            });
        });
        sections.push('');
    }

    // Lock Owners
    const totalBlocked = culprits.reduce((acc, c) => acc + c.totalVictims, 0);
    sections.push(`  --- Lock Owners (${culprits.length} owner${culprits.length !== 1 ? 's' : ''}, ${totalBlocked} blocked) ---`);

    if (culprits.length === 0) {
        sections.push('\n  No lock owners identified.');
    } else {
        culprits.forEach(entry => {
            sections.push(`
  Owner: "${truncate(entry.thread.name, 60)}" [${entry.snapshot.state}]`);
            sections.push(`    Holding ${entry.heldLocks.length} monitor${entry.heldLocks.length !== 1 ? 's' : ''}, blocking ${entry.totalVictims} thread${entry.totalVictims !== 1 ? 's' : ''}`);
            entry.heldLocks.forEach(lock => {
                const shortName = lock.className.split('.').pop() ?? lock.className;
                sections.push(`
    Monitor: ${shortName} <${lock.address}>`);
                lock.victims.forEach(v => {
                    const waitStr = v.waitTimeMs > 0
                        ? `  wait: ${formatWaitTime(v.waitTimeMs)} ${waitSeverityTag(v.waitTimeMs)}`
                        : '';
                    sections.push(`      - ${truncate(v.thread.name, 50)} [${v.snapshot.state}]${waitStr}`);
                });
            });
        });
    }

    // Unowned Monitors
    if (orphanedLocks.length > 0) {
        sections.push('');
        sections.push(`  --- Unowned Monitors (${orphanedLocks.length}) ---`);
        sections.push('  Monitors with blocked threads but no owner thread visible in this snapshot.');

        orphanedLocks.forEach(lock => {
            const shortName = lock.className.split('.').pop() ?? lock.className;
            sections.push(`
  Monitor: ${shortName} <${lock.address}>`);
            sections.push(`    ${lock.victims.length} blocked thread${lock.victims.length !== 1 ? 's' : ''}:`);
            lock.victims.slice(0, 10).forEach(v => {
                const waitStr = v.waitTimeMs > 0
                    ? `  wait: ${formatWaitTime(v.waitTimeMs)} ${waitSeverityTag(v.waitTimeMs)}`
                    : '';
                sections.push(`      - ${truncate(v.thread.name, 50)} [${v.snapshot.state}]${waitStr}`);
            });
            if (lock.victims.length > 10) {
                sections.push(`      ... +${lock.victims.length - 10} more`);
            }
        });
    }

    return `${header}

${sections.join('\n')}`;
}

function formatFooter(): string {
    return `${DIVIDER}
${centerText('END OF REPORT')}
${DIVIDER}`;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export function generateReport(data: AnalysisResponse): string {
    const threads = data.threads ?? [];
    const aiInsights = data.ai_insights;

    const snapshots = getLatestDumpSnapshots(threads);
    const latestSnapshots = threads.flatMap(t =>
        t.snapshots.length > 0 ? [t.snapshots[t.snapshots.length - 1]] : [],
    );
    const dumpNames = getDumpNames(threads);

    const threadCount = snapshots.length;
    const healthScore = computeHealthScore(latestSnapshots);
    const blockedCount = latestSnapshots.filter(s => s.state === 'BLOCKED').length;
    const criticalCount = threads.filter(t =>
        t.snapshots.some(s => s.risk_level === 'CRITICAL'),
    ).length;

    const { culprits, orphanedLocks, deadlocks } = deriveCulpritCentricData(threads);
    const deadlockCycles = deadlocks.length;

    let maxWaitTimeMs = 0;
    for (const c of culprits) {
        for (const lock of c.heldLocks) {
            for (const v of lock.victims) {
                if (v.waitTimeMs > maxWaitTimeMs) maxWaitTimeMs = v.waitTimeMs;
            }
        }
    }
    for (const o of orphanedLocks) {
        for (const v of o.victims) {
            if (v.waitTimeMs > maxWaitTimeMs) maxWaitTimeMs = v.waitTimeMs;
        }
    }

    const stateDistribution: Record<string, number> = {};
    snapshots.forEach(({ snapshot }) => {
        const state = snapshot.state?.trim() || 'N/A';
        stateDistribution[state] = (stateDistribution[state] ?? 0) + 1;
    });

    return [
        formatHeader(data.session_id, data.timestamp),
        formatExecutiveSummary(aiInsights),
        formatMetrics(threadCount, healthScore, blockedCount, criticalCount, deadlockCycles, maxWaitTimeMs, stateDistribution),
        formatKeyFindings(threads, dumpNames),
        formatAIInsights(aiInsights),
        formatThreadClusters(snapshots),
        formatLongRunning(snapshots),
        formatHighCpu(snapshots),
        formatLockContention(threads),
        formatFooter(),
    ].join('\n\n');
}
