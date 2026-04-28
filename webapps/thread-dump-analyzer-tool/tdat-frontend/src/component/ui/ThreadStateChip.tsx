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
import { Chip } from '@mui/material';
import type { Theme } from '@mui/material/styles';

type StateKey = 'runnable' | 'blocked' | 'waiting' | 'timedWaiting' | 'new' | 'terminated' | 'na';

const STATE_KEY_MAP: Record<string, StateKey> = {
    RUNNABLE: 'runnable',
    BLOCKED: 'blocked',
    WAITING: 'waiting',
    TIMED_WAITING: 'timedWaiting',
    NEW: 'new',
    TERMINATED: 'terminated',
};

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
    const key = STATE_KEY_MAP[state] ?? 'na';

    return (
        <Chip
            label={state}
            size="small"
            sx={(theme: Theme) => {
                const tokens = theme.palette.state[key];
                return {
                    backgroundColor: tokens.bg,
                    color: tokens.text,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    height: 22,
                    borderRadius: 1.5,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                };
            }}
        />
    );
};

export default ThreadStateChip;
