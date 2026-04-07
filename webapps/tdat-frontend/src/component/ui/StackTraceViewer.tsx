import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import type { ThreadSnapshot } from '@/types/api';

interface Props {
    snapshot: ThreadSnapshot;
    index: number;
}

const StackTraceViewer: React.FC<Props> = ({ snapshot, index }) => {
    const displayState = snapshot.state || 'N/A';

    return (
        <Box sx={{ mt: 2, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#555' }}>
                    Dump {index + 1}
                </Typography>
                <Chip
                    label={displayState}
                    size="small"
                    color={
                        displayState === 'RUNNABLE' ? 'success' :
                            displayState === 'WAITING' ? 'info' :
                                displayState === 'BLOCKED' ? 'error' :
                                    displayState === 'TIMED_WAITING' ? 'secondary' : 'default'
                    }
                    variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                    CPU: {snapshot.cpu_percent ? snapshot.cpu_percent.toFixed(2) : 0}% | User Time: {snapshot.cpu_time_ms || 0}ms
                </Typography>
            </Box>
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    bgcolor: '#0d1117',
                    color: '#c9d1d9',
                    fontFamily: 'Consolas, Monaco, "Andale Mono"',
                    fontSize: '0.8rem',
                    overflowX: 'auto',
                    borderRadius: 2,
                }}
            >
                <pre style={{ margin: 0 }}>
                    {snapshot.stack_trace && snapshot.stack_trace.length > 0
                        ? snapshot.stack_trace.join('\n')
                        : 'No stack trace available.'}
                </pre>
            </Paper>
        </Box>
    );
};

export default StackTraceViewer;
