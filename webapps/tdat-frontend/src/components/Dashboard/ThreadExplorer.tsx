import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Chip, IconButton,
    Collapse, List, ListItemButton, ListItemText,
    Container, Stack, TableSortLabel
} from '@mui/material';
import Grid from '@mui/material/Grid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { LineChart } from '@mui/x-charts/LineChart';
import { useAnalysisData } from '../../context/AnalysisContext';
import type { Thread, ThreadSnapshot } from '../../types/api';

// Types for Sorting
type Order = 'asc' | 'desc';
type SortableKeys = 'id' | 'name' | 'state' | 'avgCpu' | 'maxCpu' | 'avgUserTime';

// State Mapping for Graph
const State_Levels: Record<string, number> = {
    RUNNABLE: 1, TIMED_WAITING: 2, WAITING: 3, BLOCKED: 4,
};

const getStateLabel = (value: number) => {
    return Object.keys(State_Levels).find(key => State_Levels[key] === value) || '';
};

// Stack Trace Viewer
const StackTraceViewer: React.FC<{ snapshot: ThreadSnapshot; index: number }> = ({ snapshot, index }) => (
    <Box sx={{ mt: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#555' }}>
                Dump {index + 1}
            </Typography>
            <Chip
                label={snapshot.state}
                size="small"
                color={snapshot.state === 'RUNNABLE' ? 'success' : snapshot.state === 'WAITING' ? 'info' : snapshot.state === 'BLOCKED' ? 'warning' : snapshot.state === 'TIMED_WAITING' ? 'secondary' : 'default'}
                variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
                CPU: {snapshot.cpu_percent ? snapshot.cpu_percent.toFixed(2) : 0}% | User Time: {snapshot.cpu_time_ms}ms
            </Typography>
        </Box>
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                bgcolor: '#0d1117',
                color: '#c9d1d9',
                fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                fontSize: '0.8rem',
                overflowX: 'auto',
                borderRadius: 2
            }}
        >
            <pre style={{ margin: 0 }}>
                {snapshot.stack_trace && snapshot.stack_trace.length > 0
                    ? snapshot.stack_trace.join('\n')
                    : "No stack trace available."}
            </pre>
        </Paper>
    </Box>
);

// Single Thread Row
interface ThreadRowProps {
    thread: Thread;
    stats: { lastState: string; avgCpu: number; maxCpu: number; avgUserTime: number };
}

const ThreadRow: React.FC<ThreadRowProps> = ({ thread, stats }) => {
    const [open, setOpen] = useState(false);

    // Prepare Chart Data
    const chartData = thread.snapshots.map((s, i) => ({
        x: i + 1,
        y: State_Levels[s.state] || 0.5
    }));

    return (
        <Paper sx={{ mb: 2, overflow: 'hidden' }} variant="outlined">
            <Box
                sx={{
                    p: 2,
                    cursor: 'pointer',
                    bgcolor: open ? '#f8f9fa' : 'white',
                    transition: 'background-color 0.2s'
                }}
                onClick={() => setOpen(!open)}
            >
                <Grid container spacing={2} alignItems="center">
                    {/* ID & Expand */}
                    <Grid size={{ xs: 2.5 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
                            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                {thread.id}
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Name */}
                    <Grid size={{ xs: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary" noWrap title={thread.name}>
                            {thread.name}
                        </Typography>
                    </Grid>

                    {/* State */}
                    <Grid size={{ xs: 1.5 }}>
                        <Chip
                            label={stats.lastState}
                            size="small"
                            color={stats.lastState === 'RUNNABLE' ? 'success' : stats.lastState === 'WAITING' ? 'info' : stats.lastState === 'BLOCKED' ? 'warning' : stats.lastState === 'TIMED_WAITING' ? 'secondary' : 'default'}
                        />
                    </Grid>

                    {/* Avg CPU */}
                    <Grid size={{ xs: 1.5 }}>
                        <Typography variant="body2" color="warning.main" fontWeight="bold">
                            {stats.avgCpu.toFixed(2)}%
                        </Typography>
                    </Grid>

                    {/* Max CPU */}
                    <Grid size={{ xs: 1.5 }}>
                        <Typography variant="body2" color="error.main" fontWeight="bold">
                            {stats.maxCpu.toFixed(2)}%
                        </Typography>
                    </Grid>

                    {/* Avg User Time */}
                    <Grid size={{ xs: 2 }}>
                        <Typography variant="body2">
                            {stats.avgUserTime.toFixed(0)}ms
                        </Typography>
                    </Grid>
                </Grid>
            </Box>

            <Collapse in={open} timeout="auto" unmountOnExit>
                <Box sx={{ p: 3, borderTop: '1px solid #eee' }}>
                    <Typography variant="h6" gutterBottom fontSize="1rem">Thread State Across Dumps</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: '#fff' }}>
                        <LineChart
                            height={250}
                            margin={{ left: 100, right: 30, top: 30, bottom: 30 }}
                            grid={{ horizontal: true }}
                            xAxis={[{
                                data: chartData.map(d => d.x),
                                label: 'Dump Sequence',
                                tickInterval: chartData.map(d => d.x)
                            }]}
                            yAxis={[{
                                min: 0.5, max: 4.5,
                                valueFormatter: (value: number | null) => value === null ? '' : getStateLabel(value),
                                tickInterval: [1, 2, 3, 4],
                            }]}
                            series={[{
                                data: chartData.map(d => d.y),
                                label: 'State',
                                curve: 'stepAfter',
                                color: '#ff6700',
                                area: false,
                                showMark: true,
                            }]}
                            sx={{ '.MuiChartsAxis-left .MuiChartsAxis-tickLabel': { fontWeight: 'bold', fontSize: '0.70rem', fill: '#555' } }}
                        />
                    </Paper>
                    <Typography variant="h6" gutterBottom fontSize="1rem">Snapshot Details</Typography>
                    {thread.snapshots.map((snap, idx) => (
                        <StackTraceViewer key={idx} snapshot={snap} index={idx} />
                    ))}
                </Box>
            </Collapse>
        </Paper>
    );
};

// Main Component
const ThreadExplorer: React.FC = () => {
    const { data } = useAnalysisData();
    const [selectedPool, setSelectedPool] = useState<string | null>(null);

    // Sorting State
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('maxCpu');

    // Grouping Logic
    const threadsByPool = useMemo(() => {
        if (!data) return {};
        const groups: Record<string, Thread[]> = {};
        data.threads.forEach(t => {
            const pool = t.thread_pool || "Uncategorized";
            if (!groups[pool]) groups[pool] = [];
            groups[pool].push(t);
        });
        return groups;
    }, [data]);

    // Auto-select first pool
    React.useEffect(() => {
        if (!selectedPool && Object.keys(threadsByPool).length > 0) {
            setSelectedPool(Object.keys(threadsByPool)[0]);
        }
    }, [threadsByPool, selectedPool]);

    // Sorting Logic
    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const sortedThreads = useMemo(() => {
        if (!selectedPool || !threadsByPool[selectedPool]) return [];

        const threadsWithStats = threadsByPool[selectedPool].map(thread => {
            // Stats for sorting
            const snapshots = thread.snapshots;
            const lastSnap = snapshots[snapshots.length - 1];
            const maxCpu = Math.max(...snapshots.map(s => s.cpu_percent || 0));
            const totalUserTime = snapshots.reduce((acc, s) => acc + (s.cpu_time_ms || 0), 0);
            const avgUserTime = snapshots.length > 0 ? (totalUserTime / snapshots.length) : 0;
            const avgCpu = lastSnap.cpu_percent || 0;

            return {
                data: thread,
                stats: {
                    id: thread.id,
                    name: thread.name,
                    state: lastSnap.state,
                    avgCpu,
                    maxCpu,
                    avgUserTime
                }
            };
        });

        return threadsWithStats.sort((a, b) => {
            let valueA: any = a.stats[orderBy];
            let valueB: any = b.stats[orderBy];

            // If both are strings then natural sort
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                const result = valueA.localeCompare(valueB, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                });

                return order === 'desc' ? -result : result;
            }

            // If both numeric then numeric sort
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return order === 'desc'
                    ? valueB - valueA
                    : valueA - valueB;
            }

            // Fallback
            if (valueA < valueB) return order === 'desc' ? 1 : -1;
            if (valueA > valueB) return order === 'desc' ? -1 : 1;
            return 0;
        });

    }, [threadsByPool, selectedPool, order, orderBy]);


    if (!data) {
        return (
            <Container sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">No analysis data found.</Typography>
            </Container>
        );
    }

    // Helper to create sort handlers
    const createSortHandler = (property: SortableKeys) => () => {
        handleRequestSort(property);
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* Thread Sidebar List */}
            <Paper
                elevation={3}
                sx={{
                    width: 280, flexShrink: 0, bgcolor: 'white',
                    borderRadius: 0, borderRight: '1px solid #eee', overflowY: 'auto'
                }}
            >
                <Box p={2} borderBottom="1px solid #eee">
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <LayersOutlinedIcon fontSize="small" />
                        <Typography variant="subtitle1" fontWeight="bold">Thread Groupings</Typography>
                    </Stack>
                </Box>
                <List component="nav">
                    {Object.keys(threadsByPool).map((pool) => (
                        <ListItemButton
                            key={pool}
                            selected={selectedPool === pool}
                            onClick={() => setSelectedPool(pool)}
                            sx={{
                                mb: 1, mx: 1, borderRadius: 1,
                                '&.Mui-selected': { bgcolor: '#fff3e0', color: '#e65100', borderLeft: '4px solid #ff9800' }
                            }}
                        >
                            <ListItemText
                                primary={pool}
                                secondary={`${threadsByPool[pool].length} threads`}
                                slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 500 } } }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Paper>

            {/* Main Content Area */}
            <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto', bgcolor: '#f8f9fa' }}>
                <Box mb={3}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>{selectedPool}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Showing {sortedThreads.length} threads in this pool
                    </Typography>
                </Box>

                {/* Header Row with Sort Labels */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: '#f1f3f4' }} elevation={0}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 2.5 }} sx={{ pl: 5 }}>
                            <TableSortLabel
                                active={orderBy === 'id'}
                                direction={orderBy === 'id' ? order : 'asc'}
                                onClick={createSortHandler('id')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">THREAD ID</Typography>
                            </TableSortLabel>
                        </Grid>
                        <Grid size={{ xs: 3 }}>
                            <TableSortLabel
                                active={orderBy === 'name'}
                                direction={orderBy === 'name' ? order : 'asc'}
                                onClick={createSortHandler('name')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">THREAD NAME</Typography>
                            </TableSortLabel>
                        </Grid>
                        <Grid size={{ xs: 1.5 }}>
                            <TableSortLabel
                                active={orderBy === 'state'}
                                direction={orderBy === 'state' ? order : 'asc'}
                                onClick={createSortHandler('state')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">LAST STATE</Typography>
                            </TableSortLabel>
                        </Grid>
                        <Grid size={{ xs: 1.5 }}>
                            <TableSortLabel
                                active={orderBy === 'avgCpu'}
                                direction={orderBy === 'avgCpu' ? order : 'asc'}
                                onClick={createSortHandler('avgCpu')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">AVG CPU (%)</Typography>
                            </TableSortLabel>
                        </Grid>
                        <Grid size={{ xs: 1.5 }}>
                            <TableSortLabel
                                active={orderBy === 'maxCpu'}
                                direction={orderBy === 'maxCpu' ? order : 'asc'}
                                onClick={createSortHandler('maxCpu')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">MAX CPU (%)</Typography>
                            </TableSortLabel>
                        </Grid>
                        <Grid size={{ xs: 2 }}>
                            <TableSortLabel
                                active={orderBy === 'avgUserTime'}
                                direction={orderBy === 'avgUserTime' ? order : 'asc'}
                                onClick={createSortHandler('avgUserTime')}
                            >
                                <Typography variant="caption" fontWeight="bold" color="textPrimary">AVG USER TIME</Typography>
                            </TableSortLabel>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Rows */}
                {sortedThreads.map(({ data, stats }) => (
                    <ThreadRow
                        key={data.id}
                        thread={data}
                        stats={{
                            lastState: stats.state,
                            avgCpu: stats.avgCpu,
                            maxCpu: stats.maxCpu,
                            avgUserTime: stats.avgUserTime
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default ThreadExplorer;