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
        sx={(theme) => ({
            p: 2.5,
            borderRadius: 3,
            position: 'sticky',
            top: 24,
            bgcolor: theme.palette.surface.translucent,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${theme.palette.surface.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        })}
    >
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <AutoAwesomeIcon sx={(theme) => ({ fontSize: 20, color: theme.palette.brand.main })} />
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
                <Box
                    sx={(theme) => ({
                        borderLeft: `3px solid ${theme.palette.severity.info.border}`,
                        backgroundColor: theme.palette.severity.info.bg,
                        p: 2,
                        borderRadius: '0 8px 8px 0',
                        mb: 2,
                    })}
                >
                    <Typography
                        variant="caption"
                        fontWeight={700}
                        display="block"
                        mb={0.75}
                        sx={(theme) => ({ color: theme.palette.severity.info.text })}
                    >
                        Pattern Recognition
                    </Typography>
                    {aiInsights.pattern_recognition
                        ? renderFormattedText(aiInsights.pattern_recognition)
                        : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                    }
                </Box>

                <Box
                    sx={(theme) => ({
                        borderLeft: `3px solid ${theme.palette.severity.recommendation.border}`,
                        backgroundColor: theme.palette.severity.recommendation.bg,
                        p: 2,
                        borderRadius: '0 8px 8px 0',
                    })}
                >
                    <Typography
                        variant="caption"
                        fontWeight={700}
                        display="block"
                        mb={0.75}
                        sx={(theme) => ({ color: theme.palette.severity.recommendation.text })}
                    >
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
