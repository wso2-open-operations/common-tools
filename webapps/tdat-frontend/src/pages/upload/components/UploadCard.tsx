import React, { useState } from 'react';
import type { DragEvent } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import { Box, Typography, Button, Chip, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { validateFiles } from '../../../utils/uploadValidation';

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

export interface UploadCardProps {
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
    title, description, required, fileTypeLabel, files, onAddFiles, onClearFiles, onRemoveFile, onError,
}) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const isPrimary = required;
    const borderColor = isPrimary ? '#ffab91' : '#e0e0e0';
    const bgColor = isPrimary ? '#fffbf7' : '#f8f9fa';
    const badgeColor = isPrimary ? '#ff6d00' : '#455a64';

    const processFiles = (incomingFiles: File[]) => {
        const { valid, invalid } = validateFiles(incomingFiles);
        if (invalid) onError('Invalid file types. Only .txt and .log files are allowed.');
        if (valid.length > 0) onAddFiles(valid);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            processFiles(Array.from(event.target.files));
        }
        event.target.value = '';
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{ p: 3, mb: 3, border: '1px solid', borderColor, backgroundColor: bgColor, borderRadius: 2 }}
        >
            <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6" fontWeight="600" color="text.primary">{title}</Typography>
                <Chip
                    label={required ? 'Required' : 'Optional'}
                    size="small"
                    sx={{ backgroundColor: badgeColor, color: 'white', fontWeight: 'bold', fontSize: '0.65rem', height: 20 }}
                />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {description}
            </Typography>

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
                    ...(files.length === 0 && {
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: '#fafafa', borderColor: isPrimary ? '#ff6d00' : 'primary.main' },
                    }),
                }}
            >
                {files.length > 0 ? (
                    <Box textAlign="center" width="100%">
                        <CloudUploadIcon sx={{ fontSize: 36, color: 'success.main', mb: 1 }} />
                        <Typography variant="subtitle1" color="success.main" fontWeight="bold" gutterBottom>
                            {files.length} file(s) uploaded
                        </Typography>

                        <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center" my={2}>
                            {[...files].sort((a, b) => a.name.localeCompare(b.name)).map((file, idx) => (
                                <Chip key={idx} label={file.name} size="small" variant="outlined" onDelete={() => onRemoveFile(file)} />
                            ))}
                        </Box>

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
                                sx={{ fontSize: 25, display: isDragActive ? 'inline-block' : 'none', verticalAlign: 'middle', mr: 1 }}
                            />
                            {isDragActive ? 'Drop files here' : `Drag and drop ${fileTypeLabel} files here`}
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
                                pointerEvents: 'none',
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

export default UploadCard;
