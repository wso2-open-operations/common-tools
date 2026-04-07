import React, { useState } from 'react';
import { Box, Paper, Typography, Collapse, IconButton } from '@mui/material';
import Grid from '@mui/material/Grid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { LineChart } from '@mui/x-charts/LineChart';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import StackTraceViewer from '@component/ui/StackTraceViewer';
import type { Thread } from '@/types/api';

// State value mapping for the per-thread line chart
const STATE_LEVELS: Record<string, number> = {
    RUNNABLE: 1, TIMED_WAITING: 2, WAITING: 3, BLOCKED: 4,
};

const getStateLabel = (value: number) =>
    Object.keys(STATE_LEVELS).find(key => STATE_LEVELS[key] === value) || '';

export interface ThreadRowStats {
    lastState: string;
    avgCpu: number;
    maxCpu: number;
    avgUserTime: number;
}

interface ThreadRowProps {
    thread: Thread;
    stats: ThreadRowStats;
}

const ThreadRow: React.FC<ThreadRowProps> = ({ thread, stats }) => {
    const [open, setOpen] = useState(false);

    const chartData = thread.snapshots.map((s, i) => ({
        x: i + 1,
        y: STATE_LEVELS[s.state] || 0.5,
    }));

    return (
        <Paper sx={{ mb: 2, overflow: 'hidden' }} variant="outlined">
            <Box
                sx={{
                    p: 2,
                    cursor: 'pointer',
                    bgcolor: open ? '#f8f9fa' : 'white',
                    transition: 'background-color 0.2s',
                }}
                onClick={() => setOpen(!open)}
            >
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 2.25 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
                            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                {thread.id}
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 3.25 }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary" noWrap title={thread.name}>
                            {thread.name}
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <ThreadStateChip state={stats.lastState} />
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <Typography variant="body2" color="warning.main" fontWeight="bold">
                            {stats.avgCpu.toFixed(2)}%
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <Typography variant="body2" color="error.main" fontWeight="bold">
                            {stats.maxCpu.toFixed(2)}%
                        </Typography>
                    </Grid>

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
                                tickInterval: chartData.map(d => d.x),
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

export default ThreadRow;
