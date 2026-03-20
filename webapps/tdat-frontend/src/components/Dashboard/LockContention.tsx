import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Chip, Alert, AlertTitle,
    Divider, Button, Tooltip, Container, Stack,
    Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import { useAnalysisData } from '../../context/AnalysisContext';
import type { Thread, ThreadSnapshot } from '../../types/api';
import noData from '../../assets/error.svg';

// ─── Types ────────────────────────────────────────────────────────────────────

type LockType = 'OBJECT_MONITOR' | 'JUC_LOCK' | 'WAIT_SET';

interface LockRef {
    address: string;
    className: string;
    lockType: LockType;
}

interface BlockedThreadInfo {
    thread: Thread;
    snapshot: ThreadSnapshot;
    lockAddress: string;
    waitTime: string;
}

interface LockWithVictims {
    address: string;
    className: string;
    lockType: LockType;
    victims: BlockedThreadInfo[];
}

interface CulpritEntry {
    thread: Thread;
    snapshot: ThreadSnapshot;
    heldLocks: LockWithVictims[];
    totalVictims: number;
}

interface OrphanedLock {
    address: string;
    className: string;
    lockType: LockType;
    victims: BlockedThreadInfo[];
}

interface DeadlockCycle {
    threads: Array<{
        thread: Thread;
        snapshot: ThreadSnapshot;
        waitingOnAddress: string;
        lockClassName: string;
    }>;
}

interface CulpritCentricData {
    culprits: CulpritEntry[];
    orphanedLocks: OrphanedLock[];
    deadlocks: DeadlockCycle[];
}

// Regex 

const LOCK_WAITING_REGEX = /[-\s]waiting to lock\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const LOCK_HOLDING_REGEX = /[-\s]locked\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const PARKING_REGEX = /[-\s]parking to wait for\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const WAITING_ON_REGEX = /[-\s]waiting on\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;

// ─── Parsing Utilities ────────────────────────────────────────────────────────

function findWaitingLock(stackTrace: string[]): LockRef | null {
    for (const line of stackTrace) {
        const waitMatch = line.match(LOCK_WAITING_REGEX);
        if (waitMatch) return { address: waitMatch[1], className: waitMatch[2], lockType: 'OBJECT_MONITOR' };

        const parkMatch = line.match(PARKING_REGEX);
        if (parkMatch) return { address: parkMatch[1], className: parkMatch[2], lockType: 'JUC_LOCK' };

        const waitOnMatch = line.match(WAITING_ON_REGEX);
        if (waitOnMatch) return { address: waitOnMatch[1], className: waitOnMatch[2], lockType: 'WAIT_SET' };
    }
    return null;
}

function findHeldLocks(stackTrace: string[]): LockRef[] {
    const locks: LockRef[] = [];
    for (const line of stackTrace) {
        const match = line.match(LOCK_HOLDING_REGEX);
        if (match) locks.push({ address: match[1], className: match[2], lockType: 'OBJECT_MONITOR' });
    }
    return locks;
}

// ─── Deadlock Detection ───────────────────────────────────────────────────────

function detectDeadlocks(
    waitGraph: Map<string, string>,
    holderGraph: Map<string, string>,
    latestByThreadId: Map<string, { thread: Thread; snapshot: ThreadSnapshot }>,
    waitingByLock: Map<string, { className: string; lockType: LockType; victims: BlockedThreadInfo[] }>,
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

function deriveCulpritCentricData(threads: Thread[]): CulpritCentricData {
    if (!threads || threads.length === 0) return { culprits: [], orphanedLocks: [], deadlocks: [] };

    const latestByThreadId = new Map<string, { thread: Thread; snapshot: ThreadSnapshot }>();
    for (const thread of threads) {
        if (thread.snapshots.length > 0) {
            latestByThreadId.set(thread.id, {
                thread,
                snapshot: thread.snapshots[thread.snapshots.length - 1],
            });
        }
    }

    const waitingByLock = new Map<string, { className: string; lockType: LockType; victims: BlockedThreadInfo[] }>();
    const holdingByLock = new Map<string, { thread: Thread; snapshot: ThreadSnapshot }>();
    const waitGraph = new Map<string, string>();
    const holderGraph = new Map<string, string>();

    for (const { thread, snapshot } of latestByThreadId.values()) {
        if (['BLOCKED', 'WAITING', 'TIMED_WAITING'].includes(snapshot.state)) {
            const waitLock = findWaitingLock(snapshot.stack_trace);
            if (waitLock) {
                if (!waitingByLock.has(waitLock.address)) {
                    waitingByLock.set(waitLock.address, { className: waitLock.className, lockType: waitLock.lockType, victims: [] });
                }
                const waitTime = snapshot.elapsed_time_s > 0 ? `${Math.round(snapshot.elapsed_time_s * 1000)} ms` : '';
                waitingByLock.get(waitLock.address)!.victims.push({ thread, snapshot, lockAddress: waitLock.address, waitTime });
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

    const culpritMap = new Map<string, CulpritEntry>();
    for (const { thread, snapshot } of latestByThreadId.values()) {
        const locksWithVictims: LockWithVictims[] = [];
        for (const held of findHeldLocks(snapshot.stack_trace)) {
            const waiting = waitingByLock.get(held.address);
            if (waiting) {
                locksWithVictims.push({
                    address: held.address,
                    className: waiting.className,
                    lockType: waiting.lockType,
                    victims: waiting.victims,
                });
            }
        }
        if (locksWithVictims.length > 0) {
            const totalVictims = locksWithVictims.reduce((sum, lv) => sum + lv.victims.length, 0);
            culpritMap.set(thread.id, { thread, snapshot, heldLocks: locksWithVictims, totalVictims });
        }
    }

    const culprits = [...culpritMap.values()].sort((a, b) => b.totalVictims - a.totalVictims);

    const orphanedLocks: OrphanedLock[] = [];
    for (const [address, data] of waitingByLock.entries()) {
        if (!holdingByLock.has(address)) {
            orphanedLocks.push({ address, className: data.className, lockType: data.lockType, victims: data.victims });
        }
    }

    const deadlocks = detectDeadlocks(waitGraph, holderGraph, latestByThreadId, waitingByLock);

    return { culprits, orphanedLocks, deadlocks };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
        RUNNABLE: { bg: '#e8f5e9', text: '#2e7d32' },
        BLOCKED: { bg: '#ffebee', text: '#c62828' },
        WAITING: { bg: '#fff3e0', text: '#e65100' },
        TIMED_WAITING: { bg: '#fff8e1', text: '#f57f17' },
        NEW: { bg: '#e3f2fd', text: '#1565c0' },
        TERMINATED: { bg: '#f5f5f5', text: '#616161' },
    };
    const c = colorMap[state] || { bg: '#f5f5f5', text: '#616161' };
    return (
        <Chip
            label={state}
            size="small"
            sx={{
                backgroundColor: c.bg,
                color: c.text,
                fontWeight: 700,
                fontSize: '0.65rem',
                height: 22,
                borderRadius: 1,
                letterSpacing: '0.04em',
                flexShrink: 0,
            }}
        />
    );
};

// ─── VictimRow ────────────────────────────────────────────────────────────────

const VictimRow: React.FC<{
    victim: BlockedThreadInfo;
    onThreadClick: (name: string) => void;
}> = ({ victim, onThreadClick }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75 }}>
        <Typography
            variant="body2"
            onClick={() => onThreadClick(victim.thread.name)}
            sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#1565c0',
                cursor: 'pointer',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
            }}
        >
            {victim.thread.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
            <ThreadStateChip state={victim.snapshot.state} />
            {victim.waitTime && (
                <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    Waiting for {victim.waitTime}
                </Typography>
            )}
        </Box>
    </Box>
);

// ─── MonitorSection ───────────────────────────────────────────────────────────

const VICTIM_LIMIT = 5;

const MonitorSection: React.FC<{
    lock: LockWithVictims;
    onThreadClick: (name: string) => void;
}> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - VICTIM_LIMIT;

    return (
        <Box sx={{ mb: 2, border: '1px solid #eeeeee', borderRadius: 1.5, overflow: 'hidden' }}>
            {/* Lock sub-header — grey background band */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 2,
                    py: 0.9,
                    bgcolor: '#f5f5f5',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid #eeeeee',
                }}
            >
                <LockOutlinedIcon sx={{ fontSize: 14, color: '#555', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#333', fontSize: '0.8rem' }}>
                    {shortName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#777', fontSize: '0.73rem' }}>
                    ( {lock.className} )
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#999', fontSize: '0.72rem' }}>
                    &lt;{lock.address}&gt;
                </Typography>
                <Typography variant="caption" sx={{ ml: 'auto', color: '#888', whiteSpace: 'nowrap' }}>
                    {lock.victims.length} thread{lock.victims.length !== 1 ? 's' : ''} blocked on this monitor
                </Typography>
            </Box>

            {/* Victim list */}
            {lock.victims.length === 0 ? (
                <Box sx={{ px: 2, py: 2, bgcolor: '#fafafa', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        No blocked threads recorded for this monitor.
                    </Typography>
                </Box>
            ) : (
                <>
                    {visibleVictims.map((victim, idx) => (
                        <React.Fragment key={victim.thread.id}>
                            {idx > 0 && <Divider />}
                            <VictimRow victim={victim} onThreadClick={onThreadClick} />
                        </React.Fragment>
                    ))}

                    {/* Show all / Show fewer footer strip */}
                    {hiddenCount > 0 && (
                        <>
                            <Divider />
                            <Box sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fafafa' }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setShowAll(v => !v)}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#1565c0' }}
                                >
                                    {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                </Button>
                            </Box>
                        </>
                    )}
                </>
            )}
        </Box>
    );
};

// ─── CulpritAccordion ─────────────────────────────────────────────────────────

const CulpritAccordion: React.FC<{
    entry: CulpritEntry;
    onThreadClick: (name: string) => void;
}> = ({ entry, onThreadClick }) => {
    const monitorCount = entry.heldLocks.length;
    const victimCount = entry.totalVictims;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={{
                mb: 1,
                border: '1px solid #e0e0e0',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1 },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#aaa' }} />}
                sx={{
                    px: 2,
                    minHeight: 48,
                    '& .MuiAccordionSummary-content': {
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        my: 0.75,
                    },
                }}
            >
                {/* Left: thread name + state chip */}
                <Typography
                    variant="body2"
                    onClick={(e) => { e.stopPropagation(); onThreadClick(entry.thread.name); }}
                    sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#1565c0',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '100%', sm: 320, md: 480 },
                    }}
                    title={entry.thread.name}
                >
                    {entry.thread.name}
                </Typography>
                <ThreadStateChip state={entry.snapshot.state} />

                {/* Right: stats */}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#e65100', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        Holding {monitorCount} Monitor{monitorCount !== 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#ccc', mx: 0.25 }}>|</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#c62828', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        Blocking {victimCount} Thread{victimCount !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2, pt: 1.5 }}>
                {entry.heldLocks.map(lock => (
                    <MonitorSection key={lock.address} lock={lock} onThreadClick={onThreadClick} />
                ))}
            </AccordionDetails>
        </Accordion>
    );
};

// ─── OrphanedLockCard ─────────────────────────────────────────────────────────

const ORPHAN_VICTIM_LIMIT = 10;

const OrphanedLockCard: React.FC<{
    lock: OrphanedLock;
    onThreadClick: (name: string) => void;
}> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, ORPHAN_VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - ORPHAN_VICTIM_LIMIT;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={{
                mb: 1,
                border: '1px solid #ffe0b2',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1 },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#e65100' }} />}
                sx={{
                    px: 2,
                    minHeight: 48,
                    '& .MuiAccordionSummary-content': {
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        my: 0.75,
                    },
                }}
            >
                <LockOutlinedIcon sx={{ fontSize: 16, color: '#bbb', flexShrink: 0 }} />
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#333', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                        &lt;{lock.address}&gt;
                    </Typography>
                    <Tooltip title={lock.className} placement="top">
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#888',
                                fontSize: '0.72rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: { xs: 160, sm: 320, md: 500 },
                                cursor: 'default',
                            }}
                        >
                            {shortName}
                        </Typography>
                    </Tooltip>
                </Box>
                <Chip
                    label={`${lock.victims.length} Blocked`}
                    size="small"
                    sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: '0.68rem', height: 22, flexShrink: 0 }}
                />
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
                {/* Full class name sub-header on grey */}
                <Box sx={{ px: 2, py: 0.75, bgcolor: '#f5f5f5', borderTop: '1px solid #ffe0b2', borderBottom: '1px solid #eeeeee' }}>
                    <Typography variant="caption" sx={{ color: '#777', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {lock.className}
                    </Typography>
                </Box>

                {lock.victims.length === 0 ? (
                    <Box sx={{ px: 2, py: 2, bgcolor: '#fafafa', textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            No blocked threads recorded for this monitor.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {visibleVictims.map((victim, idx) => (
                            <React.Fragment key={victim.thread.id}>
                                {idx > 0 && <Divider />}
                                <VictimRow victim={victim} onThreadClick={onThreadClick} />
                            </React.Fragment>
                        ))}
                        {hiddenCount > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fafafa' }}>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => setShowAll(v => !v)}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#e65100' }}
                                    >
                                        {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                    </Button>
                                </Box>
                            </>
                        )}
                    </>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LockContention: React.FC = () => {
    const { data } = useAnalysisData();
    const navigate = useNavigate();

    const threads = data?.threads ?? [];

    const { culprits, orphanedLocks, deadlocks } = useMemo(
        () => deriveCulpritCentricData(threads),
        [threads],
    );

    const totalBlocked = culprits.reduce((acc, c) => acc + c.totalVictims, 0);
    const hasContention = culprits.length > 0 || orphanedLocks.length > 0;

    const ORPHAN_LOCK_LIMIT = 15;
    const [showAllOrphanedLocks, setShowAllOrphanedLocks] = useState(false);
    const visibleOrphanedLocks = showAllOrphanedLocks
        ? orphanedLocks
        : orphanedLocks.slice(0, ORPHAN_LOCK_LIMIT);
    const hiddenOrphanedCount = orphanedLocks.length - ORPHAN_LOCK_LIMIT;

    // Fixed Routing Path
    const handleThreadClick = (name: string) => {
        navigate('/thread-explorer', { state: { searchThread: name } });
    };

    if (!data) {
        return (
            <Container sx={{ mt: 4, textAlign: 'center' }}>
                <img src={noData} alt="No Data" style={{ marginTop: 50 }} />
                <Typography variant="h4" color="textPrimary" style={{ marginTop: 50 }}>No analysis data found.</Typography>
            </Container>
        );
    }

    return (
        <Box sx={{ overflowY: 'auto', height: '100%', bgcolor: '#f8f9fa' }}>
            <Box sx={{ p: 3, maxWidth: 2000, mx: 'auto' }}>

                {/* Page Header */}
                <Box sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <LockOutlinedIcon sx={{ color: '#e53935' }} />
                        <Typography variant="h5" fontWeight="bold">
                            Lock Contention &amp; Monitors
                        </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {hasContention
                            ? `${culprits.length} culprit thread${culprits.length !== 1 ? 's' : ''} blocking ${totalBlocked} thread${totalBlocked !== 1 ? 's' : ''} total`
                            : 'No lock contention detected in this thread dump.'}
                    </Typography>
                </Box>

                {/* Metadata Bar */}
                <Paper
                    elevation={0}
                    sx={{
                        display: 'inline-flex',
                        gap: 4,
                        px: 2.5,
                        py: 1.25,
                        mb: 2.5,
                        border: '1px solid #e8e8e8',
                        borderRadius: 2,
                        bgcolor: 'white',
                        flexWrap: 'wrap',
                    }}
                >
                    {[
                        { label: 'Total Threads', value: threads.length },
                    ].map(({ label, value }) => (
                        <Box key={label}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block' }}>
                                {label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.82rem' }}>
                                {value}
                            </Typography>
                        </Box>
                    ))}
                </Paper>

                {/* Deadlock Hero Alert */}
                {deadlocks.length > 0 && (
                    <Alert
                        severity="error"
                        variant="filled"
                        icon={<WarningAmberIcon />}
                        sx={{ mb: 3, borderRadius: 2 }}
                    >
                        <AlertTitle sx={{ fontWeight: 700 }}>
                            Deadlock Detected — {deadlocks.length} cycle{deadlocks.length !== 1 ? 's' : ''}
                        </AlertTitle>
                        {deadlocks.map((cycle, i) => {
                            const threadA = cycle.threads[0]?.thread.name ?? '?';
                            const threadB = cycle.threads[1]?.thread.name ?? '?';
                            return (
                                <Typography key={i} variant="caption" display="block" sx={{ fontFamily: 'monospace', mt: 0.5, opacity: 0.95 }}>
                                    Circular Dependency Detected: {threadA} is waiting on {threadB}, which is waiting on {threadA}
                                </Typography>
                            );
                        })}
                    </Alert>
                )}

                {/* No contention state */}
                {!hasContention && (
                    <Paper elevation={0} sx={{ p: 3, bgcolor: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body1" color="#2e7d32" fontWeight={600}>
                            All clear — no lock contention detected.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            All threads are running without observable lock conflicts.
                        </Typography>
                    </Paper>
                )}

                {/* Culprit Threads Section */}
                {hasContention && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e' }}>
                            Culprit Threads (Owners)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
                            Threads holding locks/monitors and blocking other threads, sorted by impact.
                        </Typography>
                        {culprits.length === 0 ? (
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    bgcolor: '#f5f5f5',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                }}
                            >
                                <LockOutlinedIcon sx={{ color: '#bbb', fontSize: 22, flexShrink: 0 }} />
                                <Box>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                                        No culprit threads identified
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        No thread was found actively holding a lock that is blocking others. The monitors below may be orphaned or already released.
                                    </Typography>
                                </Box>
                            </Paper>
                        ) : culprits.map(entry => (
                            <CulpritAccordion key={entry.thread.id} entry={entry} onThreadClick={handleThreadClick} />
                        ))}
                    </Box>
                )}

                {/* Orphaned Monitors Section */}
                {orphanedLocks.length > 0 && (
                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e' }}>
                            Unowned / Orphaned Monitors
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Locks with blocked threads but no identifiable owner in the current snapshot.
                        </Typography>
                        {visibleOrphanedLocks.map(lock => (
                            <OrphanedLockCard key={lock.address} lock={lock} onThreadClick={handleThreadClick} />
                        ))}
                        {hiddenOrphanedCount > 0 && (
                            <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setShowAllOrphanedLocks(v => !v)}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#e65100' }}
                                >
                                    {showAllOrphanedLocks
                                        ? 'Show fewer'
                                        : `Show all ${orphanedLocks.length} locks`}
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

            </Box>
        </Box>
    );
};

export default LockContention;