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
import {
    Box, Paper, Typography, Tooltip,
    List, ListItemButton, Checkbox,
    Stack, Divider,
} from '@mui/material';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import type { Thread } from '@/types/api';

interface PoolSidebarProps {
    poolKeys: string[];
    selectedPools: string[];
    threadsByPool: Record<string, Thread[]>;
    allSelected: boolean;
    togglePool: (pool: string) => void;
    toggleSelectAll: () => void;
}

const PoolSidebar: React.FC<PoolSidebarProps> = ({
    poolKeys,
    selectedPools,
    threadsByPool,
    allSelected,
    togglePool,
    toggleSelectAll,
}) => {
    return (
        <Paper
            sx={(theme) => ({
                width: 280,
                flexShrink: 0,
                bgcolor: theme.palette.surface.sidebarBg,
                backdropFilter: 'blur(12px)',
                borderRadius: 0,
                borderRight: `1px solid ${theme.palette.surface.border}`,
                overflowY: 'auto',
            })}
        >
            {/* Header: "Thread Groupings" title */}
            <Box sx={(theme) => ({ p: 2, borderBottom: `1px solid ${theme.palette.surface.border}` })}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <LayersOutlinedIcon fontSize="small" sx={(theme) => ({ color: theme.palette.text.secondary })} />
                    <Typography
                        variant="subtitle1"
                        sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.9rem' })}
                    >
                        Thread Groupings
                    </Typography>
                </Stack>
            </Box>
            <List component="nav" sx={{ p: 1 }}>
                {/* Select All / Deselect All toggle; shows indeterminate state if some but not all pools selected */}
                <ListItemButton
                    onClick={toggleSelectAll}
                    sx={(theme) => ({
                        mb: 0.5,
                        borderRadius: 2,
                        alignItems: 'center',
                        '&:hover': { bgcolor: theme.palette.surface.hoverBg },
                    })}
                >
                    <Checkbox
                        edge="start"
                        size="small"
                        checked={allSelected}
                        indeterminate={selectedPools.length > 0 && !allSelected}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0.5, mr: 1 }}
                    />
                    <Typography
                        variant="body2"
                        sx={(theme) => ({
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: theme.palette.text.primary,
                        })}
                    >
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </Typography>
                </ListItemButton>
                <Divider sx={{ my: 0.5 }} />
                {/* Individual pool items with thread count; highlight selected pools with brand color and left border */}
                {poolKeys.map((pool) => {
                    const isSelected = selectedPools.includes(pool);
                    return (
                        <Tooltip
                            title={""}
                            key={pool}
                            placement="right"
                            arrow
                        >
                            <ListItemButton
                                selected={isSelected}
                                onClick={() => togglePool(pool)}
                                sx={(theme) => ({
                                    mb: 0.5,
                                    borderRadius: 2,
                                    alignItems: 'flex-start',
                                    bgcolor: isSelected ? theme.palette.brand.softBg : 'transparent',
                                    borderLeft: `3px solid ${isSelected ? theme.palette.brand.main : 'transparent'}`,
                                    '&.Mui-selected': { bgcolor: theme.palette.brand.softBg, color: theme.palette.brand.softText },
                                    '&:hover': { bgcolor: isSelected ? theme.palette.brand.softBg : theme.palette.surface.hoverBg },
                                })}
                            >
                                <Checkbox
                                    edge="start"
                                    size="small"
                                    checked={isSelected}
                                    tabIndex={-1}
                                    disableRipple
                                    sx={{ p: 0.5, mr: 1, mt: '-2px' }}
                                />
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        sx={(theme) => ({
                                            fontSize: '0.85rem',
                                            fontWeight: isSelected ? 600 : 500,
                                            color: isSelected ? theme.palette.brand.softText : theme.palette.text.primary,
                                        })}
                                    >
                                        {pool}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={(theme) => ({ color: theme.palette.text.disabled })}
                                    >
                                        {threadsByPool[pool].length} threads
                                    </Typography>
                                </Box>
                            </ListItemButton>
                        </Tooltip>
                    );
                })}
            </List>
        </Paper>
    );
};

export default PoolSidebar;
