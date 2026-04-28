// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

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
