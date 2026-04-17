import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';

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

const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ keyFindings, onThreadClick }) => (
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
                {keyFindings.map((finding, idx) => (
                    <Box
                        key={idx}
                        sx={(theme) => {
                            const tokens = theme.palette.severity[finding.severity];
                            return {
                                borderLeft: `3px solid ${tokens.border}`,
                                bgcolor: tokens.bg,
                                p: 1.5,
                                borderRadius: '0 6px 6px 0',
                            };
                        }}
                    >
                        {/* Issue label + count */}
                        <Box display="flex" alignItems="baseline" gap={1} mb={0.5}>
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
                                    sx={(theme) => {
                                        const tokens = theme.palette.severity[finding.severity];
                                        return {
                                            fontSize: '0.6rem',
                                            height: 20,
                                            cursor: 'pointer',
                                            bgcolor: theme.palette.background.paper,
                                            border: `1px solid ${tokens.border}`,
                                            color: tokens.text,
                                            fontFamily: 'monospace',
                                            fontWeight: 600,
                                            maxWidth: 180,
                                            '&:hover': { opacity: 0.75 },
                                        };
                                    }}
                                />
                            ))}
                            {finding.affectedThreads.length > 8 && (
                                <Chip
                                    label={`+${finding.affectedThreads.length - 8} more`}
                                    size="small"
                                    sx={(theme) => ({
                                        fontSize: '0.6rem',
                                        height: 20,
                                        bgcolor: theme.palette.surface.inset,
                                        color: theme.palette.text.secondary,
                                    })}
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
