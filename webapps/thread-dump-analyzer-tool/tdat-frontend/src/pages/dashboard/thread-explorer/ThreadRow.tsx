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

    const sortedSnapshots = useMemo(
        () => [...thread.snapshots].sort((a, b) =>
            a.dump_name.localeCompare(b.dump_name, undefined, { numeric: true, sensitivity: 'base' })
        ),
        [thread.snapshots]
    );

    const chartData = sortedSnapshots.map((s, i) => ({
        x: i + 1,
        y: STATE_LEVELS[s.state] || 0.5,
    }));

    return (
        <Paper
            sx={(theme) => ({
                mb: 2,
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${theme.palette.surface.border}`,
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s',
                '&:hover': {
                    boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.06)',
                },
            })}
        >
            <Box
                sx={(theme) => ({
                    p: 2,
                    cursor: 'pointer',
                    bgcolor: open ? theme.palette.surface.muted : 'transparent',
                    transition: 'background-color 0.2s',
                })}
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
                        <Typography
                            variant="subtitle2"
                            fontWeight="bold"
                            noWrap
                            title={thread.name}
                            sx={(theme) => ({ color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary })}
                        >
                            {thread.name}
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <ThreadStateChip state={stats.lastState} />
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={(theme) => ({ color: theme.palette.state.waiting.text })}
                        >
                            {stats.avgCpu.toFixed(2)}%
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 1.5 }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={(theme) => ({ color: theme.palette.state.blocked.text })}
                        >
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
                <Box sx={(theme) => ({ p: 3, borderTop: `1px solid ${theme.palette.surface.border}` })}>
                    <Typography variant="h6" gutterBottom fontSize="1rem">Thread State Across Dumps</Typography>
                    <Paper
                        variant="outlined"
                        sx={(theme) => ({
                            p: 2,
                            mb: 4,
                            bgcolor: theme.palette.background.paper,
                            borderColor: theme.palette.surface.border,
                        })}
                    >
                        <LineChart
                            height={250}
                            margin={{ left: 120, right: 80, top: 30, bottom: 50 }}
                            grid={{ horizontal: true }}
                            xAxis={[{
                                data: chartData.map(d => d.x),
                                label: 'Thread Dumps',
                                tickInterval: chartData.map(d => d.x),
                                valueFormatter: (value: number) => sortedSnapshots[value - 1]?.dump_name ?? `Dump ${value}`,
                            }]}
                            yAxis={[{
                                min: 0.5, max: 4.5,
                                width: 110,
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
                                valueFormatter: (value: number | null) => value === null ? '' : getStateLabel(value),
                            }]}
                            sx={(theme) => ({
                                '.MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
                                    fontWeight: 'bold',
                                    fontSize: '0.70rem',
                                    fill: theme.palette.text.secondary,
                                },
                                '.MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
                                    fill: theme.palette.text.secondary,
                                },
                                '.MuiChartsAxis-line, .MuiChartsAxis-tick': {
                                    stroke: theme.palette.surface.border,
                                },
                                '.MuiChartsGrid-line': {
                                    stroke: theme.palette.surface.border,
                                },
                            })}
                        />
                    </Paper>
                    <Typography variant="h6" gutterBottom fontSize="1rem">Snapshot Details</Typography>
                    {sortedSnapshots.map((snap, idx) => (
                        <StackTraceViewer key={idx} snapshot={snap} index={idx} dumpName={snap.dump_name} />
                    ))}
                </Box>
            </Collapse>
        </Paper>
    );
};

export default ThreadRow;
