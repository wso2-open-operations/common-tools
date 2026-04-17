import React from 'react';
import { Box, Grid, Paper, Typography, Chip, CircularProgress as MuiCircularProgress, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { DashboardSummary } from '../types';

type HealthTier = 'excellent' | 'good' | 'fair' | 'poor';

function getHealthTier(score: number): HealthTier {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
}

function getHealthMeta(tier: HealthTier, theme: Theme): { label: string; labelColor: string; barColor: string } {
    const s = theme.palette.state;
    switch (tier) {
        case 'excellent':
            return { label: 'Excellent', labelColor: s.runnable.text, barColor: s.runnable.main };
        case 'good':
            return { label: 'Good', labelColor: s.runnable.text, barColor: s.runnable.main };
        case 'fair':
            return { label: 'Fair', labelColor: s.waiting.text, barColor: s.waiting.main };
        case 'poor':
            return { label: 'Poor', labelColor: s.blocked.text, barColor: s.blocked.main };
    }
}

const cardSx: SxProps<Theme> = (theme) => ({
    p: 2.5,
    borderRadius: 3,
    bgcolor: theme.palette.surface.translucent,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.surface.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    '&:hover': {
        boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.06)',
        borderColor: theme.palette.surface.borderStrong,
    },
});

interface SummaryCardsProps {
    summary: DashboardSummary;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const theme = useTheme();
    const healthTier = getHealthTier(summary.healthScore);
    const healthMeta = getHealthMeta(healthTier, theme);

    return (
        <Grid container spacing={2.5}>

            {/* Thread Count */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={(theme) => ({ fontWeight: 500, fontSize: '0.75rem', color: theme.palette.text.secondary })}>
                            Thread Count (Last Dump)
                        </Typography>
                        <Box
                            sx={(theme) => ({
                                width: 30,
                                height: 30,
                                borderRadius: 1.5,
                                bgcolor: theme.palette.state.new.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            })}
                        >
                            <ShowChartIcon sx={(theme) => ({ fontSize: 16, color: theme.palette.state.new.main })} />
                        </Box>
                    </Box>
                    <Typography
                        variant="h4"
                        fontWeight={700}
                        sx={(theme) => ({ mt: 0.75, mb: 1.25, color: theme.palette.text.primary })}
                    >
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
                            sx={(theme) => {
                                const tokens = summary.trendPercent! >= 0 ? theme.palette.state.runnable : theme.palette.state.blocked;
                                return {
                                    bgcolor: tokens.bg,
                                    color: tokens.text,
                                    fontWeight: 600,
                                    fontSize: '0.68rem',
                                    height: 22,
                                    borderRadius: 1.5,
                                };
                            }}
                        />
                    ) : (
                        <Typography variant="caption" sx={(theme) => ({ fontSize: '0.7rem', color: theme.palette.text.disabled })}>
                            Single snapshot
                        </Typography>
                    )}
                </Paper>
            </Grid>

            {/* Critical Issues */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={(theme) => ({ fontWeight: 500, fontSize: '0.75rem', color: theme.palette.text.secondary })}>
                            Critical Issues
                        </Typography>
                        <Box
                            sx={(theme) => {
                                const tokens = summary.criticalIssues > 0 ? theme.palette.state.blocked : theme.palette.state.runnable;
                                return {
                                    width: 30,
                                    height: 30,
                                    borderRadius: 1.5,
                                    bgcolor: tokens.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                };
                            }}
                        >
                            <ErrorOutlineIcon
                                sx={(theme) => ({
                                    fontSize: 16,
                                    color: summary.criticalIssues > 0 ? theme.palette.state.blocked.main : theme.palette.state.runnable.main,
                                })}
                            />
                        </Box>
                    </Box>
                    <Typography
                        variant="h4"
                        fontWeight={700}
                        sx={(theme) => ({
                            mt: 0.75,
                            mb: 1.25,
                            color: summary.criticalIssues > 0 ? theme.palette.state.blocked.text : theme.palette.text.primary,
                        })}
                    >
                        {summary.criticalIssues}
                    </Typography>
                    <Chip
                        label={summary.criticalIssues > 0 ? 'Requires attention' : 'All clear'}
                        size="small"
                        sx={(theme) => {
                            const tokens = summary.criticalIssues > 0 ? theme.palette.state.blocked : theme.palette.state.runnable;
                            return {
                                bgcolor: tokens.bg,
                                color: tokens.text,
                                fontWeight: 600,
                                fontSize: '0.68rem',
                                height: 22,
                                borderRadius: 1.5,
                            };
                        }}
                    />
                </Paper>
            </Grid>

            {/* Blocked Threads */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={(theme) => ({ fontWeight: 500, fontSize: '0.75rem', color: theme.palette.text.secondary })}>
                            Blocked Threads
                        </Typography>
                        <Box
                            sx={(theme) => {
                                const tokens = summary.blockedThreads > 0 ? theme.palette.state.waiting : theme.palette.state.runnable;
                                return {
                                    width: 30,
                                    height: 30,
                                    borderRadius: 1.5,
                                    bgcolor: tokens.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                };
                            }}
                        >
                            <PauseCircleOutlineIcon
                                sx={(theme) => ({
                                    fontSize: 16,
                                    color: summary.blockedThreads > 0 ? theme.palette.state.waiting.main : theme.palette.state.runnable.main,
                                })}
                            />
                        </Box>
                    </Box>
                    <Typography
                        variant="h4"
                        fontWeight={700}
                        sx={(theme) => ({ mt: 0.75, mb: 1.25, color: theme.palette.text.primary })}
                    >
                        {summary.blockedThreads}
                    </Typography>
                    <Chip
                        label={summary.blockedThreads > 0 ? 'Active contention' : 'No contention'}
                        size="small"
                        sx={(theme) => {
                            const tokens = summary.blockedThreads > 0 ? theme.palette.state.waiting : theme.palette.state.runnable;
                            return {
                                bgcolor: tokens.bg,
                                color: tokens.text,
                                fontWeight: 600,
                                fontSize: '0.68rem',
                                height: 22,
                                borderRadius: 1.5,
                            };
                        }}
                    />
                </Paper>
            </Grid>

            {/* Health Score */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={cardSx}>
                    <Typography variant="caption" sx={(theme) => ({ fontWeight: 500, fontSize: '0.75rem', color: theme.palette.text.secondary })}>
                        Health Score
                    </Typography>
                    <Box display="flex" flexDirection="column" alignItems="center" mt={0.75}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 0.75 }}>
                            <MuiCircularProgress
                                variant="determinate"
                                value={100}
                                size={76}
                                thickness={5}
                                sx={(theme) => ({
                                    color: theme.palette.surface.inset,
                                    position: 'absolute',
                                })}
                            />
                            <MuiCircularProgress
                                variant="determinate"
                                value={summary.healthScore}
                                size={76}
                                thickness={5}
                                sx={{ color: healthMeta.barColor }}
                            />
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography
                                    fontWeight={700}
                                    sx={(theme) => ({
                                        fontSize: '1rem',
                                        lineHeight: 1,
                                        color: theme.palette.text.primary,
                                    })}
                                >
                                    {summary.healthScore}%
                                </Typography>
                            </Box>
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{ color: healthMeta.labelColor, fontWeight: 600, fontSize: '0.75rem' }}
                        >
                            {healthMeta.label}
                        </Typography>
                    </Box>
                </Paper>
            </Grid>

        </Grid>
    );
};

export default SummaryCards;
