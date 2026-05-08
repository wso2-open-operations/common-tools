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
import { Paper, Typography, TableSortLabel } from '@mui/material';
import Grid from '@mui/material/Grid';

export type SortableKeys = 'id' | 'name' | 'state' | 'avgCpu' | 'maxCpu' | 'avgUserTime';
export type Order = 'asc' | 'desc';

// Column definitions for the thread table header; layout grid sizes and optional left padding for alignment
const SORT_COLUMNS: ReadonlyArray<{ key: SortableKeys; label: string; size: number; pl?: number }> = [
    { key: 'id', label: 'THREAD ID', size: 2.5, pl: 5 },
    { key: 'name', label: 'THREAD NAME', size: 3 },
    { key: 'state', label: 'LAST STATE', size: 1.5 },
    { key: 'avgCpu', label: 'AVG CPU (%)', size: 1.5 },
    { key: 'maxCpu', label: 'MAX CPU (%)', size: 1.5 },
    { key: 'avgUserTime', label: 'AVG USER TIME', size: 2 },
];

interface ThreadSortHeaderProps {
    order: Order;
    orderBy: SortableKeys;
    onRequestSort: (property: SortableKeys) => void;
}

const ThreadSortHeader: React.FC<ThreadSortHeaderProps> = ({ order, orderBy, onRequestSort }) => {
    return (
        <Paper
            sx={(theme) => ({
                p: 2,
                mb: 2,
                bgcolor: theme.palette.surface.muted,
                borderRadius: 3,
                border: `1px solid ${theme.palette.surface.border}`,
            })}
        >
            {/* Sortable column headers; TableSortLabel highlights active sort column and shows direction arrow */}
            <Grid container spacing={2}>
                {SORT_COLUMNS.map(col => (
                    <Grid key={col.key} size={{ xs: col.size }} sx={col.pl ? { pl: col.pl } : undefined}>
                        <TableSortLabel
                            active={orderBy === col.key}
                            direction={orderBy === col.key ? order : 'asc'}
                            onClick={() => onRequestSort(col.key)}
                        >
                            <Typography variant="caption" fontWeight="bold" color="textPrimary">{col.label}</Typography>
                        </TableSortLabel>
                    </Grid>
                ))}
            </Grid>
        </Paper>
    );
};

export default ThreadSortHeader;
