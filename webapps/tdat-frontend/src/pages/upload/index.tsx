import React, { useState, useMemo } from 'react';
import type { DragEvent } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
    Box, Typography, Button, Chip, Paper, Container,
    Alert, CircularProgress, Snackbar, Alert as MuiAlert, Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAnalyzeThreads } from '@hooks/useAnalyzeThreads';
import { useAnalysisData } from '@context/AnalysisContext';

// Styled input for hidden file input
const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'visible',
    position: 'relative',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});

// File Validation
const Allowed_Extensions = ['txt', 'log'];

const validateFiles = (files: File[]): { valid: File[], invalid: boolean } => {
    const validFiles: File[] = [];
    let hasInvalid = false;

    files.forEach(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && Allowed_Extensions.includes(extension)) {
            validFiles.push(file);
        } else {
            hasInvalid = true;
        }
    });

    return { valid: validFiles, invalid: hasInvalid };
};

// File Matching Utilities

const extractFileKey = (filename: string): string => {
    // Remove file extension
    let key = filename.replace(/\.[^/.]+$/, '');

    // Strip common prefixes
    const prefixes = [
        'threaddump', 'threadusage', 'thread_dump', 'thread_usage',
        'thread-dump', 'thread-usage', 'dump', 'usage', 'td', 'tu'
    ];

    const lowerKey = key.toLowerCase();
    for (const prefix of prefixes) {
        if (lowerKey.startsWith(prefix)) {
            key = key.substring(prefix.length);
            // Remove leading separator (_, -, .)
            key = key.replace(/^[_\-.]/, '');
            break;
        }
    }

    return key.trim().toLowerCase();
};

interface PairedFile {
    dump: File | null;
    usage: File | null;
    matched: boolean;
    warning?: string;
}
// UploadCard Component

interface UploadCardProps {
    title: string;
    description: string;
    required: boolean;
    fileTypeLabel: string;
    files: File[];
    onAddFiles: (files: File[]) => void;
    onClearFiles: () => void;
    onRemoveFile: (file: File) => void;
    onError: (msg: string) => void;
}

const UploadCard: React.FC<UploadCardProps> = ({
    title, description, required, fileTypeLabel, files, onAddFiles, onClearFiles, onRemoveFile, onError
}) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const isPrimary = required;
    const borderColor = isPrimary ? '#ffab91' : '#e0e0e0';
    const bgColor = isPrimary ? '#fffbf7' : '#f8f9fa';
    const badgeColor = isPrimary ? '#ff6d00' : '#455a64';

    // Centralized file processing for Drop and Browse
    const processFiles = (incomingFiles: File[]) => {
        const { valid, invalid } = validateFiles(incomingFiles);

        if (invalid) {
            onError(`Invalid file types. Only .txt and .log files are allowed.`);
        }

        if (valid.length > 0) {
            onAddFiles(valid);
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            processFiles(Array.from(event.target.files));
        }
        event.target.value = '';
    };

    // Drag Event Handlers
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3, mb: 3, border: '1px solid', borderColor: borderColor,
                backgroundColor: bgColor, borderRadius: 2,
            }}
        >
            <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6" fontWeight="600" color="text.primary">
                    {title}
                </Typography>
                <Chip
                    label={required ? "Required" : "Optional"}
                    size="small"
                    sx={{
                        backgroundColor: badgeColor, color: 'white', fontWeight: 'bold',
                        fontSize: '0.65rem', height: 20
                    }}
                />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {description}
            </Typography>

            {/* File Upload Area */}
            <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                    border: '1px dashed',
                    borderColor: isDragActive ? '#2196f3' : 'divider',
                    borderRadius: 2,
                    backgroundColor: isDragActive ? '#e3f2fd' : 'white',
                    p: files.length > 0 ? 3 : 6,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out',
                    ...(files.length === 0 && { cursor: 'pointer', '&:hover': { backgroundColor: '#fafafa', borderColor: isPrimary ? '#ff6d00' : 'primary.main' } })
                }}
            >
                {files.length > 0 ? (
                    <Box textAlign="center" width="100%">
                        <CloudUploadIcon sx={{ fontSize: 36, color: 'success.main', mb: 1 }} />
                        <Typography variant="subtitle1" color="success.main" fontWeight="bold" gutterBottom>
                            {files.length} file(s) uploaded
                        </Typography>

                        {/* File Chips */}
                        <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center" my={2}>
                            {[...files].sort((a, b) => a.name.localeCompare(b.name)).map((file, idx) => (
                                <Chip key={idx} label={file.name} size="small" variant="outlined" onDelete={() => onRemoveFile(file)} />
                            ))}
                        </Box>

                        {/* Action Buttons */}
                        <Box display="flex" gap={2} justifyContent="center" mt={3}>
                            <Button
                                component="label"
                                variant="outlined"
                                color="primary"
                                startIcon={<AddIcon />}
                                sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.primary' }}
                            >
                                Add More Files
                                <VisuallyHiddenInput type="file" accept=".txt, .log" multiple onChange={handleInputChange} />
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={onClearFiles}
                                startIcon={<UndoIcon />}
                                sx={{ textTransform: 'none' }}
                            >
                                Undo Selection
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box textAlign="center" component="label" sx={{ width: '100%', cursor: 'pointer' }}>
                        <CloudUploadIcon sx={{ fontSize: 48, color: isDragActive ? 'primary.main' : 'text.disabled', mb: 1 }} />

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            <UploadFileIcon
                                sx={{ fontSize: 25, display: isDragActive ? 'inline-block' : 'none', verticalAlign: 'middle', mr: 1 }} />
                            {isDragActive ? "Drop files here" : `Drag and drop ${fileTypeLabel} files here`}
                        </Typography>

                        <Typography variant="caption" color="text.disabled" sx={{ mb: 2, display: 'block' }} gutterBottom>
                            or
                        </Typography>

                        <Button
                            component="span"
                            variant="contained"
                            color="inherit"
                            sx={{
                                textTransform: 'none',
                                backgroundColor: isPrimary ? '#0d1117' : '#0d1100',
                                color: 'white',
                                pointerEvents: 'none' // Let the label handle the click
                            }}
                            startIcon={<CloudUploadIcon />}
                        >
                            Browse Files
                        </Button>
                        <VisuallyHiddenInput type="file" accept=".txt,.log" multiple onChange={handleInputChange} />
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

/* Main Page Component*/

function UploadPage() {
    const navigate = useNavigate();
    const { setAnalysisData } = useAnalysisData();

    // State for files and errors
    const [dumps, setDumps] = useState<File[]>([]);
    const [usages, setUsages] = useState<File[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Sort files alphabetically
    const sortedDumps = [...dumps].sort((a, b) => a.name.localeCompare(b.name));
    const sortedUsages = [...usages].sort((a, b) => a.name.localeCompare(b.name));

    // Build paired files with key-based matching
    const pairedFiles = useMemo<PairedFile[]>(() => {
        // If no usages uploaded, just list dumps without warnings
        if (sortedUsages.length === 0) {
            return sortedDumps.map(dump => ({
                dump,
                usage: null,
                matched: true,
            }));
        }

        const pairs: PairedFile[] = [];

        // Index usage files by their extracted key
        const usageByKey = new Map<string, File>();
        sortedUsages.forEach(file => {
            const key = extractFileKey(file.name);
            usageByKey.set(key, file);
        });

        // Match each dump to a usage by extracted key
        const matchedUsageKeys = new Set<string>();
        sortedDumps.forEach(dump => {
            const dumpKey = extractFileKey(dump.name);
            const usage = usageByKey.get(dumpKey) ?? null;

            if (usage) {
                matchedUsageKeys.add(dumpKey);
                pairs.push({ dump, usage, matched: true });
            } else {
                pairs.push({
                    dump,
                    usage: null,
                    matched: false,
                    warning: `No matching usage file found (key: "${dumpKey}")`,
                });
            }
        });

        // Add any unmatched usage files
        sortedUsages.forEach(file => {
            const usageKey = extractFileKey(file.name);
            if (!matchedUsageKeys.has(usageKey)) {
                pairs.push({
                    dump: null,
                    usage: file,
                    matched: false,
                    warning: `No matching thread dump found (key: "${usageKey}")`,
                });
            }
        });

        return pairs;
    }, [sortedDumps, sortedUsages]);

    const hasWarnings = pairedFiles.some(p => !p.matched);

    // API Hook
    const { mutate, isPending, error } = useAnalyzeThreads();

    const handleAnalyzeClick = () => {
        if (dumps.length === 0) return;

        // Send the consistently sorted files to the backend
        mutate(
            { dumps: sortedDumps, usages: sortedUsages },
            {
                onSuccess: (data) => {
                    // Check if the backend explicitly returned an array of errors
                    if (data.errors && data.errors.length > 0) {
                        // Join the backend errors and display them
                        setErrorMsg(`Invalid file(s) uploaded: ${data.errors.join(' | ')}. Please ensure you upload proper thread dumps.`);
                        return; 
                    }

                    // Fallback check
                    if (!data.threads || data.threads.length === 0) {
                        setErrorMsg("Invalid file(s) uploaded: No threads were found in the provided files. Please re-upload proper thread dumps.");
                        return;
                    }

                    // If everything is valid, proceed to the dashboard
                    setAnalysisData(data);
                    navigate('/dashboard');
                },
                onError: (err) => {
                    // Catches network failures
                    setErrorMsg(`Analysis failed: ${err.message}`);
                }
            }
        );
    };

    const handleCloseError = () => setErrorMsg(null);

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Box mb={4}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Start New Analysis Session
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Upload thread dump files and their corresponding Thread Usage metrics to begin analysis
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Analysis failed: {error.message}
                </Alert>
            )}

            {/* Upload Card for Thread Dump */}
            <UploadCard
                title="Add Thread Dump Files"
                description="Upload one or more thread dump files (.txt, .log or similar)"
                required={true}
                fileTypeLabel="thread dump"
                files={dumps}
                onAddFiles={(newFiles) => {
                    setDumps(prev => {
                        const existingNames = new Set(prev.map(f => f.name));
                        const unique = newFiles.filter(f => !existingNames.has(f.name));
                        const skipped = newFiles.length - unique.length;
                        if (skipped > 0) setErrorMsg(`${skipped} duplicate file(s) were skipped.`);
                        return [...prev, ...unique];
                    });
                }}
                onClearFiles={() => setDumps([])}
                onRemoveFile={(file) => setDumps(prev => prev.filter(f => f !== file))}
                onError={setErrorMsg}
            />

            {/* Upload Card for Thread Usage */}
            <UploadCard
                title="Add Thread Usage Files"
                description="Upload CPU usage metrics to enhance analysis"
                required={false}
                fileTypeLabel="usage"
                files={usages}
                onAddFiles={(newFiles) => {
                    setUsages(prev => {
                        const existingNames = new Set(prev.map(f => f.name));
                        const unique = newFiles.filter(f => !existingNames.has(f.name));
                        const skipped = newFiles.length - unique.length;
                        if (skipped > 0) setErrorMsg(`${skipped} duplicate file(s) were skipped.`);
                        return [...prev, ...unique];
                    });
                }}
                onClearFiles={() => setUsages([])}
                onRemoveFile={(file) => setUsages(prev => prev.filter(f => f !== file))}
                onError={setErrorMsg}
            />

            {/* File Matching Overview if files exist */}
            {(dumps.length > 0 || usages.length > 0) && (
                <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#fafafa' }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                            Paired Files
                        </Typography>
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
                                {/* Dump column */}
                                <Box flex={1} borderRight="1px solid #f0f0f0" pr={2}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Thread Dump
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color={pair.dump ? 'text.primary' : 'error.main'}
                                        fontWeight="500"
                                    >
                                        {pair.dump ? pair.dump.name : 'No matching Thread Dump'}
                                    </Typography>
                                </Box>

                                {/* Usage column */}
                                <Box flex={1} pl={2}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Thread Usage
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color={pair.usage ? 'text.primary' : 'warning.main'}
                                        fontWeight="500"
                                    >
                                        {pair.usage ? pair.usage.name : 'No Usage File'}
                                    </Typography>
                                </Box>

                                {/* Status icon */}
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
                        textTransform: 'none', px: 4, py: 1,
                        backgroundColor: '#ff6d00', color: 'white !important'
                    }}
                >
                    {isPending ? <CircularProgress size={24} color="inherit" /> : "Analyze Session"}
                </Button>
            </Box>

            {/* Snackbar for Validation Errors */}
            <Snackbar
                open={!!errorMsg}
                autoHideDuration={4000}
                onClose={handleCloseError}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
                    {errorMsg}
                </MuiAlert>
            </Snackbar>
        </Container>
    );
}

export default UploadPage;