import React from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { parseBlocks, renderBlocks } from '@component/ui/aiMarkdown';
import { useNavigateToThread } from '@hooks/useNavigateToThread';
import type { AIInsights } from '@/types/api';

interface AIInsightsCardProps {
    aiInsights: AIInsights | undefined;
}

const infoIcon = <InfoOutlinedIcon sx={{ fontSize: 13, color: 'inherit' }} />;
const lightbulbIcon = <LightbulbOutlinedIcon sx={{ fontSize: 13, color: 'inherit' }} />;

const AIInsightsCard: React.FC<AIInsightsCardProps> = ({ aiInsights }) => {
    const navigateToThread = useNavigateToThread();

    return (
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
                    <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
                        <InfoOutlinedIcon sx={(theme) => ({ fontSize: 14, color: theme.palette.severity.info.main })} />
                        <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={(theme) => ({ color: theme.palette.severity.info.text })}
                        >
                            Pattern Recognition
                        </Typography>
                    </Box>

                    <Box mb={2} sx={{ whiteSpace: 'pre-wrap' }}>
                        {aiInsights.pattern_recognition
                            ? renderBlocks(parseBlocks(aiInsights.pattern_recognition), {
                                listIcon: infoIcon,
                                onThreadClick: navigateToThread,
                            })
                            : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                        }
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
                        <LightbulbOutlinedIcon sx={(theme) => ({ fontSize: 14, color: theme.palette.severity.recommendation.main })} />
                        <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={(theme) => ({ color: theme.palette.severity.recommendation.text })}
                        >
                            Recommended Actions
                        </Typography>
                    </Box>

                    <Box sx={{ whiteSpace: 'pre-wrap' }}>
                        {aiInsights.recommended_actions
                            ? renderBlocks(parseBlocks(aiInsights.recommended_actions), {
                                listIcon: lightbulbIcon,
                                onThreadClick: navigateToThread,
                            })
                            : <Typography variant="caption" color="text.disabled" fontStyle="italic">—</Typography>
                        }
                    </Box>
                </>
            )}
        </Paper>
    );
};

export default AIInsightsCard;
