import React from 'react';
import { Box, Grid, Paper, Typography, Chip, CircularProgress as MuiCircularProgress } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { DashboardSummary } from '../types';

function getHealthMeta(score: number): { label: string; labelColor: string; barColor: string } {
    if (score >= 90) return { label: 'Excellent', labelColor: '#2e7d32', barColor: '#43a047' };
    if (score >= 75) return { label: 'Good', labelColor: '#388e3c', barColor: '#43a047' };
    if (score >= 50) return { label: 'Fair', labelColor: '#f57c00', barColor: '#ff9800' };
    return { label: 'Poor', labelColor: '#c62828', barColor: '#e53935' };
}

const cardSx = {
    p: 2.5,
    borderRadius: 3,
    bgcolor: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    '&:hover': {
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        borderColor: 'rgba(0,0,0,0.1)',
    },
} as const;

interface SummaryCardsProps {
    summary: DashboardSummary;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const { label: healthLabel, labelColor: healthLabelColor, barColor: healthBarColor } = getHealthMeta(summary.healthScore);

    return (
        <Grid container spacing={2.5}>

            {/* Thread Count */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem', color: '#6b7280' }}>
                            Thread Count (Last Dump)
                        </Typography>
                        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShowChartIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
                        </Box>
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111827' }}>
                        {summary.threadCount.toLocaleString()}
                    </Typography>
                    {summary.trendPercent !== null ? (
                        <Chip
                            icon={
                                summary.trendPercent >= 0
                                    ? <TrendingUpIcon sx={{ fontSize: '14px !important' }} />
                                    : <TrendingDownIcon sx={{ fontSize: '14px !important' }} />
                            }
                            label={`${summary.trendPercent >= 0 ? '+' : ''}${summary.trendPercent}% vs previous`}
                            size="small"
                            sx={{
                                bgcolor: summary.trendPercent >= 0 ? '#f0fdf4' : '#fef2f2',
                                color: summary.trendPercent >= 0 ? '#16a34a' : '#dc2626',
                                fontWeight: 600, fontSize: '0.68rem', height: 22, borderRadius: 1.5,
                            }}
                        />
                    ) : (
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                            Single snapshot
                        </Typography>
                    )}
                </Paper>
            </Grid>

            {/* Critical Issues */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem', color: '#6b7280' }}>
                            Critical Issues
                        </Typography>
                        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: summary.criticalIssues > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ErrorOutlineIcon sx={{ fontSize: 16, color: summary.criticalIssues > 0 ? '#ef4444' : '#22c55e' }} />
                        </Box>
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: summary.criticalIssues > 0 ? '#dc2626' : '#111827' }}>
                        {summary.criticalIssues}
                    </Typography>
                    <Chip
                        label={summary.criticalIssues > 0 ? 'Requires attention' : 'All clear'}
                        size="small"
                        sx={{
                            bgcolor: summary.criticalIssues > 0 ? '#fef2f2' : '#f0fdf4',
                            color: summary.criticalIssues > 0 ? '#dc2626' : '#16a34a',
                            fontWeight: 600, fontSize: '0.68rem', height: 22, borderRadius: 1.5,
                        }}
                    />
                </Paper>
            </Grid>

            {/* Blocked Threads */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem', color: '#6b7280' }}>
                            Blocked Threads
                        </Typography>
                        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: summary.blockedThreads > 0 ? '#fff7ed' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PauseCircleOutlineIcon sx={{ fontSize: 16, color: summary.blockedThreads > 0 ? '#f59e0b' : '#22c55e' }} />
                        </Box>
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111827' }}>
                        {summary.blockedThreads}
                    </Typography>
                    <Chip
                        label={summary.blockedThreads > 0 ? 'Active contention' : 'No contention'}
                        size="small"
                        sx={{
                            bgcolor: summary.blockedThreads > 0 ? '#fff7ed' : '#f0fdf4',
                            color: summary.blockedThreads > 0 ? '#ea580c' : '#16a34a',
                            fontWeight: 600, fontSize: '0.68rem', height: 22, borderRadius: 1.5,
                        }}
                    />
                </Paper>
            </Grid>

            {/* Health Score */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem', color: '#6b7280' }}>
                        Health Score
                    </Typography>
                    <Box display="flex" flexDirection="column" alignItems="center" mt={0.75}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 0.75 }}>
                            <MuiCircularProgress variant="determinate" value={100} size={76} thickness={5} sx={{ color: '#f3f4f6', position: 'absolute' }} />
                            <MuiCircularProgress variant="determinate" value={summary.healthScore} size={76} thickness={5} sx={{ color: healthBarColor }} />
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography fontWeight={700} sx={{ fontSize: '1rem', lineHeight: 1, color: '#111827' }}>
                                    {summary.healthScore}%
                                </Typography>
                            </Box>
                        </Box>
                        <Typography variant="caption" sx={{ color: healthLabelColor, fontWeight: 600, fontSize: '0.75rem' }}>
                            {healthLabel}
                        </Typography>
                    </Box>
                </Paper>
            </Grid>

        </Grid>
    );
};

export default SummaryCards;
