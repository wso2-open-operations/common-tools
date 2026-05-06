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

import type { Thread, ThreadSnapshot } from '@/types/api';
import { type LockType, findWaitingLock, findHeldLocks } from './lockParsing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlockedThreadInfo {
    thread: Thread;
    snapshot: ThreadSnapshot;
    lockAddress: string;
    waitTime: string;
    waitTimeMs: number;
}

export interface LockWithBlockedThreads {
    address: string;
    className: string;
    lockType: LockType;
    blockedThreads: BlockedThreadInfo[];
}

export interface LockOwnerEntry {
    thread: Thread;
    snapshot: ThreadSnapshot;
    heldLocks: LockWithBlockedThreads[];
    totalBlocked: number;
}

export interface OrphanedLock {
    address: string;
    className: string;
    lockType: LockType;
    blockedThreads: BlockedThreadInfo[];
}

export interface DeadlockCycle {
    threads: Array<{
        thread: Thread;
        snapshot: ThreadSnapshot;
        waitingOnAddress: string;
        lockClassName: string;
    }>;
}

export interface LockOwnerCentricData {
    lockOwners: LockOwnerEntry[];
    orphanedLocks: OrphanedLock[];
    deadlocks: DeadlockCycle[];
}

// ─── Deadlock Detection ───────────────────────────────────────────────────────

function detectDeadlocks(
    waitGraph: Map<string, string>,
    holderGraph: Map<string, string>,
    latestByThreadId: Map<string, { thread: Thread; snapshot: ThreadSnapshot }>,
    waitingByLock: Map<string, { className: string; lockType: LockType; blockedThreads: BlockedThreadInfo[] }>,
): DeadlockCycle[] {
    const threadWaitsFor = new Map<string, string>();
    for (const [waitingThreadId, lockAddress] of waitGraph.entries()) {
        const holderId = holderGraph.get(lockAddress);
        if (holderId && holderId !== waitingThreadId) {
            threadWaitsFor.set(waitingThreadId, holderId);
        }
    }

    const state = new Map<string, 'unvisited' | 'in-stack' | 'done'>();
    for (const id of threadWaitsFor.keys()) state.set(id, 'unvisited');

    const cycles: string[][] = [];
    const cycleSignatures = new Set<string>();

    function dfs(path: string[]): void {
        const current = path[path.length - 1];
        state.set(current, 'in-stack');

        const next = threadWaitsFor.get(current);
        if (next !== undefined) {
            if (state.get(next) === 'in-stack') {
                const cycleStart = path.indexOf(next);
                if (cycleStart !== -1) {
                    const cycle = path.slice(cycleStart);
                    const sorted = [...cycle].sort();
                    const minIdx = cycle.indexOf(sorted[0]);
                    const canonical = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
                    const sig = canonical.join('->');
                    if (!cycleSignatures.has(sig)) {
                        cycleSignatures.add(sig);
                        cycles.push(canonical);
                    }
                }
            } else if (state.get(next) === 'unvisited') {
                dfs([...path, next]);
            }
        }

        state.set(current, 'done');
    }

    for (const id of threadWaitsFor.keys()) {
        if (state.get(id) === 'unvisited') dfs([id]);
    }

    return cycles.map(cycle => ({
        threads: cycle.map(threadId => {
            const entry = latestByThreadId.get(threadId)!;
            const lockAddress = waitGraph.get(threadId)!;
            const lockData = waitingByLock.get(lockAddress);
            return {
                thread: entry.thread,
                snapshot: entry.snapshot,
                waitingOnAddress: lockAddress,
                lockClassName: lockData?.className ?? lockAddress,
            };
        }),
    }));
}

// ─── Main Derivation ──────────────────────────────────────────────────────────

export function deriveLockOwnerCentricData(threads: Thread[]): LockOwnerCentricData {
    if (!threads || threads.length === 0) return { lockOwners: [], orphanedLocks: [], deadlocks: [] };

    const latestByThreadId = new Map<string, { thread: Thread; snapshot: ThreadSnapshot }>();
    for (const thread of threads) {
        if (thread.snapshots.length > 0) {
            latestByThreadId.set(thread.id, {
                thread,
                snapshot: thread.snapshots[thread.snapshots.length - 1],
            });
        }
    }

    const waitingByLock = new Map<string, { className: string; lockType: LockType; blockedThreads: BlockedThreadInfo[] }>();
    const holdingByLock = new Map<string, { thread: Thread; snapshot: ThreadSnapshot }>();
    const waitGraph = new Map<string, string>();
    const holderGraph = new Map<string, string>();

    for (const { thread, snapshot } of latestByThreadId.values()) {
        if (['BLOCKED', 'WAITING', 'TIMED_WAITING'].includes(snapshot.state)) {
            const waitLock = findWaitingLock(snapshot.stack_trace);
            if (waitLock) {
                if (!waitingByLock.has(waitLock.address)) {
                    waitingByLock.set(waitLock.address, { className: waitLock.className, lockType: waitLock.lockType, blockedThreads: [] });
                }
                const waitTimeMs = snapshot.elapsed_time_s > 0 ? Math.round(snapshot.elapsed_time_s * 1000) : 0;
                const waitTime = waitTimeMs > 0 ? `${waitTimeMs} ms` : '';
                waitingByLock.get(waitLock.address)!.blockedThreads.push({ thread, snapshot, lockAddress: waitLock.address, waitTime, waitTimeMs });
                waitGraph.set(thread.id, waitLock.address);
            }
        }

        for (const held of findHeldLocks(snapshot.stack_trace)) {
            if (!holdingByLock.has(held.address)) {
                holdingByLock.set(held.address, { thread, snapshot });
                holderGraph.set(held.address, thread.id);
            }
        }
    }

    const lockOwnerMap = new Map<string, LockOwnerEntry>();
    for (const { thread, snapshot } of latestByThreadId.values()) {
        const locksWithBlocked: LockWithBlockedThreads[] = [];
        for (const held of findHeldLocks(snapshot.stack_trace)) {
            const waiting = waitingByLock.get(held.address);
            if (waiting) {
                locksWithBlocked.push({
                    address: held.address,
                    className: waiting.className,
                    lockType: waiting.lockType,
                    blockedThreads: waiting.blockedThreads,
                });
            }
        }
        if (locksWithBlocked.length > 0) {
            const totalBlocked = locksWithBlocked.reduce((sum, lb) => sum + lb.blockedThreads.length, 0);
            lockOwnerMap.set(thread.id, { thread, snapshot, heldLocks: locksWithBlocked, totalBlocked });
        }
    }

    const lockOwners = [...lockOwnerMap.values()].sort((a, b) => b.totalBlocked - a.totalBlocked);

    const orphanedLocks: OrphanedLock[] = [];
    for (const [address, data] of waitingByLock.entries()) {
        if (!holdingByLock.has(address)) {
            orphanedLocks.push({ address, className: data.className, lockType: data.lockType, blockedThreads: data.blockedThreads });
        }
    }

    const deadlocks = detectDeadlocks(waitGraph, holderGraph, latestByThreadId, waitingByLock);

    return { lockOwners, orphanedLocks, deadlocks };
}
