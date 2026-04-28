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

import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Divider, Tooltip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { OrphanedLock } from '../../../utils/lockContentionAnalysis';
import VictimRow from './VictimRow';

const ORPHAN_VICTIM_LIMIT = 10;

interface OrphanedLockCardProps {
    lock: OrphanedLock;
    onThreadClick: (name: string) => void;
}

const OrphanedLockCard: React.FC<OrphanedLockCardProps> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, ORPHAN_VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - ORPHAN_VICTIM_LIMIT;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={(theme) => ({
                mb: 1.5,
                border: `1px solid ${theme.palette.brand.softBorder}`,
                borderRadius: '12px !important',
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1.5 },
            })}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={(theme) => ({ color: theme.palette.accent.owner })} />}
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
                <LockOutlinedIcon sx={(theme) => ({ fontSize: 16, color: theme.palette.text.disabled, flexShrink: 0 })} />
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <Typography
                        variant="body2"
                        sx={(theme) => ({
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: theme.palette.text.primary,
                            fontSize: '0.82rem',
                            whiteSpace: 'nowrap',
                        })}
                    >
                        &lt;{lock.address}&gt;
                    </Typography>
                    <Tooltip title={lock.className} placement="top">
                        <Typography
                            variant="caption"
                            sx={(theme) => ({
                                color: theme.palette.text.secondary,
                                fontSize: '0.72rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: { xs: 160, sm: 320, md: 500 },
                                cursor: 'default',
                            })}
                        >
                            {shortName}
                        </Typography>
                    </Tooltip>
                </Box>
                <Chip
                    label={`${lock.victims.length} Blocked`}
                    size="small"
                    sx={(theme) => ({
                        bgcolor: theme.palette.severity.high.bg,
                        color: theme.palette.severity.high.text,
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        height: 22,
                        flexShrink: 0,
                    })}
                />
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
                <Box
                    sx={(theme) => ({
                        px: 2,
                        py: 0.75,
                        bgcolor: theme.palette.surface.muted,
                        borderTop: `1px solid ${theme.palette.brand.softBorder}`,
                        borderBottom: `1px solid ${theme.palette.surface.border}`,
                    })}
                >
                    <Typography
                        variant="caption"
                        sx={(theme) => ({ color: theme.palette.text.secondary, fontFamily: 'monospace', fontSize: '0.72rem' })}
                    >
                        {lock.className}
                    </Typography>
                </Box>

                {lock.victims.length === 0 ? (
                    <Box sx={(theme) => ({ px: 2, py: 2, bgcolor: theme.palette.surface.inset, textAlign: 'center' })}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            No blocked threads recorded for this monitor.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {visibleVictims.map((victim, idx) => (
                            <React.Fragment key={victim.thread.id}>
                                {idx > 0 && <Divider />}
                                <VictimRow victim={victim} onThreadClick={onThreadClick} />
                            </React.Fragment>
                        ))}
                        {hiddenCount > 0 && (
                            <>
                                <Divider />
                                <Box sx={(theme) => ({ textAlign: 'center', py: 0.5, bgcolor: theme.palette.surface.inset })}>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => setShowAll(v => !v)}
                                        sx={(theme) => ({ textTransform: 'none', fontSize: '0.75rem', color: theme.palette.accent.owner })}
                                    >
                                        {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                    </Button>
                                </Box>
                            </>
                        )}
                    </>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

export default OrphanedLockCard;
