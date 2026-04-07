import React from 'react';
import { Box, Typography } from '@mui/material';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { BlockedThreadInfo } from '../../../utils/lockContentionAnalysis';

interface VictimRowProps {
    victim: BlockedThreadInfo;
    onThreadClick: (name: string) => void;
}

const VictimRow: React.FC<VictimRowProps> = ({ victim, onThreadClick }) => (
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
            {victim.waitTime && (
                <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    Waiting for {victim.waitTime}
                </Typography>
            )}
        </Box>
    </Box>
);

export default VictimRow;
