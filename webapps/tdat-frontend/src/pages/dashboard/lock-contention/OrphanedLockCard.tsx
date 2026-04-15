import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Divider, Tooltip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { OrphanedLock } from '../../../utils/lockContentionAnalysis';
import VictimRow from './VictimRow';

const ORPHAN_VICTIM_LIMIT = 10;

interface OrphanedLockCardProps {
    lock: OrphanedLock;
    onThreadClick: (name: string) => void;
}

const OrphanedLockCard: React.FC<OrphanedLockCardProps> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, ORPHAN_VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - ORPHAN_VICTIM_LIMIT;

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={{
                mb: 1.5,
                border: '1px solid rgba(253,186,116,0.4)',
                borderRadius: '12px !important',
                bgcolor: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { mb: 1.5 },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#e65100' }} />}
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
                <LockOutlinedIcon sx={{ fontSize: 16, color: '#bbb', flexShrink: 0 }} />
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#333', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                        &lt;{lock.address}&gt;
                    </Typography>
                    <Tooltip title={lock.className} placement="top">
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#888',
                                fontSize: '0.72rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: { xs: 160, sm: 320, md: 500 },
                                cursor: 'default',
                            }}
                        >
                            {shortName}
                        </Typography>
                    </Tooltip>
                </Box>
                <Chip
                    label={`${lock.victims.length} Blocked`}
                    size="small"
                    sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: '0.68rem', height: 22, flexShrink: 0 }}
                />
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
                <Box sx={{ px: 2, py: 0.75, bgcolor: '#f5f5f5', borderTop: '1px solid #ffe0b2', borderBottom: '1px solid #eeeeee' }}>
                    <Typography variant="caption" sx={{ color: '#777', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {lock.className}
                    </Typography>
                </Box>

                {lock.victims.length === 0 ? (
                    <Box sx={{ px: 2, py: 2, bgcolor: '#fafafa', textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            No blocked threads recorded for this monitor.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {visibleVictims.map((victim, idx) => (
                            <React.Fragment key={victim.thread.id}>
                                {idx > 0 && <Divider />}
                                <VictimRow victim={victim} onThreadClick={onThreadClick} />
                            </React.Fragment>
                        ))}
                        {hiddenCount > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ textAlign: 'center', py: 0.5, bgcolor: '#fafafa' }}>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => setShowAll(v => !v)}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#e65100' }}
                                    >
                                        {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                    </Button>
                                </Box>
                            </>
                        )}
                    </>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

export default OrphanedLockCard;
