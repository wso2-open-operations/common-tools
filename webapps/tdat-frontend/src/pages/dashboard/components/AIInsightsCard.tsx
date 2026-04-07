import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { AIInsights } from '@/types/api';

interface AIInsightsCardProps {
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

const AIInsightsCard: React.FC<AIInsightsCardProps> = ({ aiInsights }) => (
    <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, borderColor: '#E0E0E0', position: 'sticky', top: 24 }}
    >
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <AutoAwesomeIcon sx={{ fontSize: 20, color: '#ff6d00' }} />
            <Typography variant="subtitle2" fontWeight={700}>AI Insights</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            AI analysis and recommendations based on detected patterns and anomalies in the thread dump data
        </Typography>

        {!aiInsights ? (
            <Typography variant="caption" color="text.disabled" fontStyle="italic">
                AI insights unavailable — ensure GROQ_API_KEY is set and a valid dump was uploaded.
            </Typography>
        ) : (
            <>
                <Box sx={{ borderLeft: '3px solid #90caf9', backgroundColor: '#e3f2fd', p: 2, borderRadius: '0 8px 8px 0', mb: 2 }}>
                    <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="#1565c0">
                        Pattern Recognition
                    </Typography>
                    {aiInsights.pattern_recognition
                        ? renderFormattedText(aiInsights.pattern_recognition)
                        : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                    }
                </Box>

                <Box sx={{ borderLeft: '3px solid #ffe082', backgroundColor: '#fff8e1', p: 2, borderRadius: '0 8px 8px 0' }}>
                    <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="#e65100">
                        Recommended Actions
                    </Typography>
                    {aiInsights.recommended_actions
                        ? renderFormattedText(aiInsights.recommended_actions)
                        : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                    }
                </Box>
            </>
        )}
    </Paper>
);

export default AIInsightsCard;
