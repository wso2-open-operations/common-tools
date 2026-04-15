import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { BlockedThreadInfo } from '../../../utils/lockContentionAnalysis';

function getWaitSeverity(ms: number): { bg: string; color: string } {
    if (ms >= 60_000) return { bg: '#fef2f2', color: '#dc2626' };
    if (ms >= 10_000) return { bg: '#fff7ed', color: '#ea580c' };
    if (ms >= 1_000) return { bg: '#fefce8', color: '#ca8a04' };
    return { bg: '#f0fdf4', color: '#16a34a' };
}

function formatWaitTime(ms: number): string {
    if (ms >= 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

interface VictimRowProps {
    victim: BlockedThreadInfo;
    onThreadClick: (name: string) => void;
}

const VictimRow: React.FC<VictimRowProps> = ({ victim, onThreadClick }) => {
    const hasWaitTime = victim.waitTimeMs > 0;
    const severity = hasWaitTime ? getWaitSeverity(victim.waitTimeMs) : null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75 }}>
            <Typography
                variant="body2"
                onClick={() => onThreadClick(victim.thread.name)}
                sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: '#1565c0',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': { textDecoration: 'underline' },
                }}
            >
                {victim.thread.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
                <ThreadStateChip state={victim.snapshot.state} />
                {hasWaitTime && severity && (
                    <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: `${severity.color} !important` }} />}
                        label={formatWaitTime(victim.waitTimeMs)}
                        size="small"
                        sx={{
                            bgcolor: severity.bg,
                            color: severity.color,
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            height: 22,
                            borderRadius: 1.5,
                            fontFamily: 'monospace',
                            '& .MuiChip-icon': { ml: '4px' },
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default VictimRow;
