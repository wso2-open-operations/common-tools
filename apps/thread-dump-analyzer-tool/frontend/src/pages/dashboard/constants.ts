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

import type { Theme } from '@mui/material/styles';

export const STATE_ORDER = ['RUNNABLE', 'WAITING', 'TIMED_WAITING', 'BLOCKED', 'TERMINATED', 'N/A'];

// Returns mode-aware state colors for charts and dots.
export function stateColors(theme: Theme): Record<string, string> {
    const s = theme.palette.state;
    return {
        RUNNABLE: s.runnable.main,
        WAITING: s.waiting.main,
        TIMED_WAITING: s.timedWaiting.main,
        BLOCKED: s.blocked.main,
        TERMINATED: s.terminated.main,
        'N/A': s.na.main,
    };
}

// Shared table header cell style (mode-aware). Call with the theme from useTheme().
export function tableHeadCellSx(theme: Theme) {
    return {
        fontWeight: 700,
        fontSize: '0.78rem',
        color: theme.palette.text.secondary,
        bgcolor: theme.palette.surface.inset,
        borderBottom: `1px solid ${theme.palette.surface.border}`,
    } as const;
}
