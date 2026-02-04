import React, { useState } from 'react';
import type { DragEvent } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
    Box, Typography, Button, Chip, Paper, Container,
    Alert, CircularProgress, Snackbar, Alert as MuiAlert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAnalyzeThreads } from '../hooks/useAnalyzeThreads';
import { useAnalysisData } from '../context/AnalysisContext';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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

// UploadCard Component
interface UploadCardProps {
    title: string;
    description: string;
    required: boolean;
    fileTypeLabel: string;
    onFileSelect: (files: File[]) => void;
    selectedCount: number;
    onError: (msg: string) => void; // New prop for error handling
}

const UploadCard: React.FC<UploadCardProps> = ({
    title, description, required, fileTypeLabel, onFileSelect, selectedCount, onError
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
            onFileSelect(valid);
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            processFiles(Array.from(event.target.files));
        }
        event.target.value = ''; // Reset to allow re-selecting same file
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
                    p: 6, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { backgroundColor: '#fafafa', borderColor: isPrimary ? '#ff6d00' : 'primary.main' },
                }}
            >
                <VisuallyHiddenInput
                    type="file"
                    accept=".txt, .log"
                    multiple onChange={handleInputChange}
                />

                {selectedCount > 0 ? (
                    <Box textAlign="center">
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                        <Typography variant="h6" color="success.main">
                            {selectedCount} file(s) selected
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Click or drag to change selection
                        </Typography>
                    </Box>
                ) : (
                    <Box textAlign="center">
                        <CloudUploadIcon sx={{ fontSize: 48, color: isDragActive ? 'primary.main' : 'text.disabled', mb: 1 }} />

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            <UploadFileIcon sx={{ fontSize: 25, display: isDragActive ? 'block' : 'none' }} />
                            {isDragActive ? "Drop files here" : `Drag and drop ${fileTypeLabel} files here`}
                        </Typography>

                        <Typography variant="caption" color="text.disabled" sx={{ mb: 2 }} gutterBottom>
                            or
                        </Typography>

                        <Typography align='inherit'>
                            <Button
                                component="label"
                                variant={"contained"}
                                color="inherit"
                                sx={{
                                    textTransform: 'none',
                                    backgroundColor: isPrimary ? '#0d1117' : '#0d1100',
                                    color: 'white',
                                    borderColor: 'divider',
                                }}
                                startIcon={<CloudUploadIcon />}
                            >
                                Browse Files
                                <VisuallyHiddenInput
                                    type="file"
                                    accept=".txt,.log"
                                    multiple onChange={handleInputChange}
                                />
                            </Button>
                        </Typography>
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

// Main Page Component
function UploadPage() {
    const navigate = useNavigate();
    const { setAnalysisData } = useAnalysisData();

    // State for files and errors
    const [dumps, setDumps] = useState<File[]>([]);
    const [usages, setUsages] = useState<File[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // API Hook
    const { mutate, isPending, error } = useAnalyzeThreads();

    const handleAnalyzeClick = () => {
        if (dumps.length === 0) return;

        mutate(
            { dumps, usages },
            {
                onSuccess: (data) => {
                    setAnalysisData(data);
                    navigate('/dashboard/thread-explorer');
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

            <UploadCard
                title="Add Thread Dump Files"
                description="Upload one or more thread dump files (.txt, .log or similar)"
                required={true}
                fileTypeLabel="thread dump"
                onFileSelect={setDumps}
                selectedCount={dumps.length}
                onError={setErrorMsg}
            />

            <UploadCard
                title="Add Thread Usage Files"
                description="Upload CPU usage metrics to enhance analysis"
                required={false}
                fileTypeLabel="usage"
                onFileSelect={setUsages}
                selectedCount={usages.length}
                onError={setErrorMsg}
            />

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