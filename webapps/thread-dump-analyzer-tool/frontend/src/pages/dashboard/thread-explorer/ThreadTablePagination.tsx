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
import {
    Box, Typography, Pagination, Select, MenuItem,
    type SelectChangeEvent,
} from '@mui/material';

interface ThreadTablePaginationProps {
    page: number;
    totalPages: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
}

// Available options for rows per page dropdown
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const ThreadTablePagination: React.FC<ThreadTablePaginationProps> = ({
    page,
    totalPages,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
}) => {
    return (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            {/* Left: rows-per-page dropdown */}
            <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">Threads shown per page:</Typography>
                <Select
                    size="small"
                    value={rowsPerPage}
                    onChange={(e: SelectChangeEvent<number>) => onRowsPerPageChange(Number(e.target.value))}
                    sx={(theme) => ({
                        bgcolor: theme.palette.surface.muted,
                        height: 32,
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.surface.border },
                    })}
                >
                    {ROWS_PER_PAGE_OPTIONS.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
            </Box>
            {/* Right: page navigation; only shown if there is more than one page */}
            {totalPages > 0 && (
                <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, val) => onPageChange(val)}
                    showFirstButton
                    showLastButton
                    shape="rounded"
                    sx={(theme) => ({
                        '& .MuiPaginationItem-root.Mui-selected': {
                            bgcolor: theme.palette.brand.main,
                            color: theme.palette.brand.contrast,
                            '&:hover': { bgcolor: theme.palette.brand.hover },
                        },
                    })}
                />
            )}
        </Box>
    );
};

export default ThreadTablePagination;
