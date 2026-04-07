import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';

interface FindingItem {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    affectedThreads: string[];
}

interface KeyFindingsCardProps {
    keyFindings: FindingItem[];
    onThreadClick: (name: string) => void;
}

const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ keyFindings, onThreadClick }) => (
    <Paper elevation={0} variant="outlined" sx={{ flex: 4, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0', minWidth: 220 }}>
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
                {keyFindings.map((finding, idx) => (
                    <Box
                        key={idx}
                        sx={{ borderLeft: `3px solid ${finding.color}`, bgcolor: finding.bgColor, p: 1.5, borderRadius: '0 6px 6px 0' }}
                    >
                        {/* Issue label + count */}
                        <Box display="flex" alignItems="baseline" gap={1} mb={0.5}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: finding.color }}>
                                {finding.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                — {finding.affectedThreads.length} thread{finding.affectedThreads.length !== 1 ? 's' : ''} affected
                            </Typography>
                        </Box>

                        {/* Description */}
                        <Typography variant="caption" display="block" mb={0.75} sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                            {finding.description}
                        </Typography>

                        {/* Affected threads label */}
                        <Typography
                            variant="caption"
                            display="block"
                            mb={0.5}
                            sx={{ color: 'text.disabled', fontSize: '0.65rem', letterSpacing: 0.4, textTransform: 'uppercase' }}
                        >
                            Affected Threads
                        </Typography>

                        {/* Thread chips */}
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {finding.affectedThreads.slice(0, 8).map((name, i) => (
                                <Chip
                                    key={i}
                                    label={name}
                                    size="small"
                                    onClick={() => onThreadClick(name)}
                                    sx={{
                                        fontSize: '0.6rem',
                                        height: 20,
                                        cursor: 'pointer',
                                        bgcolor: 'white',
                                        border: `1px solid ${finding.color}`,
                                        color: finding.color,
                                        fontFamily: 'monospace',
                                        fontWeight: 600,
                                        maxWidth: 180,
                                        '&:hover': { opacity: 0.75 },
                                    }}
                                />
                            ))}
                            {finding.affectedThreads.length > 8 && (
                                <Chip
                                    label={`+${finding.affectedThreads.length - 8} more`}
                                    size="small"
                                    sx={{ fontSize: '0.6rem', height: 20, bgcolor: '#f5f5f5', color: '#666' }}
                                />
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>
        )}
    </Paper>
);

export default KeyFindingsCard;
