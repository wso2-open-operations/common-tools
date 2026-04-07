import { useState, useMemo } from 'react';
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
        <>
            <Header isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
            <Container maxWidth="md" sx={{ py: 6 }}>
                <Box>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>Start New Analysis Session</Typography>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                        Upload thread dump files and their corresponding Thread Usage metrics to begin analysis
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3 }}>Analysis failed: {error.message}</Alert>}

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

                {/* File Pairing Overview */}
                {(dumps.length > 0 || usages.length > 0) && (
                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#fafafa' }}>
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
                        sx={{ textTransform: 'none', px: 4, py: 1, backgroundColor: '#ff6d00', color: 'white !important' }}
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
        </>
    );
}
export default UploadPage;
