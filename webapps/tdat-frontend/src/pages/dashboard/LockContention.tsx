import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Alert, AlertTitle,
    Button, Container, Stack,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAnalysisData } from '@context/AnalysisContext';
import { deriveCulpritCentricData } from '../../utils/lockContentionAnalysis';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import CulpritAccordion from './lock-contention/CulpritAccordion';
import OrphanedLockCard from './lock-contention/OrphanedLockCard';
import noData from '@assets/error.svg';

const ORPHAN_LOCK_LIMIT = 15;

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

    const [showAllOrphanedLocks, setShowAllOrphanedLocks] = useState(false);
    const visibleOrphanedLocks = showAllOrphanedLocks ? orphanedLocks : orphanedLocks.slice(0, ORPHAN_LOCK_LIMIT);
    const hiddenOrphanedCount = orphanedLocks.length - ORPHAN_LOCK_LIMIT;

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
                <Paper elevation={0} sx={{ display: 'inline-flex', gap: 4, px: 2.5, py: 1.25, mb: 2.5, border: '1px solid #e8e8e8', borderRadius: 2, bgcolor: 'white', flexWrap: 'wrap' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block' }}>Total Threads</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.82rem' }}>{threads.length}</Typography>
                    </Box>
                </Paper>

                {/* Deadlock Hero Alert */}
                {deadlocks.length > 0 && (
                    <Alert severity="error" variant="filled" icon={<WarningAmberIcon />} sx={{ mb: 3, borderRadius: 2 }}>
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
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e' }}>Culprit Threads (Owners)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
                            Threads holding locks/monitors and blocking other threads, sorted by impact.
                        </Typography>
                        {culprits.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <LockOutlinedIcon sx={{ color: '#bbb', fontSize: 22, flexShrink: 0 }} />
                                <Box>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">No culprit threads identified</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        No thread was found actively holding a lock that is blocking others. The monitors below may be orphaned or already released.
                                    </Typography>
                                </Box>
                            </Paper>
                        ) : culprits.map(entry => (
                            <CulpritAccordion key={entry.thread.id} entry={entry} onThreadClick={navigateToThread} />
                        ))}
                    </Box>
                )}

                {/* Orphaned Monitors Section */}
                {orphanedLocks.length > 0 && (
                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e' }}>Unowned / Orphaned Monitors</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Locks with blocked threads but no identifiable owner in the current snapshot.
                        </Typography>
                        {visibleOrphanedLocks.map(lock => (
                            <OrphanedLockCard key={lock.address} lock={lock} onThreadClick={navigateToThread} />
                        ))}
                        {hiddenOrphanedCount > 0 && (
                            <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                <Button size="small" variant="text" onClick={() => setShowAllOrphanedLocks(v => !v)} sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#e65100' }}>
                                    {showAllOrphanedLocks ? 'Show fewer' : `Show all ${orphanedLocks.length} locks`}
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
