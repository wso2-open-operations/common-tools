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
