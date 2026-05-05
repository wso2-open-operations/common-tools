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
import { Box, Paper, Typography, Chip, ButtonBase } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { DeadlockCycle, CulpritEntry } from '../../../utils/lockContentionAnalysis';

// Deadlock Cycle Flow

interface DeadlockChainProps {
    cycle: DeadlockCycle;
    index: number;
    onThreadClick: (name: string) => void;
}

const DeadlockChain: React.FC<DeadlockChainProps> = ({ cycle, index, onThreadClick }) => (
    <Paper
        sx={(theme) => ({
            p: 2.5,
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${theme.palette.state.blocked.border}`,
            bgcolor: theme.palette.surface.translucent,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        })}
    >
        <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Chip
                label={`Cycle ${index + 1}`}
                size="small"
                sx={(theme) => ({
                    bgcolor: theme.palette.severity.critical.bg,
                    color: theme.palette.severity.critical.text,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 22,
                    borderRadius: 1.5,
                })}
            />
            <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.secondary })}>
                {cycle.threads.length} threads in circular dependency
            </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {cycle.threads.map((entry, i) => {
                const shortClass = entry.lockClassName.split('.').pop() ?? entry.lockClassName;
                const nextThread = cycle.threads[(i + 1) % cycle.threads.length];
                return (
                    <React.Fragment key={entry.thread.id}>
                        {/* Thread node */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {/* Vertical line connector */}
                            <Box sx={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                <Box
                                    sx={(theme) => ({
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        bgcolor: theme.palette.accent.deadlock,
                                        border: `2px solid ${theme.palette.accent.deadlockBg}`,
                                        zIndex: 1,
                                    })}
                                />
                            </Box>
                            <ButtonBase
                                onClick={() => onThreadClick(entry.thread.name)}
                                sx={(theme) => ({
                                    flex: 1,
                                    px: 1.5,
                                    py: 0.75,
                                    bgcolor: theme.palette.accent.victimBg,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    minWidth: 0,
                                    '&:hover': { bgcolor: theme.palette.accent.victimBgHover },
                                    '&:focus-visible': { outline: `2px solid ${theme.palette.accent.link}`, outlineOffset: 2 },
                                })}
                            >
                                <Typography
                                    variant="body2"
                                    sx={(theme) => ({
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: theme.palette.accent.link,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    })}
                                >
                                    {entry.thread.name}
                                </Typography>
                            </ButtonBase>
                        </Box>

                        {/* Arrow: waiting for lock */}
                        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
                            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <Box sx={(theme) => ({ width: 2, bgcolor: theme.palette.surface.border, minHeight: 28 })} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
                                <ArrowForwardIcon sx={(theme) => ({ fontSize: 14, color: theme.palette.text.disabled, transform: 'rotate(90deg)' })} />
                                <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: '0.68rem', fontStyle: 'italic' })}>
                                    waiting for
                                </Typography>
                                <LockOutlinedIcon sx={(theme) => ({ fontSize: 13, color: theme.palette.accent.monitor })} />
                                <Typography variant="caption" sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.accent.monitor, fontWeight: 600, fontSize: '0.7rem' })}>
                                    {shortClass}
                                </Typography>
                                <Typography variant="caption" sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.text.disabled, fontSize: '0.65rem' })}>
                                    &lt;{entry.waitingOnAddress}&gt;
                                </Typography>
                                <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: '0.68rem', fontStyle: 'italic' })}>
                                    held by
                                </Typography>
                                <Typography variant="caption" sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.accent.link, fontWeight: 600, fontSize: '0.7rem' })}>
                                    {nextThread.thread.name.length > 30 ? nextThread.thread.name.slice(0, 30) + '...' : nextThread.thread.name}
                                </Typography>
                            </Box>
                        </Box>
                    </React.Fragment>
                );
            })}

            {/* Closing circle to show cycle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <Box
                        sx={(theme) => ({
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.accent.deadlock,
                            border: `2px solid ${theme.palette.accent.deadlockBg}`,
                            zIndex: 1,
                        })}
                    />
                </Box>
                <Typography
                    variant="caption"
                    sx={(theme) => ({
                        color: theme.palette.accent.deadlock,
                        fontWeight: 600,
                        fontStyle: 'italic',
                        fontSize: '0.72rem',
                    })}
                >
                    back to {cycle.threads[0].thread.name.length > 40 ? cycle.threads[0].thread.name.slice(0, 40) + '...' : cycle.threads[0].thread.name}
                </Typography>
            </Box>
        </Box>
    </Paper>
);

// ─── Contention Chain Flow ───────────────────────────────────────────────────

interface ContentionChainProps {
    culprit: CulpritEntry;
    onThreadClick: (name: string) => void;
}

const ContentionChain: React.FC<ContentionChainProps> = ({ culprit, onThreadClick }) => {
    const [expandedLocks, setExpandedLocks] = useState<Set<string>>(new Set());

    const toggleLock = (address: string) => {
        setExpandedLocks(prev => {
            const next = new Set(prev);
            if (next.has(address)) next.delete(address);
            else next.add(address);
            return next;
        });
    };

    return (
        <Paper
            sx={(theme) => ({
                p: 2.5,
                mb: 2,
                borderRadius: 3,
                border: `1px solid ${theme.palette.surface.border}`,
                bgcolor: theme.palette.surface.translucent,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            })}
        >
            {/* Owner node */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <Box
                        sx={(theme) => ({
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.accent.owner,
                            border: `2px solid ${theme.palette.brand.softBorder}`,
                        })}
                    />
                </Box>
                <ButtonBase
                    onClick={() => onThreadClick(culprit.thread.name)}
                    sx={(theme) => ({
                        px: 1.5,
                        py: 0.75,
                        bgcolor: theme.palette.accent.ownerBg,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        minWidth: 0,
                        flex: 1,
                        '&:hover': { bgcolor: theme.palette.accent.ownerBgHover },
                        '&:focus-visible': { outline: `2px solid ${theme.palette.accent.owner}`, outlineOffset: 2 },
                    })}
                >
                    <Chip
                        label="OWNER"
                        size="small"
                        sx={(theme) => ({
                            bgcolor: theme.palette.accent.owner,
                            color: theme.palette.brand.contrast,
                            fontWeight: 700,
                            fontSize: '0.6rem',
                            height: 18,
                            borderRadius: 1,
                        })}
                    />
                    <Typography
                        variant="body2"
                        sx={(theme) => ({
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: theme.palette.accent.link,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        })}
                    >
                        {culprit.thread.name}
                    </Typography>
                </ButtonBase>
            </Box>

            {/* Locks and victims */}
            {culprit.heldLocks.map((lock) => {
                const shortClass = lock.className.split('.').pop() ?? lock.className;
                const isExpanded = expandedLocks.has(lock.address);
                const visibleVictims = isExpanded ? lock.victims : lock.victims.slice(0, 5);
                const remainingCount = lock.victims.length - 5;
                return (
                    <React.Fragment key={lock.address}>
                        {/* Lock connector */}
                        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
                            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <Box sx={(theme) => ({ width: 2, bgcolor: theme.palette.surface.border, minHeight: 24 })} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                                <LockOutlinedIcon sx={(theme) => ({ fontSize: 13, color: theme.palette.accent.monitor })} />
                                <Typography
                                    variant="caption"
                                    sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.accent.monitor, fontWeight: 600, fontSize: '0.7rem' })}
                                >
                                    {shortClass}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={(theme) => ({ fontFamily: 'monospace', color: theme.palette.text.disabled, fontSize: '0.65rem' })}
                                >
                                    &lt;{lock.address}&gt;
                                </Typography>
                                <Typography variant="caption" sx={(theme) => ({ color: theme.palette.text.disabled, fontSize: '0.68rem' })}>
                                    — {lock.victims.length} blocked
                                </Typography>
                            </Box>
                        </Box>

                        {/* Victim nodes */}
                        {visibleVictims.map((victim) => (
                            <Box key={victim.thread.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                                    <Box sx={(theme) => ({ width: 2, bgcolor: theme.palette.surface.border, position: 'absolute', top: 0, bottom: '50%' })} />
                                    <Box sx={(theme) => ({ width: 12, height: 2, bgcolor: theme.palette.surface.border, position: 'absolute', left: '50%', top: '50%' })} />
                                </Box>
                                <ButtonBase
                                    onClick={() => onThreadClick(victim.thread.name)}
                                    sx={(theme) => ({
                                        flex: 1,
                                        px: 1.5,
                                        py: 0.5,
                                        ml: 1,
                                        bgcolor: theme.palette.accent.victimBg,
                                        borderRadius: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        minWidth: 0,
                                        '&:hover': { bgcolor: theme.palette.accent.victimBgHover },
                                        '&:focus-visible': { outline: `2px solid ${theme.palette.accent.link}`, outlineOffset: 2 },
                                    })}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={(theme) => ({
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            color: theme.palette.accent.link,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        })}
                                    >
                                        {victim.thread.name}
                                    </Typography>
                                    {victim.waitTimeMs > 0 && (
                                        <Typography
                                            variant="caption"
                                            sx={(theme) => ({
                                                fontFamily: 'monospace',
                                                color: victim.waitTimeMs >= 10000 ? theme.palette.severity.critical.text : theme.palette.text.disabled,
                                                fontSize: '0.65rem',
                                                flexShrink: 0,
                                            })}
                                        >
                                            {victim.waitTimeMs >= 1000 ? `${(victim.waitTimeMs / 1000).toFixed(1)}s` : `${victim.waitTimeMs}ms`}
                                        </Typography>
                                    )}
                                </ButtonBase>
                            </Box>
                        ))}
                        {remainingCount > 0 && (
                            <ButtonBase
                                onClick={() => toggleLock(lock.address)}
                                sx={(theme) => ({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    width: '100%',
                                    justifyContent: 'flex-start',
                                    '&:hover .expand-label': { color: theme.palette.text.secondary },
                                    '&:focus-visible': { outline: `2px solid ${theme.palette.accent.monitor}`, outlineOffset: 2 },
                                })}
                            >
                                <Box sx={{ width: 24, flexShrink: 0 }} />
                                <Typography
                                    className="expand-label"
                                    variant="caption"
                                    sx={(theme) => ({
                                        color: theme.palette.text.disabled,
                                        fontSize: '0.68rem',
                                        ml: 1,
                                        py: 0.25,
                                        userSelect: 'none',
                                    })}
                                >
                                    {isExpanded ? '— Show fewer' : `+ ${remainingCount} more blocked threads`}
                                </Typography>
                            </ButtonBase>
                        )}
                    </React.Fragment>
                );
            })}
        </Paper>
    );
};

// ─── Exported Component ──────────────────────────────────────────────────────

interface LockChainViewProps {
    deadlocks: DeadlockCycle[];
    culprits: CulpritEntry[];
    onThreadClick: (name: string) => void;
}

const LockChainView: React.FC<LockChainViewProps> = ({ deadlocks, culprits, onThreadClick }) => {
    if (deadlocks.length === 0 && culprits.length === 0) return null;

    return (
        <Box sx={{ mb: 4 }}>
            <Typography
                variant="h6"
                fontWeight={700}
                sx={(theme) => ({ mb: 0.5, color: theme.palette.text.primary })}
            >
                Chain Map
            </Typography>
            <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary, mb: 2 })}>
                Visual flow of lock dependencies — follow the chain to trace contention from owner to blocked threads.
            </Typography>

            {deadlocks.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography
                        variant="subtitle2"
                        sx={(theme) => ({
                            fontWeight: 600,
                            color: theme.palette.severity.critical.text,
                            mb: 1.5,
                            fontSize: '0.82rem',
                        })}
                    >
                        Deadlock Cycles
                    </Typography>
                    {deadlocks.map((cycle, i) => (
                        <DeadlockChain key={i} cycle={cycle} index={i} onThreadClick={onThreadClick} />
                    ))}
                </Box>
            )}

            {culprits.length > 0 && (
                <Box>
                    <Typography
                        variant="subtitle2"
                        sx={(theme) => ({
                            fontWeight: 600,
                            color: theme.palette.text.primary,
                            mb: 1.5,
                            fontSize: '0.82rem',
                        })}
                    >
                        Contention Chains
                    </Typography>
                    {culprits.slice(0, 10).map((culprit) => (
                        <ContentionChain key={culprit.thread.id} culprit={culprit} onThreadClick={onThreadClick} />
                    ))}
                    {culprits.length > 10 && (
                        <Typography
                            variant="caption"
                            sx={(theme) => ({
                                color: theme.palette.text.disabled,
                                display: 'block',
                                textAlign: 'center',
                                mt: 1,
                            })}
                        >
                            Showing top 10 of {culprits.length} chains by impact
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default LockChainView;
