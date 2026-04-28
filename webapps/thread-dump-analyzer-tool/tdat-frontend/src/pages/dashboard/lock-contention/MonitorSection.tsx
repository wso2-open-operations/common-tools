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
import { Box, Typography, Button, Divider } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { LockWithVictims } from '../../../utils/lockContentionAnalysis';
import VictimRow from './VictimRow';

const VICTIM_LIMIT = 5;

interface MonitorSectionProps {
    lock: LockWithVictims;
    onThreadClick: (name: string) => void;
}

const MonitorSection: React.FC<MonitorSectionProps> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - VICTIM_LIMIT;

    return (
        <Box
            sx={(theme) => ({
                mb: 2,
                border: `1px solid ${theme.palette.surface.border}`,
                borderRadius: 2.5,
                overflow: 'hidden',
            })}
        >
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 2,
                    py: 0.9,
                    bgcolor: theme.palette.surface.muted,
                    flexWrap: 'wrap',
                    borderBottom: `1px solid ${theme.palette.surface.border}`,
                })}
            >
                <LockOutlinedIcon sx={(theme) => ({ fontSize: 14, color: theme.palette.text.secondary, flexShrink: 0 })} />
                <Typography variant="body2" sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.8rem' })}>
                    {shortName}
                </Typography>
                <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.secondary, fontSize: '0.73rem' })}>
                    ( {lock.className} )
                </Typography>
                <Typography variant="caption" sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.text.disabled, fontSize: '0.72rem' })}>
                    &lt;{lock.address}&gt;
                </Typography>
                <Typography variant="caption" sx={(theme) => ({ ml: 'auto', color: theme.palette.text.secondary, whiteSpace: 'nowrap' })}>
                    {lock.victims.length} blocked thread{lock.victims.length !== 1 ? 's' : ''}
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
                                    sx={(theme) => ({ textTransform: 'none', fontSize: '0.75rem', color: theme.palette.accent.link })}
                                >
                                    {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                </Button>
                            </Box>
                        </>
                    )}
                </>
            )}
        </Box>
    );
};

export default MonitorSection;
