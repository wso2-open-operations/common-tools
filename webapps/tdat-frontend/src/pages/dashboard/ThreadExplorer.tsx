import React, { useState, useMemo, useEffect } from 'react';
import {
    Box, Paper, Typography, Tooltip,
    List, ListItemButton,
    Container, Stack, TableSortLabel, Pagination,
    TextField, InputAdornment, Select, MenuItem, type SelectChangeEvent
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import SearchIcon from '@mui/icons-material/Search';

import { useAnalysisData } from '@context/AnalysisContext';
import type { Thread } from '@/types/api';
import ThreadRow from './thread-explorer/ThreadRow';
import noData from '@assets/error.svg';
import notFound from '@assets/no-search-results.svg';

type Order = 'asc' | 'desc';
type SortableKeys = 'id' | 'name' | 'state' | 'avgCpu' | 'maxCpu' | 'avgUserTime';

const ThreadExplorer: React.FC = () => {
    const { data } = useAnalysisData();
    const location = useLocation();

    const [selectedPool, setSelectedPool] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(location.state?.searchThread || '');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('maxCpu');

    // Group threads by pool, deduplicated by id
    const threadsByPool = useMemo(() => {
        if (!data) return {};
        const groups: Record<string, Thread[]> = {};
        const seenThreads = new Set<string>();

        data.threads.forEach(t => {
            if (seenThreads.has(t.id)) return;
            seenThreads.add(t.id);
            const pool = t.thread_pool || 'Uncategorized';
            if (!groups[pool]) groups[pool] = [];
            groups[pool].push(t);
        });

        return groups;
    }, [data]);

    // Auto-select pool, honouring incoming navigation state
    useEffect(() => {
        if (location.state?.searchThread && Object.keys(threadsByPool).length > 0 && !selectedPool) {
            const targetThread = data?.threads.find(t => t.name === location.state.searchThread);
            setSelectedPool(targetThread?.thread_pool || 'Uncategorized');
            window.history.replaceState({}, document.title);
        } else if (!selectedPool && Object.keys(threadsByPool).length > 0) {
            setSelectedPool(Object.keys(threadsByPool)[0]);
        }
    }, [threadsByPool, selectedPool, location.state, data]);

    // Reset pagination on filter/pool change
    useEffect(() => { setPage(1); }, [selectedPool, searchQuery, rowsPerPage]);

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedThreads = useMemo(() => {
        if (!selectedPool || !threadsByPool[selectedPool]) return [];

        let current = threadsByPool[selectedPool];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            current = current.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
        }

        const withStats = current.map(thread => {
            const snaps = thread.snapshots;
            const lastSnap = snaps[snaps.length - 1];
            const maxCpu = Math.max(...snaps.map(s => s.cpu_percent || 0));
            const avgUserTime = snaps.length > 0 ? snaps.reduce((acc, s) => acc + (s.cpu_time_ms || 0), 0) / snaps.length : 0;
            const avgCpu = lastSnap?.cpu_percent || 0;
            const displayState = lastSnap?.state || 'N/A';

            return {
                data: thread,
                stats: { id: thread.id, name: thread.name, state: displayState, avgCpu, maxCpu, avgUserTime },
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
    }, [threadsByPool, selectedPool, order, orderBy, searchQuery]);

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

    const createSortHandler = (property: SortableKeys) => () => handleRequestSort(property);

    const handlePoolChange = (pool: string) => { setSelectedPool(pool); setSearchQuery(''); };

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* Thread Pool Sidebar */}
            <Paper
                sx={(theme) => ({
                    width: 280,
                    flexShrink: 0,
                    bgcolor: theme.palette.surface.sidebarBg,
                    backdropFilter: 'blur(12px)',
                    borderRadius: 0,
                    borderRight: `1px solid ${theme.palette.surface.border}`,
                    overflowY: 'auto',
                })}
            >
                <Box sx={(theme) => ({ p: 2, borderBottom: `1px solid ${theme.palette.surface.border}` })}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <LayersOutlinedIcon fontSize="small" sx={(theme) => ({ color: theme.palette.text.secondary })} />
                        <Typography
                            variant="subtitle1"
                            sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.9rem' })}
                        >
                            Thread Groupings
                        </Typography>
                    </Stack>
                </Box>
                <List component="nav" sx={{ p: 1 }}>
                    {Object.keys(threadsByPool).map((pool) => {
                        const isSelected = selectedPool === pool;
                        return (
                            <Tooltip
                                title={""}
                                key={pool}
                                placement="right"
                                arrow
                            >
                                <ListItemButton
                                    selected={isSelected}
                                    onClick={() => handlePoolChange(pool)}
                                    sx={(theme) => ({
                                        mb: 0.5,
                                        borderRadius: 2,
                                        alignItems: 'flex-start',
                                        bgcolor: isSelected ? theme.palette.brand.softBg : 'transparent',
                                        borderLeft: `3px solid ${isSelected ? theme.palette.brand.main : 'transparent'}`,
                                        '&.Mui-selected': { bgcolor: theme.palette.brand.softBg, color: theme.palette.brand.softText },
                                        '&:hover': { bgcolor: isSelected ? theme.palette.brand.softBg : theme.palette.surface.hoverBg },
                                    })}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                                        <Typography
                                            variant="body2"
                                            sx={(theme) => ({
                                                fontSize: '0.85rem',
                                                fontWeight: isSelected ? 600 : 500,
                                                color: isSelected ? theme.palette.brand.softText : theme.palette.text.primary,
                                            })}
                                        >
                                            {pool}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={(theme) => ({ color: theme.palette.text.disabled })}
                                        >
                                            {threadsByPool[pool].length} threads
                                        </Typography>
                                    </Box>
                                </ListItemButton>
                            </Tooltip>
                        );
                    })}
                </List>
            </Paper>

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto' }}>

                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                    <Box
                        sx={(theme) => ({
                            flex: 1,
                            mr: 3,
                            p: 2.5,
                            bgcolor: theme.palette.surface.translucent,
                            backdropFilter: 'blur(8px)',
                            borderLeft: `3px solid ${theme.palette.brand.main}`,
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.surface.border}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        })}
                    >
                        <Typography
                            variant="h5"
                            sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary })}
                            gutterBottom
                        >
                            {selectedPool}
                        </Typography>
                        {selectedPool && data.thread_pools?.[selectedPool] && (
                            <Box mb={1}>
                                <Typography variant="body2" color="text.primary" gutterBottom>
                                    <strong>Description:</strong> {data.thread_pools[selectedPool].description}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    <strong>Expected behavior:</strong> {data.thread_pools[selectedPool].expected_behavior}
                                </Typography>
                            </Box>
                        )}
                        <Typography variant="body2" color="text.secondary">Showing {filteredAndSortedThreads.length} thread(s)</Typography>
                    </Box>
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

                {/* Sort Header */}
                <Paper
                    sx={(theme) => ({
                        p: 2,
                        mb: 2,
                        bgcolor: theme.palette.surface.muted,
                        borderRadius: 3,
                        border: `1px solid ${theme.palette.surface.border}`,
                    })}
                >
                    <Grid container spacing={2}>
                        {([
                            { key: 'id' as SortableKeys, label: 'THREAD ID', size: 2.5, pl: 5 as number | undefined },
                            { key: 'name' as SortableKeys, label: 'THREAD NAME', size: 3, pl: undefined },
                            { key: 'state' as SortableKeys, label: 'LAST STATE', size: 1.5, pl: undefined },
                            { key: 'avgCpu' as SortableKeys, label: 'AVG CPU (%)', size: 1.5, pl: undefined },
                            { key: 'maxCpu' as SortableKeys, label: 'MAX CPU (%)', size: 1.5, pl: undefined },
                            { key: 'avgUserTime' as SortableKeys, label: 'AVG USER TIME', size: 2, pl: undefined },
                        ]).map(col => (
                            <Grid key={col.key} size={{ xs: col.size }} sx={col.pl ? { pl: col.pl } : undefined}>
                                <TableSortLabel active={orderBy === col.key} direction={orderBy === col.key ? order : 'asc'} onClick={createSortHandler(col.key)}>
                                    <Typography variant="caption" fontWeight="bold" color="textPrimary">{col.label}</Typography>
                                </TableSortLabel>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>

                {/* Thread Rows */}
                {paginatedThreads.length > 0 ? (
                    paginatedThreads.map(({ data: thread, stats }) => (
                        <ThreadRow
                            key={thread.id}
                            thread={thread}
                            stats={{ lastState: stats.state, avgCpu: stats.avgCpu, maxCpu: stats.maxCpu, avgUserTime: stats.avgUserTime }}
                        />
                    ))
                ) : (
                    <Box textAlign="center" py={5}>
                        <img src={notFound} alt="No Threads matched" style={{ marginBottom: 30, width: '40%' }} />
                        <Typography variant="h6" color="text.secondary">No threads match your search query.</Typography>
                    </Box>
                )}

                {/* Pagination */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="text.secondary">Threads shown per page:</Typography>
                        <Select
                            size="small"
                            value={rowsPerPage}
                            onChange={(e: SelectChangeEvent<number>) => setRowsPerPage(Number(e.target.value))}
                            sx={(theme) => ({
                                bgcolor: theme.palette.surface.muted,
                                height: 32,
                                borderRadius: 2,
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.border },
                            })}
                        >
                            {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                    </Box>
                    {totalPages > 0 && (
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(_, val) => setPage(val)}
                            showFirstButton
                            showLastButton
                            shape="rounded"
                            sx={(theme) => ({
                                '& .MuiPaginationItem-root.Mui-selected': {
                                    bgcolor: theme.palette.brand.main,
                                    color: theme.palette.brand.contrast,
                                    '&:hover': { bgcolor: theme.palette.brand.hover },
                                },
                            })}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default ThreadExplorer;
