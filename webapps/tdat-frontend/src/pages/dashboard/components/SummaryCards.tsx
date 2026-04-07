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

interface SummaryCardsProps {
    summary: DashboardSummary;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const { label: healthLabel, labelColor: healthLabelColor, barColor: healthBarColor } = getHealthMeta(summary.healthScore);

    return (
        <Grid container spacing={2}>

            {/* Thread Count */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                            Thread Count (Last Dump)
                        </Typography>
                        <ShowChartIcon sx={{ fontSize: 18, color: '#42a5f5' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111' }}>
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
                                bgcolor: summary.trendPercent >= 0 ? '#e8f5e9' : '#ffebee',
                                color: summary.trendPercent >= 0 ? '#2e7d32' : '#c62828',
                                fontWeight: 600, fontSize: '0.68rem', height: 22,
                            }}
                        />
                    ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                            Single snapshot
                        </Typography>
                    )}
                </Paper>
            </Grid>

            {/* Critical Issues */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                            Critical Issues
                        </Typography>
                        <ErrorOutlineIcon sx={{ fontSize: 18, color: '#e53935' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: summary.criticalIssues > 0 ? '#e53935' : '#111' }}>
                        {summary.criticalIssues}
                    </Typography>
                    <Chip
                        label={summary.criticalIssues > 0 ? 'Requires attention' : 'All clear'}
                        size="small"
                        sx={{
                            bgcolor: summary.criticalIssues > 0 ? '#ffebee' : '#e8f5e9',
                            color: summary.criticalIssues > 0 ? '#c62828' : '#2e7d32',
                            fontWeight: 600, fontSize: '0.68rem', height: 22,
                        }}
                    />
                </Paper>
            </Grid>

            {/* Blocked Threads */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                            Blocked Threads
                        </Typography>
                        <PauseCircleOutlineIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111' }}>
                        {summary.blockedThreads}
                    </Typography>
                    <Chip
                        label={summary.blockedThreads > 0 ? 'Active contention' : 'No contention'}
                        size="small"
                        sx={{
                            bgcolor: summary.blockedThreads > 0 ? '#fff3e0' : '#e8f5e9',
                            color: summary.blockedThreads > 0 ? '#e65100' : '#2e7d32',
                            fontWeight: 600, fontSize: '0.68rem', height: 22,
                        }}
                    />
                </Paper>
            </Grid>

            {/* Health Score */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                        Health Score
                    </Typography>
                    <Box display="flex" flexDirection="column" alignItems="center" mt={0.75}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 0.75 }}>
                            <MuiCircularProgress variant="determinate" value={100} size={76} thickness={5} sx={{ color: '#e0e0e0', position: 'absolute' }} />
                            <MuiCircularProgress variant="determinate" value={summary.healthScore} size={76} thickness={5} sx={{ color: healthBarColor }} />
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography fontWeight={700} sx={{ fontSize: '1rem', lineHeight: 1 }}>
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
