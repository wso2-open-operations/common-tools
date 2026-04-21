import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { parseBlocks, renderBlocks } from '@component/ui/aiMarkdown';
import type { AIInsights } from '@/types/api';

interface ExecutiveSummaryCardProps {
    aiInsights: AIInsights | undefined;
}

const ExecutiveSummaryCard: React.FC<ExecutiveSummaryCardProps> = ({ aiInsights }) => (
    <Paper
        sx={(theme) => ({
            p: 2.5,
            borderRadius: 3,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.palette.surface.translucent,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${theme.palette.surface.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        })}
    >
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="subtitle2" fontWeight={700}>Executive Summary</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            High-level synthesis of the most critical findings from this thread dump analysis
        </Typography>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {!aiInsights ? (
                <Typography variant="caption" color="text.disabled" fontStyle="italic">
                    Executive summary unavailable — ensure GROQ_API_KEY is set and a valid dump was uploaded.
                </Typography>
            ) : (
                aiInsights.executive_summary
                    ? renderBlocks(parseBlocks(aiInsights.executive_summary), {
                        highlightBoldParagraphs: true,
                        emphasizeFirstParagraph: true,
                    })
                    : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
            )}
        </Box>
    </Paper>
);

export default ExecutiveSummaryCard;
