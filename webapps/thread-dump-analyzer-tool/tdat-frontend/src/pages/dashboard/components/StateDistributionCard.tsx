import React from 'react';
import { Box, Paper, Typography, Select, MenuItem, useTheme } from '@mui/material';
import { PieChart } from '@mui/x-charts';
import { STATE_ORDER, stateColors } from '../constants';

interface PieDataItem {
    id: number;
    value: number;
    color: string;
    label: string;
}

interface StateDistributionCardProps {
    dumpNames: string[];
    selectedDump: string;
    onDumpChange: (dump: string) => void;
    pieData: PieDataItem[];
    stateDistribution: Record<string, number>;
    totalSelectedThreads: number;
}

const StateDistributionCard: React.FC<StateDistributionCardProps> = ({
    dumpNames, selectedDump, onDumpChange, pieData, stateDistribution, totalSelectedThreads,
}) => {
    const theme = useTheme();
    const colors = stateColors(theme);

    return (
        <Paper
            sx={(theme) => ({
                flex: 7,
                p: 2.5,
                borderRadius: 3,
                minWidth: 0,
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${theme.palette.surface.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            })}
        >
            <Typography
                variant="subtitle2"
                fontWeight={700}
                mb={1.75}
                sx={(theme) => ({ color: theme.palette.text.primary })}
            >
                Thread State Distribution
            </Typography>

            {dumpNames.length > 0 && (
                <Box mb={2.5} display="flex" alignItems="center" gap={1}>
                    <Typography
                        variant="caption"
                        sx={(theme) => ({ fontWeight: 500, flexShrink: 0, color: theme.palette.text.secondary })}
                    >
                        Snapshot:
                    </Typography>
                    <Select
                        value={dumpNames.includes(selectedDump) ? selectedDump : (dumpNames[0] || '')}
                        onChange={(e) => { if (e.target.value) onDumpChange(e.target.value); }}
                        size="small"
                        sx={(theme) => ({
                            minWidth: 220,
                            height: 36,
                            bgcolor: theme.palette.surface.muted,
                            fontSize: '0.8rem',
                            borderRadius: 2,
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.border },
                        })}
                    >
                        {dumpNames.map((name) => (
                            <MenuItem key={name} value={name} sx={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
                                <Box display="flex" alignItems="center" gap={1}>{name}</Box>
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            )}

            {totalSelectedThreads > 0 ? (
                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                    <Box sx={{ position: 'relative', flexShrink: 0, width: 240, height: 240 }}>
                        <PieChart
                            series={[{ data: pieData, innerRadius: 68, outerRadius: 108, paddingAngle: 2, cornerRadius: 3 }]}
                            width={240}
                            height={240}
                            sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
                            margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1 }}>
                                {totalSelectedThreads.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', letterSpacing: '0.1em', mt: 0.3 }}>
                                THREADS
                            </Typography>
                        </Box>
                    </Box>

                    <Box flex={1} minWidth={150}>
                        {STATE_ORDER.map(state => {
                            const count = stateDistribution[state] ?? 0;
                            const pct = totalSelectedThreads > 0 ? Math.round(count / totalSelectedThreads * 100) : 0;
                            return (
                                <Box
                                    key={state}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    py={0.9}
                                    sx={(theme) => ({
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        '&:last-child': { borderBottom: 0 },
                                    })}
                                >
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[state], flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{state}</Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                        <Typography
                                            variant="body2"
                                            fontWeight={700}
                                            sx={(theme) => ({ fontSize: '0.8rem', color: theme.palette.text.primary, minWidth: 52, textAlign: 'right' })}
                                        >
                                            {count.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34, textAlign: 'right', fontSize: '0.75rem' }}>
                                            {pct}%
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            ) : (
                <Typography variant="caption" color="text.disabled" fontStyle="italic">
                    No thread data available for this snapshot.
                </Typography>
            )}
        </Paper>
    );
};

export default StateDistributionCard;
