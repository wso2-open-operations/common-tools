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
import { Box, Chip, Typography, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { BlockedThreadInfo } from '../../../utils/lockContentionAnalysis';

function getWaitSeverity(ms: number, theme: Theme): { bg: string; color: string } {
    if (ms >= 60_000) return { bg: theme.palette.severity.critical.bg, color: theme.palette.severity.critical.text };
    if (ms >= 10_000) return { bg: theme.palette.severity.high.bg, color: theme.palette.severity.high.text };
    if (ms >= 1_000) return { bg: theme.palette.severity.medium.bg, color: theme.palette.severity.medium.text };
    return { bg: theme.palette.severity.success.bg, color: theme.palette.severity.success.text };
}

function formatWaitTime(ms: number): string {
    if (ms >= 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

interface VictimRowProps {
    victim: BlockedThreadInfo;
    onThreadClick: (name: string) => void;
}

const VictimRow: React.FC<VictimRowProps> = ({ victim, onThreadClick }) => {
    const theme = useTheme();
    const hasWaitTime = victim.waitTimeMs > 0;
    const severity = hasWaitTime ? getWaitSeverity(victim.waitTimeMs, theme) : null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75 }}>
            <Typography
                variant="body2"
                onClick={() => onThreadClick(victim.thread.name)}
                sx={(theme) => ({
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': { textDecoration: 'underline' },
                })}
            >
                {victim.thread.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
                <ThreadStateChip state={victim.snapshot.state} />
                {hasWaitTime && severity && (
                    <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: `${severity.color} !important` }} />}
                        label={formatWaitTime(victim.waitTimeMs)}
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

export default VictimRow;
