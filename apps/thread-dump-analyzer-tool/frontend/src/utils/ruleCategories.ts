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

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface RuleCategory {
    test: RegExp;
    label: string;
    description: string;
    severity: FindingSeverity;
}

// Maps backend Grule issue strings (from rules.grl) to dashboard-friendly titles, descriptions, and severities.
// Order matters: first match wins, so place more specific patterns above generic fallbacks.
export const RULE_CATEGORIES: RuleCategory[] = [
    { test: /deadlock/i, label: 'Deadlock Detected', description: 'Threads are permanently blocked in a monitor lock cycle. The JVM cannot self-recover; a restart is likely required.', severity: 'critical' },
    { test: /runaway cpu/i, label: 'Runaway CPU Threads', description: 'Threads are consuming an entire CPU core (≥100%). Likely an infinite loop or runaway computation.', severity: 'critical' },
    { test: /thread starvation/i, label: 'Thread Starvation', description: 'A single thread is consuming >95% CPU, starving all other threads of scheduling time.', severity: 'critical' },
    { test: /pool exhaustion|stuck waiting for a database connection/i, label: 'Database Connection Pool Exhaustion', description: 'Threads are stuck waiting for a JDBC connection from an exhausted pool. Increase maxActive, shorten queries, or fix connection leaks.', severity: 'critical' },
    { test: /passthrough http worker.*backend i\/o/i, label: 'PassThrough Backend I/O Stall', description: 'WSO2 PassThrough HTTP workers are blocked on slow or unresponsive backend services. Investigate backend latency and connection timeouts.', severity: 'critical' },
    { test: /passthrough.*stuck on network i\/o/i, label: 'PassThrough Network I/O Stall', description: 'WSO2 PassThrough I/O threads are stuck in network read/write with 0% CPU. Indicates a slow client or slow backend.', severity: 'critical' },
    { test: /sudden blockage spike/i, label: 'Sudden Blockage Spike', description: 'Blocked thread percentage jumped sharply between dumps; a new contention hotspot has emerged.', severity: 'critical' },
    { test: /critical lock contention/i, label: 'Critical Lock Contention', description: '20+ threads are serialized behind the same monitor lock; a transport-level throughput failure.', severity: 'critical' },
    { test: /catastrophic thread leak/i, label: 'Catastrophic Thread Leak', description: 'JVM hosts 5000+ live threads. Each is a GC root, causing sustained high CPU from GC overhead even when threads are idle.', severity: 'critical' },
    { test: /thread blocked for > 10s/i, label: 'Prolonged Blocked Threads', description: 'Threads have been BLOCKED for over 10 seconds, waiting on a monitor lock held by another thread.', severity: 'high' },
    { test: /sustained high cpu/i, label: 'Sustained High CPU Usage', description: 'Threads are consuming >30% CPU; investigate for heavy computation, large data parsing, or tight loops.', severity: 'high' },
    { test: /database\/jdbc operations/i, label: 'Database/JDBC Stalls', description: 'Threads have been executing JDBC/SQL operations for >5 seconds. Check for slow queries, missing indexes, or pool exhaustion.', severity: 'high' },
    { test: /worker thread pool member/i, label: 'Thread Pool Saturation Warning', description: 'Worker threads are stuck; if multiple threads exhibit this, the thread pool will saturate and reject new requests.', severity: 'high' },
    { test: /heavy mediation/i, label: 'Heavy Mediation on I/O Thread', description: 'WSO2 PassThrough I/O threads are doing heavy XSLT/Script work that should be offloaded to SynapseWorker threads.', severity: 'high' },
    { test: /system-wide blockage/i, label: 'System-Wide Blockage', description: 'Over 25% of all threads are BLOCKED. Locate the root lock holder and investigate immediately.', severity: 'high' },
    { test: /gc activity detected/i, label: 'GC Pause Activity', description: 'Threads are parked or waiting due to JVM garbage collection. Tune heap size, or consider switching to G1GC or ZGC.', severity: 'high' },
    { test: /long monitor wait/i, label: 'Prolonged Lock Waits', description: 'Threads have been waiting to acquire a specific monitor lock for over 10 seconds.', severity: 'high' },
    { test: /high lock contention/i, label: 'High Lock Contention', description: '3 or more threads are competing for the same monitor lock. Reduce synchronization scope or use concurrent data structures.', severity: 'high' },
    { test: /timer\/scheduler blocked/i, label: 'Timer/Scheduler Blocked', description: 'A scheduler thread cannot acquire a lock; scheduled jobs may be missed or delayed.', severity: 'high' },
    { test: /ldap\/active directory/i, label: 'LDAP/User Store Timeouts', description: 'Threads are delayed by slow LDAP/Active Directory user store responses. Check LDAP server health and connection timeouts.', severity: 'high' },
    { test: /oauth2 token/i, label: 'OAuth2 Token Bottleneck', description: 'Threads are stuck inside OAuth2 token validation or issuance flows. Check token persistence DB and cache hit rates.', severity: 'high' },
    { test: /http thread bottleneck/i, label: 'HTTP Request Bottleneck', description: 'Tomcat HTTP/HTTPS workers have been active or blocked for over 5 seconds; thread pool may be nearing saturation.', severity: 'high' },
    { test: /hazelcast/i, label: 'Distributed Cache Contention', description: 'Threads are blocked on Hazelcast distributed cache synchronization. Check cluster health and hot keys.', severity: 'high' },
    { test: /blocked waiting for a monitor lock/i, label: 'Severe Lock Contention', description: 'Threads are BLOCKED waiting for a monitor lock. Identify the holder and inspect its stack to determine why the lock is held.', severity: 'high' },
    { test: /recursive lock contention/i, label: 'Recursive Lock Contention', description: 'Threads acquire the same lock more than once in their own call stack; re-entrant or nested locking.', severity: 'medium' },
    { test: /native thread issue/i, label: 'Native/Socket Block', description: 'Threads are RUNNABLE with 0% CPU; likely blocked inside a native or socket call.', severity: 'medium' },
    { test: /thread leak suspected/i, label: 'Thread Leak Suspected', description: 'Thread count is growing consistently between dumps. Investigate unclosed ExecutorServices or unbounded thread pools.', severity: 'medium' },
    { test: /long idle duration/i, label: 'Long Idle Threads', description: 'Threads have been WAITING or TIMED_WAITING for over 10 seconds. Check for abandoned work or unresponsive external resources.', severity: 'medium' },
    { test: /standalone thread/i, label: 'Standalone Threads', description: 'Threads do not belong to any configured thread pool; informational classification only.', severity: 'info' },
];

export const SEVERITY_ORDER: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

export function categorizeIssue(issue: string): RuleCategory | null {
    for (const cat of RULE_CATEGORIES) if (cat.test.test(issue)) return cat;
    return null;
}

export const CRITICAL_RISK_FALLBACK = {
    label: 'Critical Risk Threads',
    description: 'Threads flagged as CRITICAL risk by the analysis engine. Open in Thread Explorer to inspect the stack trace and recommendation.',
    severity: 'critical' as FindingSeverity,
};
