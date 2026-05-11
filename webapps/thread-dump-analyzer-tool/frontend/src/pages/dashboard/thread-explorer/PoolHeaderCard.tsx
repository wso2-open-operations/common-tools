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

import React, { useState } from 'react';
import {
    Box, Typography, Tooltip, Chip,
    Accordion, AccordionSummary, AccordionDetails, Collapse, Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Thread, ThreadPoolInfo } from '@/types/api';

interface PoolHeaderCardProps {
    headerTitle: string;
    selectedPools: string[];
    threadsByPool: Record<string, Thread[]>;
    threadPools?: Record<string, ThreadPoolInfo>;
    filteredCount: number;
    togglePool: (pool: string) => void;
}

const PoolHeaderCard: React.FC<PoolHeaderCardProps> = ({
    headerTitle,
    selectedPools,
    threadsByPool,
    threadPools,
    filteredCount,
    togglePool,
}) => {
    // Toggle for showing/hiding pool info accordion when multiple pools are selected
    const [showPoolDetails, setShowPoolDetails] = useState(false);

    return (
        <Box mb={3}>
            <Box
                sx={(theme) => ({
                    p: 2.5,
                    bgcolor: theme.palette.surface.translucent,
                    backdropFilter: 'blur(8px)',
                    borderLeft: `3px solid ${theme.palette.brand.main}`,
                    borderRadius: 3,
                    border: `1px solid ${theme.palette.surface.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                })}
            >
                <Typography
                    variant="h5"
                    sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary })}
                    gutterBottom
                >
                    {headerTitle}
                </Typography>

                {/* Show pool metadata (description and expected behavior) when exactly one pool is selected */}
                {selectedPools.length === 1 && threadPools?.[selectedPools[0]] && (
                    <Box mb={1}>
                        <Typography variant="body2" color="text.primary" gutterBottom>
                            <strong>Description:</strong> {threadPools[selectedPools[0]].description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            <strong>Expected behavior:</strong> {threadPools[selectedPools[0]].expected_behavior}
                        </Typography>
                    </Box>
                )}

                {/* When multiple pools are selected, show removable chips and optional details accordion */}
                {selectedPools.length > 1 && (
                    <Box mt={1}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                            {selectedPools.map(pool => (
                                <Tooltip key={pool} title={`${threadsByPool[pool]?.length || 0} threads`} placement="top" arrow>
                                    <Chip
                                        label={pool}
                                        size="small"
                                        onClick={() => togglePool(pool)}
                                        onDelete={() => togglePool(pool)}
                                        sx={(theme) => ({
                                            maxWidth: 200,
                                            bgcolor: theme.palette.brand.softBg,
                                            color: theme.palette.brand.softText,
                                            border: `1px solid ${theme.palette.brand.main}`,
                                            fontWeight: 500,
                                            fontSize: '0.75rem',
                                            '& .MuiChip-deleteIcon': { color: theme.palette.brand.softText, fontSize: '0.9rem' },
                                        })}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                        {/* Toggle button to expand/collapse pool info accordion; only show if at least one pool has metadata */}
                        {selectedPools.some(p => threadPools?.[p]) && (
                            <Button
                                size="small"
                                startIcon={<InfoOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />}
                                onClick={() => setShowPoolDetails(v => !v)}
                                sx={(theme) => ({
                                    textTransform: 'none',
                                    color: theme.palette.text.secondary,
                                    fontSize: '0.78rem',
                                    p: 0,
                                    minWidth: 0,
                                    '&:hover': { bgcolor: 'transparent', color: theme.palette.brand.main },
                                })}
                            >
                                {showPoolDetails ? 'Hide pool details' : 'Show pool details'}
                            </Button>
                        )}
                        {/* Collapsible section with expandable accordion for each selected pool's details */}
                        <Collapse in={showPoolDetails}>
                            <Box mt={1.5}>
                                {selectedPools.map(pool => {
                                    const info = threadPools?.[pool];
                                    if (!info) return null;
                                    return (
                                        <Accordion
                                            key={pool}
                                            disableGutters
                                            elevation={0}
                                            sx={(theme) => ({
                                                bgcolor: 'transparent',
                                                border: `1px solid ${theme.palette.surface.border}`,
                                                borderRadius: 2,
                                                mb: 1,
                                                '&:before': { display: 'none' },
                                                '&.Mui-expanded': { margin: 0, mb: 1 },
                                            })}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon fontSize="small" />}
                                                sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                                            >
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {pool}
                                                </Typography>
                                                <Typography variant="caption" sx={{ ml: 1, color: 'text.disabled', alignSelf: 'center' }}>
                                                    ({threadsByPool[pool]?.length || 0} threads)
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ pt: 0 }}>
                                                <Typography variant="body2" color="text.primary" gutterBottom>
                                                    <strong>Description:</strong> {info.description}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    <strong>Expected behavior:</strong> {info.expected_behavior}
                                                </Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Box>
                        </Collapse>
                    </Box>
                )}

                <Typography variant="body2" color="text.secondary">Showing {filteredCount} thread(s)</Typography>
            </Box>
        </Box>
    );
};

export default PoolHeaderCard;
