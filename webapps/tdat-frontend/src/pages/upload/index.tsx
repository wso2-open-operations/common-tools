import { useState, useMemo, useEffect } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    Box, Typography, Button, Chip, Paper, Container,
    Alert, CircularProgress, Snackbar, Alert as MuiAlert, Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalyzeThreads } from '@hooks/useAnalyzeThreads';
import { useAnalysisData } from '@context/AnalysisContext';
import { extractFileKey, type PairedFile } from '../../utils/uploadValidation';
import UploadCard from './components/UploadCard';
import Header from '@src/layout/header';

function UploadPage() {
    const navigate = useNavigate();
    const { setAnalysisData } = useAnalysisData();

    useEffect(() => {
        document.title = 'New Session | TDAT';
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    const [dumps, setDumps] = useState<File[]>([]);
    const [usages, setUsages] = useState<File[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const sortedDumps = [...dumps].sort((a, b) => a.name.localeCompare(b.name));
    const sortedUsages = [...usages].sort((a, b) => a.name.localeCompare(b.name));

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

    const { mutate, isPending, error } = useAnalyzeThreads();

    const handleAnalyzeClick = () => {
        if (dumps.length === 0) return;
        mutate(
            { dumps: sortedDumps, usages: sortedUsages },
            {
                onSuccess: (data) => {
                    if (data.errors && data.errors.length > 0) {
                        setErrorMsg(`Invalid file(s) uploaded: ${data.errors.join(' | ')}. Please ensure you upload proper thread dumps.`);
                        return;
                    }
                    if (!data.threads || data.threads.length === 0) {
                        setErrorMsg('Invalid file(s) uploaded: No threads were found in the provided files. Please re-upload proper thread dumps.');
                        return;
                    }
                    setAnalysisData(data);
                    navigate('/dashboard');
                },
                onError: (err) => setErrorMsg(`Analysis failed: ${err.message}`),
            }
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
        <Box sx={{
            minHeight: '100vh',
            background: `
                radial-gradient(ellipse at 18% 8%, rgba(196,181,243,0.22) 0%, transparent 55%),
                radial-gradient(ellipse at 72% 55%, rgba(255,197,150,0.18) 0%, transparent 55%),
                #f5f6fa`,
        }}>
            <Header isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
            <Container maxWidth="lg" sx={{ py: 5 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 0.5 }}>Start New Analysis Session</Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        Upload thread dump files and their corresponding Thread Usage metrics to begin analysis
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3 }}>Analysis failed: {error.message}</Alert>}

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
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
                                    sx={{
                                        backgroundColor: !pair.matched ? '#fff8e1' : 'white',
                                        border: !pair.matched ? '1px solid #ffe082' : '1px solid #f0f0f0',
                                        borderRadius: 1,
                                    }}
                                >
                                    <Box flex={1} borderRight="1px solid #f0f0f0" pr={2}>
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
                                            <CheckCircleOutlineIcon fontSize="small" sx={{ color: 'success.main' }} />
                                        ) : (
                                            <Tooltip title={pair.warning || 'Files could not be matched'} arrow>
                                                <WarningAmberIcon fontSize="small" sx={{ color: '#f9a825' }} />
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
                        disabled={isPending || dumps.length === 0}
                        sx={{
                            px: 5, py: 1.25, backgroundColor: '#ff6d00', color: 'white !important',
                            borderRadius: 2.5, fontWeight: 600, fontSize: '0.9rem',
                            boxShadow: '0 4px 14px rgba(255,109,0,0.3)',
                            '&:hover': { backgroundColor: '#e65100', boxShadow: '0 6px 20px rgba(255,109,0,0.35)' },
                            '&.Mui-disabled': { bgcolor: '#d1d5db', color: '#9ca3af !important', boxShadow: 'none' },
                        }}
                    >
                        {isPending ? <CircularProgress size={24} color="inherit" /> : 'Analyze Session'}
                    </Button>
                </Box>

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
