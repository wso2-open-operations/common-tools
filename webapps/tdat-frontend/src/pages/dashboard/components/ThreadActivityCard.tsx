import React from 'react';
import {
    Box, Paper, Typography, Chip, Tabs, Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import { tableHeadCellSx } from '../constants';
import type { ThreadCluster, LongRunningThread, HighCpuThread } from '../types';

interface ThreadActivityCardProps {
    threadClusters: ThreadCluster[];
    longRunningThreads: LongRunningThread[];
    highCpuThreads: HighCpuThread[];
    onThreadClick: (name: string) => void;
    activityTab: number;
    onTabChange: (tab: number) => void;
}

const ThreadActivityCard: React.FC<ThreadActivityCardProps> = ({
    threadClusters, longRunningThreads, highCpuThreads, onThreadClick, activityTab, onTabChange,
}) => {
    const theme = useTheme();
    const thSx = tableHeadCellSx(theme);

    return (
        <Paper
            sx={(theme) => ({
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${theme.palette.surface.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            })}
        >
            <Box sx={(theme) => ({ borderBottom: `1px solid ${theme.palette.surface.border}` })}>
                <Tabs
                    value={activityTab}
                    onChange={(_, v) => onTabChange(v)}
                    sx={(theme) => ({
                        px: 2,
                        minHeight: 46,
                        '& .MuiTab-root': {
                            minHeight: 46,
                            fontSize: '0.82rem',
                            textTransform: 'none',
                            fontWeight: 500,
                            gap: 0.75,
                            color: theme.palette.text.secondary,
                        },
                        '& .Mui-selected': { fontWeight: 700, color: `${theme.palette.text.primary} !important` },
                        '& .MuiTabs-indicator': { bgcolor: theme.palette.brand.main, height: 2.5, borderRadius: 2 },
                    })}
                >
                    <Tab icon={<LayersIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Thread Clusters" />
                    <Tab icon={<AccessTimeIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Long-Running Threads" />
                    <Tab icon={<SpeedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="High CPU Threads" />
                </Tabs>
            </Box>

            {activityTab === 0 && (
                <TableContainer sx={{ maxHeight: 420 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={thSx}>CLUSTER GROUP</TableCell>
                                <TableCell align="center" sx={{ ...thSx, width: 120 }}>THREAD COUNT</TableCell>
                                <TableCell align="center" sx={{ ...thSx, width: 160 }}>DOMINANT STATE</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {threadClusters.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                                        <Typography variant="caption" color="text.disabled" fontStyle="italic">
                                            No clusters detected — requires &gt;1 thread sharing the same top stack frame.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : threadClusters.map((cluster, idx) => (
                                <TableRow
                                    key={idx}
                                    hover
                                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                                    onClick={() => onThreadClick(cluster.threadNames[0])}
                                >
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            title={cluster.clusterName}
                                            sx={(theme) => ({
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 440,
                                            })}
                                        >
                                            {cluster.clusterName}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                                            {cluster.count}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <ThreadStateChip state={cluster.dominantState} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {activityTab === 1 && (
                <TableContainer sx={{ maxHeight: 420 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={thSx}>THREAD NAME</TableCell>
                                <TableCell align="center" sx={{ ...thSx, width: 160 }}>STATE</TableCell>
                                <TableCell align="right" sx={{ ...thSx, width: 160 }}>ELAPSED TIME</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {longRunningThreads.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                                        <Typography variant="caption" color="text.disabled" fontStyle="italic">
                                            No elapsed-time data available for this snapshot.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : longRunningThreads.map((t, idx) => (
                                <TableRow
                                    key={idx}
                                    hover
                                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                                    onClick={() => onThreadClick(t.threadName)}
                                >
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            title={t.threadName}
                                            sx={(theme) => ({
                                                fontFamily: 'monospace',
                                                fontSize: '0.78rem',
                                                color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 520,
                                            })}
                                        >
                                            {t.threadName}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <ThreadStateChip state={t.state} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            label={t.elapsedSeconds >= 1 ? `${Math.round(t.elapsedSeconds).toLocaleString()}s` : `${Math.round(t.elapsedSeconds * 1000)}ms`}
                                            size="small"
                                            sx={(theme) => {
                                                const high = t.elapsedSeconds > 3600;
                                                return {
                                                    bgcolor: high ? theme.palette.state.waiting.bg : theme.palette.state.terminated.bg,
                                                    color: high ? theme.palette.state.waiting.text : theme.palette.text.secondary,
                                                    fontWeight: 700,
                                                    fontSize: '0.72rem',
                                                    height: 22,
                                                    fontFamily: 'monospace',
                                                };
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {activityTab === 2 && (
                <TableContainer sx={{ maxHeight: 420 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={thSx}>THREAD NAME</TableCell>
                                <TableCell align="center" sx={{ ...thSx, width: 160 }}>STATE</TableCell>
                                <TableCell align="right" sx={{ ...thSx, width: 140 }}>CPU %</TableCell>
                                <TableCell align="right" sx={{ ...thSx, width: 140 }}>CPU TIME</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {highCpuThreads.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                                        <Typography variant="caption" color="text.disabled" fontStyle="italic">
                                            No CPU usage data available — upload thread dump with CPU metrics.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : highCpuThreads.map((t, idx) => (
                                <TableRow
                                    key={idx}
                                    hover
                                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                                    onClick={() => onThreadClick(t.threadName)}
                                >
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            title={t.threadName}
                                            sx={(theme) => ({
                                                fontFamily: 'monospace',
                                                fontSize: '0.78rem',
                                                color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 520,
                                            })}
                                        >
                                            {t.threadName}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <ThreadStateChip state={t.state} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            label={`${t.cpuPercent.toFixed(1)}%`}
                                            size="small"
                                            sx={(theme) => {
                                                const tier = t.cpuPercent > 50 ? theme.palette.state.blocked : t.cpuPercent > 20 ? theme.palette.state.waiting : theme.palette.state.terminated;
                                                return {
                                                    bgcolor: tier.bg,
                                                    color: t.cpuPercent > 20 ? tier.text : theme.palette.text.secondary,
                                                    fontWeight: 700,
                                                    fontSize: '0.72rem',
                                                    height: 22,
                                                    fontFamily: 'monospace',
                                                };
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            variant="body2"
                                            sx={(theme) => ({
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                color: theme.palette.text.secondary,
                                            })}
                                        >
                                            {t.cpuTimeMs >= 1000
                                                ? `${(t.cpuTimeMs / 1000).toFixed(1)}s`
                                                : `${Math.round(t.cpuTimeMs)}ms`}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

export default ThreadActivityCard;
