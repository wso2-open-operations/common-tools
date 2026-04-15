import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { AIInsights } from '@/types/api';

interface ExecutiveSummaryCardProps {
    aiInsights: AIInsights | undefined;
}

function renderFormattedText(text: string): React.ReactNode {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    return (
        <Box>
            {lines.map((line, i) => {
                const parts = line.split('**');
                return (
                    <Typography
                        key={i}
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ lineHeight: 1.7, mb: 0.5 }}
                    >
                        {parts.map((part, j) =>
                            j % 2 === 1
                                ? <strong key={j}>{part}</strong>
                                : part
                        )}
                    </Typography>
                );
            })}
        </Box>
    );
}

const ExecutiveSummaryCard: React.FC<ExecutiveSummaryCardProps> = ({ aiInsights }) => (
    <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="subtitle2" fontWeight={700}>Executive Summary</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            High-level synthesis of the most critical findings from this thread dump analysis
        </Typography>

        {!aiInsights ? (
            <Typography variant="caption" color="text.disabled" fontStyle="italic">
                Executive summary unavailable — ensure GROQ_API_KEY is set and a valid dump was uploaded.
            </Typography>
        ) : (
            <Box sx={{ borderLeft: '3px solid #ef9a9a', backgroundColor: '#fce4ec', p: 2, borderRadius: '0 8px 8px 0' }}>
                {aiInsights.executive_summary
                    ? renderFormattedText(aiInsights.executive_summary)
                    : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                }
            </Box>
        )}
    </Paper>
);

export default ExecutiveSummaryCard;
