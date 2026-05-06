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
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { LockOwnerEntry } from '../../../utils/lockContentionAnalysis';
import MonitorSection from './MonitorSection';

interface LockOwnerAccordionProps {
    entry: LockOwnerEntry;
    onThreadClick: (name: string) => void;
}

const LockOwnerAccordion: React.FC<LockOwnerAccordionProps> = ({ entry, onThreadClick }) => {
    const monitorCount = entry.heldLocks.length;
    const blockedCount = entry.totalBlocked;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={(theme) => ({
                mb: 1.5,
                border: `1px solid ${theme.palette.surface.border}`,
                borderRadius: '12px !important',
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1.5 },
            })}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={(theme) => ({ color: theme.palette.text.disabled })} />}
                sx={{
                    px: 2,
                    minHeight: 48,
                    '& .MuiAccordionSummary-content': {
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        my: 0.75,
                    },
                }}
            >
                <Typography
                    variant="body2"
                    onClick={(e) => { e.stopPropagation(); onThreadClick(entry.thread.name); }}
                    sx={(theme) => ({
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: theme.palette.mode === 'light' ? '#000000' : theme.palette.text.primary,
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '100%', sm: 320, md: 480 },
                    })}
                    title={entry.thread.name}
                >
                    {entry.thread.name}
                </Typography>
                <ThreadStateChip state={entry.snapshot.state} />

                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Typography
                        variant="caption"
                        sx={(theme) => ({
                            fontWeight: 700,
                            color: theme.palette.accent.owner,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                        })}
                    >
                        Holding {monitorCount} Monitor{monitorCount !== 1 ? 's' : ''}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={(theme) => ({ color: theme.palette.text.disabled, mx: 0.25 })}
                    >
                        |
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={(theme) => ({
                            fontWeight: 700,
                            color: theme.palette.severity.critical.text,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                        })}
                    >
                        Blocking {blockedCount} Thread{blockedCount !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2, pt: 1.5 }}>
                {entry.heldLocks.map(lock => (
                    <MonitorSection key={lock.address} lock={lock} onThreadClick={onThreadClick} />
                ))}
            </AccordionDetails>
        </Accordion>
    );
};

export default LockOwnerAccordion;
