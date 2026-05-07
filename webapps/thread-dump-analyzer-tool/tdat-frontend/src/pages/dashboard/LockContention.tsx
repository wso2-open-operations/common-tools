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
import { deriveLockOwnerCentricData } from '../../utils/lockContentionAnalysis';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import LockOwnerAccordion from './lock-contention/LockOwnerAccordion';
import UnownedLockCard from './lock-contention/UnownedLockCard';
import LockChainView from './lock-contention/LockChainView';
import noData from '@assets/error.svg';

const UNOWNED_LOCK_LIMIT = 15;

function formatMaxWait(ms: number): string {
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

const LockContention: React.FC = () => {
    const { data } = useAnalysisData();
    const navigateToThread = useNavigateToThread();
    const threads = data?.threads ?? [];

    const { lockOwners, unownedLocks, deadlocks } = useMemo(
        () => deriveLockOwnerCentricData(threads),
        [threads],
    );

    const totalBlockedByOwners = lockOwners.reduce((acc, owner) => acc + owner.totalBlocked, 0);
    const totalBlockedInUnowned = unownedLocks.reduce((acc, lock) => acc + lock.blockedThreads.length, 0);
    const totalBlocked = totalBlockedByOwners + totalBlockedInUnowned;
    const hasContention = lockOwners.length > 0 || unownedLocks.length > 0;

    const [searchQuery, setSearchQuery] = useState('');
    const [showAllUnownedLocks, setShowAllUnownedLocks] = useState(false);

    // Compute max wait time across all blocked threads
    const maxWaitTimeMs = useMemo(() => {
        let maxMs = 0;
        for (const owner of lockOwners) {
            for (const lock of owner.heldLocks) {
                for (const bt of lock.blockedThreads) {
                    if (bt.waitTimeMs > maxMs) maxMs = bt.waitTimeMs;
                }
            }
        }
        for (const o of unownedLocks) {
            for (const bt of o.blockedThreads) {
                if (bt.waitTimeMs > maxMs) maxMs = bt.waitTimeMs;
            }
        }
        return maxMs;
    }, [lockOwners, unownedLocks]);

    // Filtered data based on search
    const q = searchQuery.toLowerCase().trim();

    const filteredLockOwners = useMemo(() => {
        if (!q) return lockOwners;
        return lockOwners.filter(entry => {
            if (entry.thread.name.toLowerCase().includes(q)) return true;
            if (entry.thread.id.toLowerCase().includes(q)) return true;
            for (const lock of entry.heldLocks) {
                if (lock.address.toLowerCase().includes(q)) return true;
                if (lock.className.toLowerCase().includes(q)) return true;
                for (const bt of lock.blockedThreads) {
                    if (bt.thread.name.toLowerCase().includes(q)) return true;
                }
            }
            return false;
        });
    }, [lockOwners, q]);

    const filteredUnownedLocks = useMemo(() => {
        if (!q) return unownedLocks;
        return unownedLocks.filter(lock => {
            if (lock.address.toLowerCase().includes(q)) return true;
            if (lock.className.toLowerCase().includes(q)) return true;
            for (const bt of lock.blockedThreads) {
                if (bt.thread.name.toLowerCase().includes(q)) return true;
            }
            return false;
        });
    }, [unownedLocks, q]);

    const visibleUnownedLocks = showAllUnownedLocks ? filteredUnownedLocks : filteredUnownedLocks.slice(0, UNOWNED_LOCK_LIMIT);
    const hiddenUnownedCount = filteredUnownedLocks.length - UNOWNED_LOCK_LIMIT;

    const hasFilteredResults = filteredLockOwners.length > 0 || filteredUnownedLocks.length > 0;

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
                            <LockOutlinedIcon sx={(theme) => ({ color: theme.palette.state.blocked.main })} />
                            <Typography variant="h5" fontWeight="bold">
                                Lock Contention &amp; Monitors
                            </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {hasContention
                                ? `${lockOwners.length} lock owner${lockOwners.length !== 1 ? 's' : ''}, ${totalBlocked} blocked thread${totalBlocked !== 1 ? 's' : ''} total`
                                : 'No lock contention detected in this thread dump.'}
                        </Typography>
                    </Box>

                    {hasContention && (
                        <TextField
                            size="small"
                            placeholder="Search thread name or monitor address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: 20 })} />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={(theme) => ({
                                width: 360,
                                bgcolor: theme.palette.surface.translucent,
                                flexShrink: 0,
                                '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.border },
                                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.borderStrong },
                            })}
                        />
                    )}
                </Box>

                {/* Metadata Bar */}
                <Paper
                    sx={(theme) => ({
                        display: 'inline-flex',
                        gap: 4,
                        px: 2.5,
                        py: 1.25,
                        mb: 2.5,
                        border: `1px solid ${theme.palette.surface.border}`,
                        borderRadius: 3,
                        bgcolor: theme.palette.surface.translucent,
                        backdropFilter: 'blur(8px)',
                        flexWrap: 'wrap',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    })}
                >
                    <Box>
                        <Typography variant="caption" sx={(theme) => ({ fontSize: '0.72rem', display: 'block', color: theme.palette.text.secondary })}>Total Threads</Typography>
                        <Typography variant="body2" sx={(theme) => ({ fontWeight: 600, color: theme.palette.text.primary, fontSize: '0.82rem' })}>{threads.length}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" sx={(theme) => ({ fontSize: '0.72rem', display: 'block', color: theme.palette.text.secondary })}>Blocked Threads</Typography>
                        <Typography
                            variant="body2"
                            sx={(theme) => ({
                                fontWeight: 600,
                                color: totalBlocked > 0 ? theme.palette.state.blocked.text : theme.palette.text.primary,
                                fontSize: '0.82rem',
                            })}
                        >
                            {totalBlocked}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" sx={(theme) => ({ fontSize: '0.72rem', display: 'block', color: theme.palette.text.secondary })}>Deadlock Cycles</Typography>
                        <Typography
                            variant="body2"
                            sx={(theme) => ({
                                fontWeight: 600,
                                color: deadlocks.length > 0 ? theme.palette.state.blocked.text : theme.palette.text.primary,
                                fontSize: '0.82rem',
                            })}
                        >
                            {deadlocks.length}
                        </Typography>
                    </Box>
                    {maxWaitTimeMs > 0 && (
                        <Box>
                            <Typography variant="caption" sx={(theme) => ({ fontSize: '0.72rem', display: 'block', color: theme.palette.text.secondary })}>
                                <AccessTimeIcon sx={{ fontSize: 11, mr: 0.3, verticalAlign: 'middle' }} />
                                Max Wait Time
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={(theme) => ({
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    fontFamily: 'monospace',
                                    color: maxWaitTimeMs >= 60_000
                                        ? theme.palette.state.blocked.text
                                        : maxWaitTimeMs >= 10_000
                                            ? theme.palette.state.waiting.text
                                            : theme.palette.text.primary,
                                })}
                            >
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
                            const names = cycle.threads.map((t) => t.thread.name);
                            const chain = names.length > 0 ? [...names, names[0]].join(' → ') : '?';
                            return (
                                <Typography key={i} variant="caption" display="block" sx={{ fontFamily: 'monospace', mt: 0.5, opacity: 0.95 }}>
                                    Circular Dependency Detected: {chain}
                                </Typography>
                            );
                        })}
                    </Alert>
                )}

                {/* No contention state */}
                {!hasContention && (
                    <Paper
                        sx={(theme) => ({
                            p: 3,
                            bgcolor: theme.palette.severity.success.bg,
                            border: `1px solid ${theme.palette.severity.success.border}`,
                            borderRadius: 3,
                            textAlign: 'center',
                        })}
                    >
                        <Typography
                            variant="body1"
                            fontWeight={600}
                            sx={(theme) => ({ color: theme.palette.severity.success.text })}
                        >
                            All clear — no lock contention detected.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            All threads are running without observable lock conflicts.
                        </Typography>
                    </Paper>
                )}

                {/* Chain Map Visualization */}
                {!q && (deadlocks.length > 0 || lockOwners.length > 0) && (
                    <LockChainView deadlocks={deadlocks} lockOwners={lockOwners} onThreadClick={navigateToThread} />
                )}

                {/* Search empty state */}
                {q && !hasFilteredResults && (
                    <Paper
                        sx={(theme) => ({
                            p: 4,
                            bgcolor: theme.palette.surface.translucent,
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${theme.palette.surface.border}`,
                            borderRadius: 3,
                            textAlign: 'center',
                            mb: 3,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        })}
                    >
                        <SearchIcon sx={(theme) => ({ fontSize: 40, color: theme.palette.text.disabled, mb: 1 })} />
                        <Typography variant="body1" sx={(theme) => ({ fontWeight: 600, color: theme.palette.text.secondary })}>
                            No results for "{searchQuery}"
                        </Typography>
                        <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.disabled, mt: 0.5 })}>
                            Try searching by thread name, thread ID, monitor address, or class name.
                        </Typography>
                    </Paper>
                )}

                {/* Lock Owners Section */}
                {hasContention && hasFilteredResults && (
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight={700} sx={(theme) => ({ color: theme.palette.text.primary })}>Lock Owners</Typography>
                            {q && <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled })}>({filteredLockOwners.length} match{filteredLockOwners.length !== 1 ? 'es' : ''})</Typography>}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
                            Threads holding locks/monitors and blocking other threads, sorted by impact.
                        </Typography>
                        {filteredLockOwners.length === 0 ? (
                            <Paper
                                sx={(theme) => ({
                                    p: 2.5,
                                    bgcolor: theme.palette.surface.muted,
                                    border: `1px solid ${theme.palette.surface.border}`,
                                    borderRadius: 3,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                })}
                            >
                                <LockOutlinedIcon sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: 22, flexShrink: 0 })} />
                                <Box>
                                    <Typography variant="body2" fontWeight={600} sx={(theme) => ({ color: theme.palette.text.secondary })}>No lock owners identified</Typography>
                                    <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled })}>
                                        {q ? 'No lock owners match your search query.' : 'No thread was found actively holding a lock that is blocking others. The monitors below may be unowned or already released.'}
                                    </Typography>
                                </Box>
                            </Paper>
                        ) : filteredLockOwners.map(entry => (
                            <LockOwnerAccordion key={entry.thread.id} entry={entry} onThreadClick={navigateToThread} />
                        ))}
                    </Box>
                )}

                {/* Unowned Monitors Section */}
                {filteredUnownedLocks.length > 0 && (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight={700} sx={(theme) => ({ color: theme.palette.text.primary })}>Unowned Monitors</Typography>
                            {q && <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled })}>({filteredUnownedLocks.length} match{filteredUnownedLocks.length !== 1 ? 'es' : ''})</Typography>}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Monitors with blocked threads but no owner thread visible in this snapshot.
                        </Typography>
                        {visibleUnownedLocks.map(lock => (
                            <UnownedLockCard key={lock.address} lock={lock} onThreadClick={navigateToThread} />
                        ))}
                        {hiddenUnownedCount > 0 && (
                            <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setShowAllUnownedLocks(v => !v)}
                                    sx={(theme) => ({ fontSize: '0.75rem', color: theme.palette.brand.softText })}
                                >
                                    {showAllUnownedLocks ? 'Show fewer' : `Show all ${filteredUnownedLocks.length} locks`}
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
