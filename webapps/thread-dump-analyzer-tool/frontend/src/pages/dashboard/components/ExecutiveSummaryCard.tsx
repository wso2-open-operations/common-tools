// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
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
import { Box, Paper, Typography } from '@mui/material';
import { parseBlocks, renderBlocks } from '@component/ui/aiMarkdown';
import type { AiInsights } from '@/types/api';

interface ExecutiveSummaryCardProps {
    aiInsights: AiInsights | undefined;
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

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, whiteSpace: 'pre-wrap' }}>
            {!aiInsights ? (
                <Typography variant="caption" color="text.secondary" fontStyle="italic">
                    Executive summary unavailable: ensure ANTHROPIC_API_KEY is set and a valid dump was uploaded.
                </Typography>
            ) : (
                aiInsights.executive_summary
                    ? renderBlocks(parseBlocks(aiInsights.executive_summary), {
                        highlightBoldParagraphs: true,
                        emphasizeFirstParagraph: true,
                    })
                    : <Typography variant="caption" color="text.secondary" fontStyle="italic">-</Typography>
            )}
        </Box>
    </Paper>
);

export default ExecutiveSummaryCard;
