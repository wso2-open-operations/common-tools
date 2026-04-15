import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Alert, AlertTitle,
    Button, Container, Stack, TextField, InputAdornment,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SearchIcon from '@mui/icons-material/Search';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAnalysisData } from '@context/AnalysisContext';
import { deriveCulpritCentricData } from '../../utils/lockContentionAnalysis';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import CulpritAccordion from './lock-contention/CulpritAccordion';
import OrphanedLockCard from './lock-contention/OrphanedLockCard';
import LockChainView from './lock-contention/LockChainView';
import noData from '@assets/error.svg';

const ORPHAN_LOCK_LIMIT = 15;

function formatMaxWait(ms: number): string {
    if (ms >= 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

const LockContention: React.FC = () => {
    const { data } = useAnalysisData();
    const navigateToThread = useNavigateToThread();
    const threads = data?.threads ?? [];

    const { culprits, orphanedLocks, deadlocks } = useMemo(
        () => deriveCulpritCentricData(threads),
        [threads],
    );

    const totalBlocked = culprits.reduce((acc, c) => acc + c.totalVictims, 0);
    const hasContention = culprits.length > 0 || orphanedLocks.length > 0;

    const [searchQuery, setSearchQuery] = useState('');
    const [showAllOrphanedLocks, setShowAllOrphanedLocks] = useState(false);

    // Compute max wait time across all victims
    const maxWaitTimeMs = useMemo(() => {
        let maxMs = 0;
        for (const c of culprits) {
            for (const lock of c.heldLocks) {
                for (const v of lock.victims) {
                    if (v.waitTimeMs > maxMs) maxMs = v.waitTimeMs;
                }
            }
        }
        for (const o of orphanedLocks) {
            for (const v of o.victims) {
                if (v.waitTimeMs > maxMs) maxMs = v.waitTimeMs;
            }
        }
        return maxMs;
    }, [culprits, orphanedLocks]);

    // Filtered data based on search
    const q = searchQuery.toLowerCase().trim();

    const filteredCulprits = useMemo(() => {
        if (!q) return culprits;
        return culprits.filter(entry => {
            if (entry.thread.name.toLowerCase().includes(q)) return true;
            if (entry.thread.id.toLowerCase().includes(q)) return true;
            for (const lock of entry.heldLocks) {
                if (lock.address.toLowerCase().includes(q)) return true;
                if (lock.className.toLowerCase().includes(q)) return true;
                for (const v of lock.victims) {
                    if (v.thread.name.toLowerCase().includes(q)) return true;
                }
            }
            return false;
        });
    }, [culprits, q]);

    const filteredOrphanedLocks = useMemo(() => {
        if (!q) return orphanedLocks;
        return orphanedLocks.filter(lock => {
            if (lock.address.toLowerCase().includes(q)) return true;
            if (lock.className.toLowerCase().includes(q)) return true;
            for (const v of lock.victims) {
                if (v.thread.name.toLowerCase().includes(q)) return true;
            }
            return false;
        });
    }, [orphanedLocks, q]);

    const visibleOrphanedLocks = showAllOrphanedLocks ? filteredOrphanedLocks : filteredOrphanedLocks.slice(0, ORPHAN_LOCK_LIMIT);
    const hiddenOrphanedCount = filteredOrphanedLocks.length - ORPHAN_LOCK_LIMIT;

    const hasFilteredResults = filteredCulprits.length > 0 || filteredOrphanedLocks.length > 0;

    if (!data) {
        return (
            <Container sx={{ mt: 4, textAlign: 'center' }}>
                <img src={noData} alt="No Data" style={{ marginTop: 50 }} />
                <Typography variant="h4" color="textPrimary" style={{ marginTop: 50 }}>No analysis data found.</Typography>
            </Container>
        );
    }

    return (
        <Box sx={{ overflowY: 'auto', height: '100%' }}>
            <Box sx={{ p: 3, maxWidth: 2000, mx: 'auto' }}>

                {/* Page Header + Search */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                            <LockOutlinedIcon sx={{ color: '#e53935' }} />
                            <Typography variant="h5" fontWeight="bold">
                                Lock Contention &amp; Monitors
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {hasContention
                                ? `${culprits.length} lock owner${culprits.length !== 1 ? 's' : ''} blocking ${totalBlocked} thread${totalBlocked !== 1 ? 's' : ''} total`
                                : 'No lock contention detected in this thread dump.'}
                        </Typography>
                    </Box>

                    {hasContention && (
                        <TextField
                            size="small"
                            placeholder="Search thread name or monitor address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} /></InputAdornment> } }}
                            sx={{
                                width: 360,
                                bgcolor: 'rgba(255,255,255,0.8)',
                                flexShrink: 0,
                                '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.08)' },
                                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.15)' },
                            }}
                        />
                    )}
                </Box>

                {/* Metadata Bar */}
                <Paper sx={{ display: 'inline-flex', gap: 4, px: 2.5, py: 1.25, mb: 2.5, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3, bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <Box>
                        <Typography variant="caption" sx={{ fontSize: '0.72rem', display: 'block', color: '#6b7280' }}>Total Threads</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', fontSize: '0.82rem' }}>{threads.length}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" sx={{ fontSize: '0.72rem', display: 'block', color: '#6b7280' }}>Blocked Threads</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: totalBlocked > 0 ? '#dc2626' : '#111827', fontSize: '0.82rem' }}>{totalBlocked}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" sx={{ fontSize: '0.72rem', display: 'block', color: '#6b7280' }}>Deadlock Cycles</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: deadlocks.length > 0 ? '#dc2626' : '#111827', fontSize: '0.82rem' }}>{deadlocks.length}</Typography>
                    </Box>
                    {maxWaitTimeMs > 0 && (
                        <Box>
                            <Typography variant="caption" sx={{ fontSize: '0.72rem', display: 'block', color: '#6b7280' }}>
                                <AccessTimeIcon sx={{ fontSize: 11, mr: 0.3, verticalAlign: 'middle' }} />
                                Max Wait Time
                            </Typography>
                            <Typography variant="body2" sx={{
                                fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace',
                                color: maxWaitTimeMs >= 60_000 ? '#dc2626' : maxWaitTimeMs >= 10_000 ? '#ea580c' : '#111827',
                            }}>
                                {formatMaxWait(maxWaitTimeMs)}
                            </Typography>
                        </Box>
                    )}
                </Paper>

                {/* Deadlock Hero Alert */}
                {deadlocks.length > 0 && (
                    <Alert severity="error" variant="filled" icon={<WarningAmberIcon />} sx={{ mb: 3, borderRadius: 3 }}>
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
                    <Paper sx={{ p: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3, textAlign: 'center' }}>
                        <Typography variant="body1" color="#2e7d32" fontWeight={600}>
                            All clear — no lock contention detected.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            All threads are running without observable lock conflicts.
                        </Typography>
                    </Paper>
                )}

                {/* Chain Map Visualization */}
                {!q && (deadlocks.length > 0 || culprits.length > 0) && (
                    <LockChainView deadlocks={deadlocks} culprits={culprits} onThreadClick={navigateToThread} />
                )}

                {/* Search empty state */}
                {q && !hasFilteredResults && (
                    <Paper sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3, textAlign: 'center', mb: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <SearchIcon sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#6b7280' }}>
                            No results for "{searchQuery}"
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
                            Try searching by thread name, thread ID, monitor address, or class name.
                        </Typography>
                    </Paper>
                )}

                {/* Culprit Threads Section */}
                {hasContention && hasFilteredResults && (
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight={700} sx={{ color: '#111827' }}>Lock Owners</Typography>
                            {q && <Typography variant="caption" sx={{ color: '#9ca3af' }}>({filteredCulprits.length} match{filteredCulprits.length !== 1 ? 'es' : ''})</Typography>}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
                            Threads holding locks/monitors and blocking other threads, sorted by impact.
                        </Typography>
                        {filteredCulprits.length === 0 ? (
                            <Paper sx={{ p: 2.5, bgcolor: 'rgba(249,250,251,0.6)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <LockOutlinedIcon sx={{ color: '#d1d5db', fontSize: 22, flexShrink: 0 }} />
                                <Box>
                                    <Typography variant="body2" fontWeight={600} sx={{ color: '#6b7280' }}>No lock owners identified</Typography>
                                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                                        {q ? 'No lock owners match your search query.' : 'No thread was found actively holding a lock that is blocking others. The monitors below may be orphaned or already released.'}
                                    </Typography>
                                </Box>
                            </Paper>
                        ) : filteredCulprits.map(entry => (
                            <CulpritAccordion key={entry.thread.id} entry={entry} onThreadClick={navigateToThread} />
                        ))}
                    </Box>
                )}

                {/* Orphaned Monitors Section */}
                {filteredOrphanedLocks.length > 0 && (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight={700} sx={{ color: '#111827' }}>Unowned Monitors</Typography>
                            {q && <Typography variant="caption" sx={{ color: '#9ca3af' }}>({filteredOrphanedLocks.length} match{filteredOrphanedLocks.length !== 1 ? 'es' : ''})</Typography>}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Monitors with blocked threads but no owner thread visible in this snapshot.
                        </Typography>
                        {visibleOrphanedLocks.map(lock => (
                            <OrphanedLockCard key={lock.address} lock={lock} onThreadClick={navigateToThread} />
                        ))}
                        {hiddenOrphanedCount > 0 && (
                            <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                <Button size="small" variant="text" onClick={() => setShowAllOrphanedLocks(v => !v)} sx={{ fontSize: '0.75rem', color: '#ea580c' }}>
                                    {showAllOrphanedLocks ? 'Show fewer' : `Show all ${filteredOrphanedLocks.length} locks`}
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
