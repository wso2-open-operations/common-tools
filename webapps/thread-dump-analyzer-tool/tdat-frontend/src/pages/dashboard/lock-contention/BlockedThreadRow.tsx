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
import { Box, ButtonBase, Chip, Typography, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { BlockedThreadInfo } from '../../../utils/lockContentionAnalysis';

// Severity mapping: ≥1 min = critical, ≥10s = high, ≥1s = medium, <1s = success (normal wait)
function getWaitSeverity(ms: number, theme: Theme): { bg: string; color: string } {
    if (ms >= 60_000) return { bg: theme.palette.severity.critical.bg, color: theme.palette.severity.critical.text };
    if (ms >= 10_000) return { bg: theme.palette.severity.high.bg, color: theme.palette.severity.high.text };
    if (ms >= 1_000) return { bg: theme.palette.severity.medium.bg, color: theme.palette.severity.medium.text };
    return { bg: theme.palette.severity.success.bg, color: theme.palette.severity.success.text };
}

function formatWaitTime(ms: number): string {
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

interface BlockedThreadRowProps {
    blockedThread: BlockedThreadInfo;
    onThreadClick: (name: string) => void;
}

const BlockedThreadRow: React.FC<BlockedThreadRowProps> = ({ blockedThread, onThreadClick }) => {
    const theme = useTheme();
    const hasWaitTime = blockedThread.waitTimeMs > 0;
    const severity = hasWaitTime ? getWaitSeverity(blockedThread.waitTimeMs, theme) : null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75 }}>
            <ButtonBase
                onClick={() => onThreadClick(blockedThread.thread.name)}
                sx={(theme) => ({
                    flex: 1,
                    minWidth: 0,
                    justifyContent: 'flex-start',
                    '&:focus-visible': { outline: `2px solid ${theme.palette.accent.link}`, outlineOffset: 2 },
                })}
            >
                <Typography
                    variant="body2"
                    sx={(theme) => ({
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                        '&:hover': { textDecoration: 'underline' },
                        '&:focus-visible': { outline: `2px solid ${theme.palette.accent.link}`, outlineOffset: 2 },
                    })}
                >
                    {blockedThread.thread.name}
                </Typography>
            </ButtonBase>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
                <ThreadStateChip state={blockedThread.snapshot.state} />
                {hasWaitTime && severity && (
                    <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: `${severity.color} !important` }} />}
                        label={formatWaitTime(blockedThread.waitTimeMs)}
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

export default BlockedThreadRow;