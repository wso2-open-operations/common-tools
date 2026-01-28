import React, { useState } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Box, Typography, Button, Chip, Paper, Container, Alert, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAnalyzeThreads } from '../hooks/useAnalyzeThreads';
import { useAnalysisData } from '../context/AnalysisContext';
import StarIcon from '@mui/icons-material/Star';

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

// UploadCard Component
interface UploadCardProps {
    title: string;
    description: string;
    required: boolean;
    fileTypeLabel: string;
    onFileSelect: (files: File[]) => void;
    selectedCount: number;
}

const UploadCard: React.FC<UploadCardProps> = ({
    title, description, required, fileTypeLabel, onFileSelect, selectedCount
}) => {
    const isPrimary = required;
    const borderColor = isPrimary ? '#ffab91' : '#e0e0e0';
    const bgColor = isPrimary ? '#fffbf7' : '#f8f9fa';
    const badgeColor = isPrimary ? '#ff6d00' : '#455a64';

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onFileSelect(Array.from(event.target.files));
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
                {isPrimary && (
                    <Box component="span" sx={{ color: '#ff6d00', fontSize: '1.5rem', lineHeight: 0 }}>
                        <StarIcon fontSize="inherit" />
                    </Box>
                )}
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
                component="label"
                sx={{
                    border: '1px dashed', borderColor: 'divider', borderRadius: 2,
                    backgroundColor: 'white', p: 6, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { backgroundColor: '#fafafa', borderColor: isPrimary ? '#ff6d00' : 'primary.main' },
                }}
            >
                <VisuallyHiddenInput type="file" multiple onChange={handleInputChange} />

                {selectedCount > 0 ? (
                    <Box textAlign="center">
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                        <Typography variant="h6" color="success.main">
                            {selectedCount} file(s) selected
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Click to change selection
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Drag and drop {fileTypeLabel} files here
                        </Typography>

                        <Typography variant="caption" color="text.disabled" sx={{ mb: 2 }}>
                            or
                        </Typography>

                        <Button
                            component="span"
                            variant={isPrimary ? "contained" : "outlined"}
                            color="inherit"
                            sx={{
                                textTransform: 'none',
                                pointerEvents: 'none',
                                backgroundColor: isPrimary ? '#0d1117' : '#0d1100',
                                color: 'white',
                                borderColor: 'divider',
                            }}
                            startIcon={<CloudUploadIcon />}
                        >
                            Browse Files
                        </Button>
                    </>
                )}
            </Box>
        </Paper>
    );
};

// Main Page Component
function UploadPage() {
    const navigate = useNavigate();
    const { setAnalysisData } = useAnalysisData(); // Use Context Hook

    // State for files
    const [dumps, setDumps] = useState<File[]>([]);
    const [usages, setUsages] = useState<File[]>([]);

    // API Hook
    const { mutate, isPending, error } = useAnalyzeThreads();

    const handleAnalyzeClick = () => {
        if (dumps.length === 0) return;

        mutate(
            { dumps, usages },
            {
                onSuccess: (data) => {
                    // Save data to Global Context
                    setAnalysisData(data);

                    // Navigate to the Explorer view directly
                    navigate('/dashboard/thread-explorer');
                }
            }
        );
    };

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Box mb={4}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Start New Analysis Session
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Upload thread dump files and their corresponding CPU usage metrics to begin analysis
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
            />

            <UploadCard
                title="Add Thread Usage Files"
                description="Upload CPU usage metrics to enhance analysis"
                required={false}
                fileTypeLabel="usage"
                onFileSelect={setUsages}
                selectedCount={usages.length}
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
        </Container>
    );
}

export default UploadPage;