import React, { useState } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { LockWithVictims } from '../../../utils/lockContentionAnalysis';
import VictimRow from './VictimRow';

const VICTIM_LIMIT = 5;

interface MonitorSectionProps {
    lock: LockWithVictims;
    onThreadClick: (name: string) => void;
}

const MonitorSection: React.FC<MonitorSectionProps> = ({ lock, onThreadClick }) => {
    const [showAll, setShowAll] = useState(false);

    const shortName = lock.className.split('.').pop() ?? lock.className;
    const visibleVictims = showAll ? lock.victims : lock.victims.slice(0, VICTIM_LIMIT);
    const hiddenCount = lock.victims.length - VICTIM_LIMIT;

    return (
        <Box sx={{ mb: 2, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2.5, overflow: 'hidden' }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 2,
                    py: 0.9,
                    bgcolor: 'rgba(249,250,251,0.6)',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <LockOutlinedIcon sx={{ fontSize: 14, color: '#555', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#333', fontSize: '0.8rem' }}>
                    {shortName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#777', fontSize: '0.73rem' }}>
                    ( {lock.className} )
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#999', fontSize: '0.72rem' }}>
                    &lt;{lock.address}&gt;
                </Typography>
                <Typography variant="caption" sx={{ ml: 'auto', color: '#888', whiteSpace: 'nowrap' }}>
                    {lock.victims.length} blocked thread{lock.victims.length !== 1 ? 's' : ''}
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
                                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#1565c0' }}
                                >
                                    {showAll ? 'Show fewer' : `Show all ${lock.victims.length} threads`}
                                </Button>
                            </Box>
                        </>
                    )}
                </>
            )}
        </Box>
    );
};

export default MonitorSection;
