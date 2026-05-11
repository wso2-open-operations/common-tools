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
import {
    Box, Typography, Chip, Container,
    TextField, InputAdornment,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';

import { useAnalysisData } from '@context/AnalysisContext';
import type { Thread } from '@/types/api';
import ThreadRow from './thread-explorer/ThreadRow';
import PoolSidebar from './thread-explorer/PoolSidebar';
import PoolHeaderCard from './thread-explorer/PoolHeaderCard';
import ThreadSortHeader, { type Order, type SortableKeys } from './thread-explorer/ThreadSortHeader';
import ThreadTablePagination from './thread-explorer/ThreadTablePagination';
import noData from '@assets/error.svg';
import notFound from '@assets/no-search-results.svg';

// Order snapshots chronologically (by dump_name with natural sort) to identify most recent state.
const orderedSnapshots = (snaps: Thread['snapshots']) =>
    [...snaps].sort((a, b) =>
        a.dump_name.localeCompare(b.dump_name, undefined, { numeric: true })
    );

const ThreadExplorer: React.FC = () => {
    const { data } = useAnalysisData();
    const location = useLocation();

    const [selectedPools, setSelectedPools] = useState<string[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [searchQuery, setSearchQuery] = useState(location.state?.searchThread || '');

    // Captures the incoming filter (e.g., 'BLOCKED') from Dashboard navigation
    const [stateFilter, setStateFilter] = useState<string | null>(location.state?.stateFilter || null);

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('maxCpu');

    // Group threads by pool, deduplicated by id
    const threadsByPool = useMemo(() => {
        if (!data) return {};
        const groups: Record<string, Thread[]> = {};

        data.threads.forEach(t => {
            const pool = t.thread_pool || 'Uncategorized';
            if (!groups[pool]) groups[pool] = [];
            groups[pool].push(t);
        });

        return groups;
    }, [data]);

    // Auto-select pools, honouring incoming navigation state
    useEffect(() => {
        if (hasInitialized) return;
        const poolKeys = Object.keys(threadsByPool);
        if (poolKeys.length === 0) return;

        if (location.state?.searchThread) {
            const targetThread = data?.threads.find(t => t.name === location.state.searchThread);
            // If searchThread matches a thread name, narrow to its pool.
            // Otherwise (e.g., stack-frame search), keep all pools for full-dataset search.
            if (targetThread) {
                setSelectedPools([targetThread.thread_pool || 'Uncategorized']);
            } else {
                setSelectedPools(poolKeys);
            }
            window.history.replaceState({}, document.title);
        } else {
            setSelectedPools(poolKeys);
        }
        setHasInitialized(true);
    }, [threadsByPool, location.state, data, hasInitialized]);

    // Reset pagination on filter/pool change
    useEffect(() => { setPage(1); }, [selectedPools, searchQuery, stateFilter, rowsPerPage]);

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedThreads = useMemo(() => {
        if (selectedPools.length === 0) return [];

        const baseThreads: Thread[] = selectedPools.flatMap(pool => threadsByPool[pool] || []);

        // Pre-sort snapshots once per thread; reused by both the state filter and stats step.
        const enriched = baseThreads.map(thread => {
            const sortedSnaps = orderedSnapshots(thread.snapshots);
            const lastSnap = sortedSnaps[sortedSnaps.length - 1];
            return { thread, sortedSnaps, lastState: lastSnap?.state || 'N/A' };
        });

        let current = enriched;

        // Apply the state filter (e.g., only show BLOCKED threads)
        if (stateFilter) {
            current = current.filter(e => e.lastState === stateFilter);
        }

        // Apply search query filter — matches thread name/id or any stack-trace frame
        // so the Dashboard "Top Executing Method" click can pre-filter by method name.
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            current = current.filter(e =>
                e.thread.name.toLowerCase().includes(q) ||
                e.thread.id.toLowerCase().includes(q) ||
                e.thread.snapshots.some(s => s.stack_trace.some(line => line.toLowerCase().includes(q)))
            );
        }

        const withStats = current.map(({ thread, sortedSnaps, lastState }) => {
            const maxCpu = Math.max(...sortedSnaps.map(s => s.cpu_percent || 0));
            const avgUserTime = sortedSnaps.length > 0 ? sortedSnaps.reduce((acc, s) => acc + (s.cpu_time_ms || 0), 0) / sortedSnaps.length : 0;
            const avgCpu = sortedSnaps.length > 0 ? sortedSnaps.reduce((acc, s) => acc + (s.cpu_percent || 0), 0) / sortedSnaps.length : 0;

            return {
                data: thread,
                stats: { id: thread.id, name: thread.name, state: lastState, avgCpu, maxCpu, avgUserTime },
            };
        });

        return withStats.sort((a, b) => {
            const valueA: string | number = a.stats[orderBy];
            const valueB: string | number = b.stats[orderBy];

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                const result = valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: 'base' });
                return order === 'desc' ? -result : result;
            }
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return order === 'desc' ? valueB - valueA : valueA - valueB;
            }
            return 0;
        });
    }, [threadsByPool, selectedPools, order, orderBy, searchQuery, stateFilter]);

    const totalPages = Math.ceil(filteredAndSortedThreads.length / rowsPerPage);
    const paginatedThreads = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredAndSortedThreads.slice(start, start + rowsPerPage);
    }, [filteredAndSortedThreads, page, rowsPerPage]);

    if (!data) {
        return (
            <Container sx={{ mt: 4, textAlign: 'center' }}>
                <img src={noData} alt="No Data" style={{ marginTop: 50 }} />
                <Typography variant="h4" color="textPrimary" style={{ marginTop: 50 }}>No analysis data found.</Typography>
            </Container>
        );
    }

    const poolKeys = Object.keys(threadsByPool);
    const allSelected = poolKeys.length > 0 && selectedPools.length === poolKeys.length;

    const togglePool = (pool: string) => {
        setSelectedPools(prev =>
            prev.includes(pool) ? prev.filter(p => p !== pool) : [...prev, pool]
        );
    };

    const toggleSelectAll = () => {
        setSelectedPools(allSelected ? [] : poolKeys);
    };

    const headerTitle = (() => {
        if (selectedPools.length === 0) return 'No pools selected';
        if (selectedPools.length === 1) return selectedPools[0];
        if (selectedPools.length <= 3) return selectedPools.join(', ');
        return `Showing ${selectedPools.length} Selected Pools`;
    })();

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            <PoolSidebar
                poolKeys={poolKeys}
                selectedPools={selectedPools}
                threadsByPool={threadsByPool}
                allSelected={allSelected}
                togglePool={togglePool}
                toggleSelectAll={toggleSelectAll}
            />

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto' }}>

                <PoolHeaderCard
                    headerTitle={headerTitle}
                    selectedPools={selectedPools}
                    threadsByPool={threadsByPool}
                    threadPools={data.thread_pools}
                    filteredCount={filteredAndSortedThreads.length}
                    togglePool={togglePool}
                />

                {/* Table Toolbar */}
                <Box display="flex" justifyContent="flex-end" alignItems="center" gap={2} mb={2}>
                    {/* Clearable Active Filter Chip */}
                    {stateFilter && (
                        <Chip
                            label={`State: ${stateFilter}`}
                            onDelete={() => setStateFilter(null)}
                            sx={(theme) => ({
                                bgcolor: theme.palette.brand.softBg,
                                color: theme.palette.brand.softText,
                                border: `1px solid ${theme.palette.brand.main}`,
                                fontWeight: 600
                            })}
                        />
                    )}
                    <TextField
                        size="small"
                        placeholder="Search by Thread ID or Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={(theme) => ({ color: theme.palette.text.disabled })} />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={(theme) => ({
                            width: 350,
                            bgcolor: theme.palette.surface.translucent,
                            borderRadius: 2.5,
                            flexShrink: 0,
                            '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.border },
                        })}
                    />
                </Box>

                <ThreadSortHeader order={order} orderBy={orderBy} onRequestSort={handleRequestSort} />

                {/* Thread Rows */}
                {paginatedThreads.length > 0 ? (
                    paginatedThreads.map(({ data: thread, stats }) => (
                        <ThreadRow
                            key={`${thread.id}|${thread.name}|${thread.native_id}|${thread.thread_pool}`}
                            thread={thread}
                            stats={{ lastState: stats.state, avgCpu: stats.avgCpu, maxCpu: stats.maxCpu, avgUserTime: stats.avgUserTime }}
                        />
                    ))
                ) : (
                    <Box textAlign="center" py={5}>
                        <img src={notFound} alt="No Threads matched" style={{ marginBottom: 30, width: '40%' }} />
                        <Typography variant="h6" color="text.secondary">No threads match your filters.</Typography>
                    </Box>
                )}

                <ThreadTablePagination
                    page={page}
                    totalPages={totalPages}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </Box>
        </Box>
    );
};

export default ThreadExplorer;
