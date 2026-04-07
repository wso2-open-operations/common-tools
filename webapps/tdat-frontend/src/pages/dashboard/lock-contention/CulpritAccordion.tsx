import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ThreadStateChip from '@component/ui/ThreadStateChip';
import type { CulpritEntry } from '../../../utils/lockContentionAnalysis';
import MonitorSection from './MonitorSection';

interface CulpritAccordionProps {
    entry: CulpritEntry;
    onThreadClick: (name: string) => void;
}

const CulpritAccordion: React.FC<CulpritAccordionProps> = ({ entry, onThreadClick }) => {
    const monitorCount = entry.heldLocks.length;
    const victimCount = entry.totalVictims;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={{
                mb: 1,
                border: '1px solid #e0e0e0',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1 },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#aaa' }} />}
                sx={{
                    px: 2,
                    minHeight: 48,
                    '& .MuiAccordionSummary-content': {
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        my: 0.75,
                    },
                }}
            >
                <Typography
                    variant="body2"
                    onClick={(e) => { e.stopPropagation(); onThreadClick(entry.thread.name); }}
                    sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#1565c0',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '100%', sm: 320, md: 480 },
                    }}
                    title={entry.thread.name}
                >
                    {entry.thread.name}
                </Typography>
                <ThreadStateChip state={entry.snapshot.state} />

                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#e65100', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        Holding {monitorCount} Monitor{monitorCount !== 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#ccc', mx: 0.25 }}>|</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#c62828', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        Blocking {victimCount} Thread{victimCount !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2, pt: 1.5 }}>
                {entry.heldLocks.map(lock => (
                    <MonitorSection key={lock.address} lock={lock} onThreadClick={onThreadClick} />
                ))}
            </AccordionDetails>
        </Accordion>
    );
};

export default CulpritAccordion;
