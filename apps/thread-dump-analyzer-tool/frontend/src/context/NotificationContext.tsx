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

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, IconButton, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type NotifyOptions = { title?: string };

// notify(message, severity?, options?) pops a centered alert; severity defaults to 'info' and drives the icon, accent colour, and default title.
type Notify = (message: string, severity?: AlertColor, options?: NotifyOptions) => void;

type AlertItem = { key: number; message: string; severity: AlertColor; title?: string };

const NotificationContext = createContext<Notify | undefined>(undefined);

const META: Record<AlertColor, { title: string; accent: string; Icon: ElementType }> = {
    error: { title: 'Error', accent: '#f87171', Icon: ErrorOutlineIcon },
    warning: { title: 'Warning', accent: '#fbbf24', Icon: WarningAmberIcon },
    success: { title: 'Success', accent: '#4ade80', Icon: CheckCircleOutlineIcon },
    info: { title: 'Notice', accent: '#60a5fa', Icon: InfoOutlinedIcon },
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const queueRef = useRef<AlertItem[]>([]);
    const showingRef = useRef(false);
    const [current, setCurrent] = useState<AlertItem | undefined>(undefined);
    const [open, setOpen] = useState(false);

    const notify = useCallback<Notify>((message, severity = 'info', options) => {
        const item: AlertItem = { key: Date.now() + Math.random(), message, severity, title: options?.title };
        // Show immediately when idle; otherwise queue and let handleExited promote it once the current alert closes.
        if (showingRef.current) {
            queueRef.current.push(item);
        } else {
            showingRef.current = true;
            setCurrent(item);
            setOpen(true);
        }
    }, []);

    const close = () => setOpen(false);

    // Ignore backdrop clicks so an accidental click outside never dismisses the alert before it is read; the close button or Esc closes it.
    const handleClose = (_event: unknown, reason: 'backdropClick' | 'escapeKeyDown') => {
        if (reason === 'backdropClick') return;
        setOpen(false);
    };

    // After the closing transition finishes, promote the next queued alert (if any) so messages show one at a time.
    const handleExited = () => {
        const next = queueRef.current.shift();
        if (next) {
            setCurrent(next);
            setOpen(true);
        } else {
            showingRef.current = false;
            setCurrent(undefined);
        }
    };

    const meta = META[current?.severity ?? 'info'];
    const Icon = meta.Icon;

    return (
        <NotificationContext.Provider value={notify}>
            {children}
            <Dialog
                key={current?.key}
                open={open}
                onClose={handleClose}
                TransitionProps={{ onExited: handleExited }}
                PaperProps={{
                    sx: {
                        position: 'relative',
                        bgcolor: '#0D0D0D',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        maxWidth: 440,
                        width: '100%',
                    },
                }}
            >
                <IconButton
                    aria-label="Close notification"
                    onClick={close}
                    sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.6)' }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
                <DialogContent sx={{ pt: 3, pb: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', pr: 3 }}>
                        <Icon sx={{ color: meta.accent, mt: '2px' }} />
                        <Box>
                            <Typography sx={{ fontWeight: 700, mb: 0.5, color: meta.accent }}>
                                {current?.title ?? meta.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-line' }}>
                                {current?.message}
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={close}
                        variant="contained"
                        sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                    >
                        Dismiss
                    </Button>
                </DialogActions>
            </Dialog>
        </NotificationContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotify = (): Notify => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotify must be used within a NotificationProvider');
    return ctx;
};
