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

import React, { useMemo, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Collapse,
    Divider,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'info'];

const SEVERITY_TITLE: Record<FindingSeverity, string> = {
    critical: 'Critical Risk',
    high: 'High Risk',
    medium: 'Medium Risk',
    info: 'Informational',
};

const iconForSeverity = (severity: FindingSeverity) =>
    severity === 'critical' ? ErrorOutlineIcon
        : severity === 'info' ? InfoOutlinedIcon
            : WarningAmberIcon;

const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ keyFindings, onThreadClick }) => {
    const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
    const [expanded, setExpanded] = useState(true);
    const dialogOpen = selectedFinding !== null;
    const closeDialog = () => setSelectedFinding(null);

    const groupedFindings = useMemo(() => {
        const groups = new Map<FindingSeverity, FindingItem[]>();
        keyFindings.forEach(f => {
            const list = groups.get(f.severity) ?? [];
            list.push(f);
            groups.set(f.severity, list);
        });
        return SEVERITY_ORDER
            .filter(sev => groups.has(sev))
            .map(severity => ({ severity, findings: groups.get(severity)! }));
    }, [keyFindings]);

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
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
                    <Box flex={1} minWidth={0}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                            Key Findings
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mb={expanded ? 2 : 0}>
                            Critical issues and patterns detected by the analysis engine
                            {!expanded && keyFindings.length > 0 && ` — ${keyFindings.length} ${keyFindings.length === 1 ? 'issue' : 'issues'}`}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={() => setExpanded(e => !e)}
                        aria-label={expanded ? 'Collapse key findings' : 'Expand key findings'}
                        aria-expanded={expanded}
                        sx={{
                            color: 'text.secondary',
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                </Box>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                {keyFindings.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" fontStyle="italic">
                        No critical issues detected in this analysis.
                    </Typography>
                ) : (
                    <Box display="flex" flexDirection="column" gap={2}>
                        {groupedFindings.map(({ severity, findings }) => {
                            const SeverityIcon = iconForSeverity(severity);
                            const totalThreads = findings.reduce((sum, f) => sum + f.affectedThreads.length, 0);
                            return (
                                <Box
                                    key={severity}
                                    sx={(theme) => {
                                        const tokens = theme.palette.severity[severity];
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
                                    {/* Band header */}
                                    <Box display="flex" alignItems="center" gap={0.75} mb={1.25}>
                                        <SeverityIcon
                                            sx={(theme) => ({
                                                fontSize: 18,
                                                color: theme.palette.severity[severity].main,
                                            })}
                                        />
                                        <Typography
                                            variant="caption"
                                            fontWeight={700}
                                            sx={(theme) => ({
                                                color: theme.palette.severity[severity].text,
                                                fontSize: '0.75rem',
                                                letterSpacing: '0.03em',
                                                textTransform: 'uppercase',
                                            })}
                                        >
                                            {SEVERITY_TITLE[severity]}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                            — {findings.length} {findings.length === 1 ? 'issue' : 'issues'}, {totalThreads} thread{totalThreads !== 1 ? 's' : ''} affected
                                        </Typography>
                                    </Box>

                                    {/* Sub-findings */}
                                    <Box display="flex" flexDirection="column" gap={1.25}>
                                        {findings.map((finding, idx) => {
                                            // Show up to 8 threads before displaying "+X more" chip to avoid UI clutter
                                            const overflowCount = finding.affectedThreads.length - 8;
                                            return (
                                                <Box key={finding.label}>
                                                    {idx > 0 && (
                                                        <Divider sx={(theme) => ({
                                                            mb: 1.25,
                                                            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                        })} />
                                                    )}

                                                    {/* Sub-finding title row */}
                                                    <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight={700}
                                                            sx={(theme) => ({ color: theme.palette.severity[severity].text })}
                                                        >
                                                            {finding.label}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                                            — {finding.affectedThreads.length} thread{finding.affectedThreads.length !== 1 ? 's' : ''}
                                                        </Typography>
                                                    </Box>

                                                    {/* Description */}
                                                    <Typography variant="caption" display="block" mb={1} sx={{ color: 'text.secondary', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                                        {finding.description}
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
                                                                    const tokens = theme.palette.severity[severity];
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
                                </Box>
                            );
                        })}
                    </Box>
                )}
                </Collapse>
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
