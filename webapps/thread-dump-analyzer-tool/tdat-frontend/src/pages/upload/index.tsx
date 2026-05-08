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

import { useState, useMemo, useEffect } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    Box, Typography, Button, Chip, Paper, Container,
    Alert, CircularProgress, Snackbar, Alert as MuiAlert, Tooltip, Backdrop,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalyzeThreads } from '@hooks/useAnalyzeThreads';
import { extractFileKey, type PairedFile } from '../../utils/uploadValidation';
import UploadCard from './components/UploadCard';
import Header from '@src/layout/header';

function UploadPage() {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'New Session | WSO2 TDAT';
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    const [dumps, setDumps] = useState<File[]>([]);
    const [usages, setUsages] = useState<File[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const sortedDumps = [...dumps].sort((a, b) => a.name.localeCompare(b.name));
    const sortedUsages = [...usages].sort((a, b) => a.name.localeCompare(b.name));

    // Two-pass pairing: match dumps to usages by filename key, then add unmatched usages.
    const pairedFiles = useMemo<PairedFile[]>(() => {
        if (sortedUsages.length === 0) {
            return sortedDumps.map(dump => ({ dump, usage: null, matched: true }));
        }

        const pairs: PairedFile[] = [];
        const usageByKey = new Map<string, File>();
        sortedUsages.forEach(file => usageByKey.set(extractFileKey(file.name), file));

        const matchedUsageKeys = new Set<string>();
        sortedDumps.forEach(dump => {
            const dumpKey = extractFileKey(dump.name);
            const usage = usageByKey.get(dumpKey) ?? null;
            if (usage) {
                matchedUsageKeys.add(dumpKey);
                pairs.push({ dump, usage, matched: true });
            } else {
                pairs.push({ dump, usage: null, matched: false, warning: `No matching usage file found (key: "${dumpKey}")` });
            }
        });

        sortedUsages.forEach(file => {
            const usageKey = extractFileKey(file.name);
            if (!matchedUsageKeys.has(usageKey)) {
                pairs.push({ dump: null, usage: file, matched: false, warning: `No matching thread dump found (key: "${usageKey}")` });
            }
        });

        return pairs;
    }, [sortedDumps, sortedUsages]);

    const hasWarnings = pairedFiles.some(p => !p.matched);

    const { mutation, query } = useAnalyzeThreads();
    const isUploading = mutation.isPending;
    const isPolling = query.isFetching || (query.data?.status === 'pending' || query.data?.status === 'running');
    const isBusy = isUploading || isPolling;

    const loadingLabel = isUploading
        ? 'Uploading Files...'
        : 'Analyzing Threads (This may take a minute)...';

    useEffect(() => {
        if (query.data?.status === 'completed' && query.data.result) {
            const result = query.data.result;
            if (result.errors && result.errors.length > 0) {
                setErrorMsg(`Invalid file(s) uploaded: ${result.errors.join(' | ')}. Please ensure you upload proper thread dumps.`);
                return;
            }
            if (!result.threads || result.threads.length === 0) {
                setErrorMsg('Invalid file(s) uploaded: No threads were found in the provided files. Please re-upload proper thread dumps.');
                return;
            }
            navigate('/dashboard');
        }
        if (query.data?.status === 'failed') {
            setErrorMsg('Analysis failed: the server could not process the uploaded files.');
        }
    }, [query.data?.status]);

    const handleAnalyzeClick = () => {
        if (dumps.length === 0) return;
        mutation.mutate(
            { dumps: sortedDumps, usages: sortedUsages },
            { onError: (err) => setErrorMsg(`Upload failed: ${err.message}`) }
        );
    };

    const addUnique = (prev: File[], newFiles: File[]): File[] => {
        const existingNames = new Set(prev.map(f => f.name));
        const unique = newFiles.filter(f => !existingNames.has(f.name));
        const skipped = newFiles.length - unique.length;
        if (skipped > 0) setErrorMsg(`${skipped} duplicate file(s) were skipped.`);
        return [...prev, ...unique];
    };

    return (
        <Box sx={(theme) => ({ minHeight: '100vh', background: theme.palette.surface.pageGradient })}>
            <Header isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
            <Container maxWidth="lg" sx={{ py: 5 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography
                        variant="h5"
                        sx={(theme) => ({ fontWeight: 700, color: theme.palette.text.primary, mb: 0.5 })}
                    >
                        Start New Analysis Session
                    </Typography>
                    <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary })}>
                        Upload thread dump files and their corresponding Thread Usage metrics to begin analysis
                    </Typography>
                </Box>

                {mutation.error && <Alert severity="error" sx={{ mb: 3 }}>Upload failed: {mutation.error.message}</Alert>}

                <Box sx={{ display: 'flex', gap: 3, mb: 0 }}>
                    <Box sx={{ flex: 1 }}>
                        <UploadCard
                            title="Add Thread Dump Files"
                            description="Upload one or more thread dump files (.txt, .log or similar)"
                            required={true}
                            fileTypeLabel="thread dump"
                            files={dumps}
                            onAddFiles={(newFiles) => setDumps(prev => addUnique(prev, newFiles))}
                            onClearFiles={() => setDumps([])}
                            onRemoveFile={(file) => setDumps(prev => prev.filter(f => f !== file))}
                            onError={setErrorMsg}
                        />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <UploadCard
                            title="Add Thread Usage Files"
                            description="Upload CPU usage metrics to enhance analysis"
                            required={false}
                            fileTypeLabel="usage"
                            files={usages}
                            onAddFiles={(newFiles) => setUsages(prev => addUnique(prev, newFiles))}
                            onClearFiles={() => setUsages([])}
                            onRemoveFile={(file) => setUsages(prev => prev.filter(f => f !== file))}
                            onError={setErrorMsg}
                        />
                    </Box>
                </Box>

                {/* File Pairing Overview */}
                {(dumps.length > 0 || usages.length > 0) && (
                    <Paper
                        sx={(theme) => ({
                            p: 3,
                            mb: 3,
                            border: `1px solid ${theme.palette.surface.border}`,
                            borderRadius: 3,
                            backgroundColor: theme.palette.surface.translucent,
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        })}
                    >
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle1" fontWeight="bold">Paired Files</Typography>
                            {usages.length > 0 && (
                                <Chip
                                    icon={hasWarnings ? <WarningAmberIcon /> : <CheckCircleOutlineIcon />}
                                    label={hasWarnings ? 'Mismatched files detected' : 'All files matched'}
                                    size="small"
                                    color={hasWarnings ? 'warning' : 'success'}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            Files are paired by matching identifiers in their filenames. Unmatched files will be highlighted.
                        </Typography>

                        {hasWarnings && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Some files could not be matched by filename. Unmatched files will not be paired during analysis.
                            </Alert>
                        )}

                        <Box display="flex" flexDirection="column" gap={1}>
                            {pairedFiles.map((pair, index) => (
                                <Box
                                    key={index}
                                    display="flex"
                                    alignItems="center"
                                    p={1.5}
                                    sx={(theme) => ({
                                        backgroundColor: !pair.matched ? theme.palette.severity.medium.bg : theme.palette.background.paper,
                                        border: `1px solid ${!pair.matched ? theme.palette.severity.medium.border : theme.palette.surface.border}`,
                                        borderRadius: 1,
                                    })}
                                >
                                    <Box
                                        flex={1}
                                        pr={2}
                                        sx={(theme) => ({ borderRight: `1px solid ${theme.palette.surface.border}` })}
                                    >
                                        <Typography variant="caption" color="text.secondary" display="block">Thread Dump</Typography>
                                        <Typography variant="body2" color={pair.dump ? 'text.primary' : 'error.main'} fontWeight="500">
                                            {pair.dump ? pair.dump.name : 'No matching Thread Dump'}
                                        </Typography>
                                    </Box>
                                    <Box flex={1} pl={2}>
                                        <Typography variant="caption" color="text.secondary" display="block">Thread Usage</Typography>
                                        <Typography variant="body2" color={pair.usage ? 'text.primary' : 'warning.main'} fontWeight="500">
                                            {pair.usage ? pair.usage.name : 'No Usage File'}
                                        </Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" pl={1} sx={{ minWidth: 32 }}>
                                        {pair.matched ? (
                                            <CheckCircleOutlineIcon fontSize="small" sx={(theme) => ({ color: theme.palette.severity.success.main })} />
                                        ) : (
                                            <Tooltip title={pair.warning || 'Files could not be matched'} arrow>
                                                <WarningAmberIcon fontSize="small" sx={(theme) => ({ color: theme.palette.severity.medium.main })} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                )}

                {/* Analyze Button */}
                <Box display="flex" justifyContent="center" mt={4}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleAnalyzeClick}
                        disabled={isBusy || dumps.length === 0}
                        sx={(theme) => ({
                            px: 5,
                            py: 1.25,
                            backgroundColor: theme.palette.brand.main,
                            color: `${theme.palette.brand.contrast} !important`,
                            borderRadius: 2.5,
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            boxShadow: theme.palette.brand.shadow,
                            '&:hover': { backgroundColor: theme.palette.brand.hover, boxShadow: theme.palette.brand.shadow },
                            '&.Mui-disabled': {
                                bgcolor: theme.palette.action.disabledBackground,
                                color: `${theme.palette.text.disabled} !important`,
                                boxShadow: 'none',
                            },
                        })}
                    >
                        {isBusy ? <CircularProgress size={24} color="inherit" /> : 'Analyze'}
                    </Button>
                </Box>

                <Backdrop open={isBusy} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }}>
                    <CircularProgress color="inherit" sx={{ color: '#F14E23' }} />
                    <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                        {loadingLabel}
                    </Typography>
                </Backdrop>

                <Snackbar open={!!errorMsg} autoHideDuration={4000} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                    <MuiAlert onClose={() => setErrorMsg(null)} severity="error" sx={{ width: '100%' }}>
                        {errorMsg}
                    </MuiAlert>
                </Snackbar>
            </Container>
        </Box>
    );
}
export default UploadPage;
