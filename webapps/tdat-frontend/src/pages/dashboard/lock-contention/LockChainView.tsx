import React, { useState } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { DeadlockCycle, CulpritEntry } from '../../../utils/lockContentionAnalysis';

// ─── Deadlock Cycle Flow ─────────────────────────────────────────────────────

interface DeadlockChainProps {
    cycle: DeadlockCycle;
    index: number;
    onThreadClick: (name: string) => void;
}

const DeadlockChain: React.FC<DeadlockChainProps> = ({ cycle, index, onThreadClick }) => (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, border: '1px solid rgba(252,165,165,0.4)', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Chip
                label={`Cycle ${index + 1}`}
                size="small"
                sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.7rem', height: 22, borderRadius: 1.5 }}
            />
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                {cycle.threads.length} threads in circular dependency
            </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {cycle.threads.map((entry, i) => {
                const shortClass = entry.lockClassName.split('.').pop() ?? entry.lockClassName;
                const nextThread = cycle.threads[(i + 1) % cycle.threads.length];
                return (
                    <React.Fragment key={entry.thread.id}>
                        {/* Thread node */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {/* Vertical line connector */}
                            <Box sx={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                <Box sx={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    bgcolor: '#dc2626', border: '2px solid #fecaca',
                                    zIndex: 1,
                                }} />
                            </Box>
                            <Box
                                onClick={() => onThreadClick(entry.thread.name)}
                                sx={{
                                    flex: 1, px: 1.5, py: 0.75,
                                    bgcolor: '#fef2f2', borderRadius: 2,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: '#fee2e2' },
                                    display: 'flex', alignItems: 'center', gap: 1,
                                    minWidth: 0,
                                }}
                            >
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#1565c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.thread.name}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Arrow: waiting for lock */}
                        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
                            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <Box sx={{ width: 2, bgcolor: '#e5e7eb', minHeight: 28 }} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
                                <ArrowForwardIcon sx={{ fontSize: 14, color: '#9ca3af', transform: 'rotate(90deg)' }} />
                                <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.68rem', fontStyle: 'italic' }}>
                                    waiting for
                                </Typography>
                                <LockOutlinedIcon sx={{ fontSize: 13, color: '#ea580c' }} />
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#ea580c', fontWeight: 600, fontSize: '0.7rem' }}>
                                    {shortClass}
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#9ca3af', fontSize: '0.65rem' }}>
                                    &lt;{entry.waitingOnAddress}&gt;
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.68rem', fontStyle: 'italic' }}>
                                    held by
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1565c0', fontWeight: 600, fontSize: '0.7rem' }}>
                                    {nextThread.thread.name.length > 30 ? nextThread.thread.name.slice(0, 30) + '...' : nextThread.thread.name}
                                </Typography>
                            </Box>
                        </Box>
                    </React.Fragment>
                );
            })}

            {/* Closing circle to show cycle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <Box sx={{
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: '#dc2626', border: '2px solid #fecaca',
                        zIndex: 1,
                    }} />
                </Box>
                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600, fontStyle: 'italic', fontSize: '0.72rem' }}>
                    back to {cycle.threads[0].thread.name.length > 40 ? cycle.threads[0].thread.name.slice(0, 40) + '...' : cycle.threads[0].thread.name}
                </Typography>
            </Box>
        </Box>
    </Paper>
);

// ─── Contention Chain Flow ───────────────────────────────────────────────────

interface ContentionChainProps {
    culprit: CulpritEntry;
    onThreadClick: (name: string) => void;
}

const ContentionChain: React.FC<ContentionChainProps> = ({ culprit, onThreadClick }) => {
    const [expandedLocks, setExpandedLocks] = useState<Set<string>>(new Set());

    const toggleLock = (address: string) => {
        setExpandedLocks(prev => {
            const next = new Set(prev);
            if (next.has(address)) next.delete(address);
            else next.add(address);
            return next;
        });
    };

    return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Owner node */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ea580c', border: '2px solid #fed7aa' }} />
            </Box>
            <Box
                onClick={() => onThreadClick(culprit.thread.name)}
                sx={{
                    px: 1.5, py: 0.75, bgcolor: '#fff7ed', borderRadius: 2,
                    cursor: 'pointer', '&:hover': { bgcolor: '#ffedd5' },
                    display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1,
                }}
            >
                <Chip label="OWNER" size="small" sx={{ bgcolor: '#ea580c', color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 18, borderRadius: 1 }} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#1565c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {culprit.thread.name}
                </Typography>
            </Box>
        </Box>

        {/* Locks and victims */}
        {culprit.heldLocks.map((lock) => {
            const shortClass = lock.className.split('.').pop() ?? lock.className;
            const isExpanded = expandedLocks.has(lock.address);
            const visibleVictims = isExpanded ? lock.victims : lock.victims.slice(0, 5);
            const remainingCount = lock.victims.length - 5;
            return (
                <React.Fragment key={lock.address}>
                    {/* Lock connector */}
                    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
                        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                            <Box sx={{ width: 2, bgcolor: '#e5e7eb', minHeight: 24 }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                            <LockOutlinedIcon sx={{ fontSize: 13, color: '#ea580c' }} />
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#ea580c', fontWeight: 600, fontSize: '0.7rem' }}>
                                {shortClass}
                            </Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#9ca3af', fontSize: '0.65rem' }}>
                                &lt;{lock.address}&gt;
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.68rem' }}>
                                — {lock.victims.length} blocked
                            </Typography>
                        </Box>
                    </Box>

                    {/* Victim nodes */}
                    {visibleVictims.map((victim) => (
                        <Box key={victim.thread.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                                <Box sx={{ width: 2, bgcolor: '#e5e7eb', position: 'absolute', top: 0, bottom: '50%' }} />
                                <Box sx={{ width: 12, height: 2, bgcolor: '#e5e7eb', position: 'absolute', left: '50%', top: '50%' }} />
                            </Box>
                            <Box
                                onClick={() => onThreadClick(victim.thread.name)}
                                sx={{
                                    flex: 1, px: 1.5, py: 0.5, ml: 1,
                                    bgcolor: '#fef2f2', borderRadius: 2,
                                    cursor: 'pointer', '&:hover': { bgcolor: '#fee2e2' },
                                    display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
                                }}
                            >
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#1565c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {victim.thread.name}
                                </Typography>
                                {victim.waitTimeMs > 0 && (
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: victim.waitTimeMs >= 10000 ? '#dc2626' : '#9ca3af', fontSize: '0.65rem', flexShrink: 0 }}>
                                        {victim.waitTimeMs >= 1000 ? `${(victim.waitTimeMs / 1000).toFixed(1)}s` : `${victim.waitTimeMs}ms`}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ))}
                    {remainingCount > 0 && (
                        <Box
                            onClick={() => toggleLock(lock.address)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { '& .expand-label': { color: '#6b7280' } } }}
                        >
                            <Box sx={{ width: 24, flexShrink: 0 }} />
                            <Typography className="expand-label" variant="caption" sx={{ color: '#9ca3af', fontSize: '0.68rem', ml: 1, py: 0.25, userSelect: 'none' }}>
                                {isExpanded ? '— Show fewer' : `+ ${remainingCount} more blocked threads`}
                            </Typography>
                        </Box>
                    )}
                </React.Fragment>
            );
        })}
    </Paper>
    );
};

// ─── Exported Component ──────────────────────────────────────────────────────

interface LockChainViewProps {
    deadlocks: DeadlockCycle[];
    culprits: CulpritEntry[];
    onThreadClick: (name: string) => void;
}

const LockChainView: React.FC<LockChainViewProps> = ({ deadlocks, culprits, onThreadClick }) => {
    if (deadlocks.length === 0 && culprits.length === 0) return null;

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#111827' }}>Chain Map</Typography>
            <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
                Visual flow of lock dependencies — follow the chain to trace contention from owner to blocked threads.
            </Typography>

            {deadlocks.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#dc2626', mb: 1.5, fontSize: '0.82rem' }}>
                        Deadlock Cycles
                    </Typography>
                    {deadlocks.map((cycle, i) => (
                        <DeadlockChain key={i} cycle={cycle} index={i} onThreadClick={onThreadClick} />
                    ))}
                </Box>
            )}

            {culprits.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1.5, fontSize: '0.82rem' }}>
                        Contention Chains
                    </Typography>
                    {culprits.slice(0, 10).map((culprit) => (
                        <ContentionChain key={culprit.thread.id} culprit={culprit} onThreadClick={onThreadClick} />
                    ))}
                    {culprits.length > 10 && (
                        <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', textAlign: 'center', mt: 1 }}>
                            Showing top 10 of {culprits.length} chains by impact
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default LockChainView;
