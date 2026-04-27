import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'info';

interface FindingItem {
    label: string;
    description: string;
    severity: FindingSeverity;
    affectedThreads: string[];
}

interface KeyFindingsCardProps {
    keyFindings: FindingItem[];
    onThreadClick: (name: string) => void;
}

const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ keyFindings, onThreadClick }) => {
    const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
    const dialogOpen = selectedFinding !== null;
    const closeDialog = () => setSelectedFinding(null);

    return (
        <>
            <Paper
                sx={(theme) => ({
                    flex: 4,
                    p: 2.5,
                    borderRadius: 3,
                    minWidth: 220,
                    bgcolor: theme.palette.surface.translucent,
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${theme.palette.surface.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                })}
            >
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Key Findings
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Critical issues and patterns detected by the analysis engine
                </Typography>
                {keyFindings.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" fontStyle="italic">
                        No critical issues detected in this analysis.
                    </Typography>
                ) : (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                        {keyFindings.map((finding, idx) => {
                            const SeverityIcon =
                                finding.severity === 'critical' ? ErrorOutlineIcon
                                    : finding.severity === 'info' ? InfoOutlinedIcon
                                        : WarningAmberIcon;
                            const overflowCount = finding.affectedThreads.length - 8;
                            return (
                                <Box
                                    key={idx}
                                    sx={(theme) => {
                                        const tokens = theme.palette.severity[finding.severity];
                                        const isDark = theme.palette.mode === 'dark';
                                        return {
                                            borderLeft: `4px solid ${tokens.main}`,
                                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                            p: 2,
                                            pl: 2.5,
                                            borderRadius: '0 8px 8px 0',
                                        };
                                    }}
                                >
                                    {/* Title row with icon */}
                                    <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                                        <SeverityIcon
                                            sx={(theme) => ({
                                                fontSize: 16,
                                                color: theme.palette.severity[finding.severity].main,
                                            })}
                                        />
                                        <Typography
                                            variant="caption"
                                            fontWeight={700}
                                            sx={(theme) => ({ color: theme.palette.severity[finding.severity].text })}
                                        >
                                            {finding.label}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                            — {finding.affectedThreads.length} thread{finding.affectedThreads.length !== 1 ? 's' : ''} affected
                                        </Typography>
                                    </Box>

                                    {/* Description */}
                                    <Typography variant="caption" display="block" mb={1} sx={{ color: 'text.secondary', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {finding.description}
                                    </Typography>

                                    {/* Affected threads label */}
                                    <Typography
                                        variant="caption"
                                        display="block"
                                        mb={0.75}
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Affected Threads
                                    </Typography>

                                    {/* Thread chips — soft filled */}
                                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                                        {finding.affectedThreads.slice(0, 8).map((name, i) => (
                                            <Chip
                                                key={i}
                                                label={name}
                                                size="small"
                                                onClick={() => onThreadClick(name)}
                                                sx={(theme) => {
                                                    const tokens = theme.palette.severity[finding.severity];
                                                    return {
                                                        fontSize: '0.6rem',
                                                        height: 20,
                                                        cursor: 'pointer',
                                                        bgcolor: tokens.bg,
                                                        border: 'none',
                                                        color: tokens.text,
                                                        fontFamily: 'monospace',
                                                        fontWeight: 600,
                                                        maxWidth: 180,
                                                        '&:hover': {
                                                            bgcolor: tokens.bg,
                                                            opacity: 0.8,
                                                        },
                                                    };
                                                }}
                                            />
                                        ))}
                                        {overflowCount > 0 && (
                                            <Chip
                                                label={`+${overflowCount} more`}
                                                size="small"
                                                onClick={() => setSelectedFinding(finding)}
                                                sx={(theme) => ({
                                                    fontSize: '0.6rem',
                                                    height: 20,
                                                    cursor: 'pointer',
                                                    bgcolor: theme.palette.surface.inset,
                                                    color: theme.palette.text.secondary,
                                                    border: 'none',
                                                    fontWeight: 600,
                                                    transition: 'background-color 0.15s ease, color 0.15s ease',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.surface.borderStrong,
                                                        color: theme.palette.text.primary,
                                                    },
                                                })}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Paper>

            <Dialog
                open={dialogOpen}
                onClose={closeDialog}
                maxWidth="sm"
                fullWidth
                slotProps={{
                    paper: {
                        sx: (theme) => ({
                            bgcolor: theme.palette.background.paper,
                            backgroundImage: 'none',
                            borderRadius: 3,
                        }),
                    },
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    {selectedFinding && (
                        <Box display="flex" alignItems="center" gap={1}>
                            {(() => {
                                const Icon =
                                    selectedFinding.severity === 'critical' ? ErrorOutlineIcon
                                        : selectedFinding.severity === 'info' ? InfoOutlinedIcon
                                            : WarningAmberIcon;
                                return (
                                    <Icon
                                        sx={(theme) => ({
                                            fontSize: 20,
                                            color: theme.palette.severity[selectedFinding.severity].main,
                                        })}
                                    />
                                );
                            })()}
                            <Typography
                                variant="subtitle1"
                                fontWeight={700}
                                sx={(theme) => ({ color: theme.palette.severity[selectedFinding.severity].text })}
                            >
                                {selectedFinding.label} — All Affected Threads
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                                ({selectedFinding.affectedThreads.length})
                            </Typography>
                        </Box>
                    )}
                </DialogTitle>
                <DialogContent dividers>
                    {selectedFinding && (
                        <Box display="flex" flexWrap="wrap" gap={0.75}>
                            {selectedFinding.affectedThreads.map((name, i) => (
                                <Chip
                                    key={i}
                                    label={name}
                                    size="small"
                                    onClick={() => {
                                        onThreadClick(name);
                                        closeDialog();
                                    }}
                                    sx={(theme) => {
                                        const tokens = theme.palette.severity[selectedFinding.severity];
                                        return {
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            bgcolor: tokens.bg,
                                            border: 'none',
                                            color: tokens.text,
                                            fontFamily: 'monospace',
                                            fontWeight: 600,
                                            maxWidth: '100%',
                                            '&:hover': { bgcolor: tokens.bg, opacity: 0.8 },
                                        };
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} variant="text">Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default KeyFindingsCard;
