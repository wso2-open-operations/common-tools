import React, { useState, useMemo } from 'react';
import { 
  Box, Paper, Typography, Chip, IconButton, 
  Collapse, List, ListItemButton, ListItemText, 
  Divider, Container 
} from '@mui/material';
import Grid from '@mui/material/Grid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { LineChart } from '@mui/x-charts/LineChart';
import { useAnalysisData } from '../../context/AnalysisContext';
import type { Thread, ThreadSnapshot } from '../../types/api';

// --- Helper: Stack Trace Viewer ---
const StackTraceViewer: React.FC<{ snapshot: ThreadSnapshot; index: number }> = ({ snapshot, index }) => (
  <Box sx={{ mt: 2, mb: 3 }}>
    <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#555' }}>
            Dump {index + 1}
        </Typography>
        <Chip 
            label={snapshot.state} 
            size="small" 
            color={snapshot.state === 'RUNNABLE' ? 'success' : 'warning'} 
            variant="outlined" 
        />
        <Typography variant="caption" color="text.secondary">
            CPU: {snapshot.cpu_percent.toFixed(2)}% | User Time: {snapshot.cpu_time_ms}ms
        </Typography>
    </Box>
    <Paper 
        variant="outlined" 
        sx={{ 
            p: 2, 
            bgcolor: '#0d1117', // Github Dark dim
            color: '#c9d1d9', 
            fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
            fontSize: '0.8rem',
            overflowX: 'auto',
            borderRadius: 2
        }}
    >
        <pre style={{ margin: 0 }}>
            {snapshot.stack_trace && snapshot.stack_trace.length > 0 
                ? snapshot.stack_trace.join('\n') 
                : "No stack trace available."}
        </pre>
    </Paper>
  </Box>
);

// --- Helper: Single Thread Row ---
const ThreadRow: React.FC<{ thread: Thread }> = ({ thread }) => {
    const [open, setOpen] = useState(false);
    const lastSnap = thread.snapshots[thread.snapshots.length - 1];

    // Chart Data
    const chartData = thread.snapshots.map((s, i) => ({ x: i + 1, y: s.cpu_percent }));

    return (
        <Paper sx={{ mb: 2, overflow: 'hidden' }} variant="outlined">
            {/* Thread Header Row */}
            <Box 
                sx={{ p: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: open ? '#f8f9fa' : 'white' }} 
                onClick={() => setOpen(!open)}
            >
                <IconButton size="small" sx={{ mr: 1 }}>
                    {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                
                <Box sx={{ flex: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 4 }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="primary">
                                {thread.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ID: {thread.id}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 2 }}>
                            <Chip 
                                label={lastSnap.state} 
                                size="small" 
                                color={lastSnap.state === 'RUNNABLE' ? 'success' : 'default'} 
                            />
                        </Grid>
                        <Grid size={{ xs: 3 }}>
                           <Typography variant="body2">
                               Avg CPU: <Box component="span" fontWeight="bold">{lastSnap.cpu_percent.toFixed(1)}%</Box>
                           </Typography>
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {/* Expanded Details */}
            <Collapse in={open} timeout="auto" unmountOnExit>
                <Box sx={{ p: 3, borderTop: '1px solid #eee' }}>
                    
                    {/* 1. Behavior Graph */}
                    <Typography variant="h6" gutterBottom fontSize="1rem">Thread Behavior Across Time</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: '#fff' }}>
                        <LineChart
                            xAxis={[{ data: chartData.map(d => d.x), label: 'Snapshot Sequence' }]}
                            series={[{ data: chartData.map(d => d.y), label: 'CPU Usage %', area: true, color: '#2196f3' }]}
                            height={250}
                            margin={{ left: 50, right: 30, top: 30, bottom: 30 }}
                        />
                    </Paper>

                    {/* 2. Stack Traces */}
                    <Typography variant="h6" gutterBottom fontSize="1rem">Snapshot Details</Typography>
                    {thread.snapshots.map((snap, idx) => (
                        <StackTraceViewer key={idx} snapshot={snap} index={idx} />
                    ))}
                </Box>
            </Collapse>
        </Paper>
    );
};

// --- Main Component ---
const ThreadExplorer: React.FC = () => {
    const { data } = useAnalysisData();
    const [selectedPool, setSelectedPool] = useState<string | null>(null);

    // Group threads by pool
    const threadsByPool = useMemo(() => {
        if (!data) return {};
        const groups: Record<string, Thread[]> = {};
        data.threads.forEach(t => {
            const pool = t.thread_pool || "Uncategorized";
            if (!groups[pool]) groups[pool] = [];
            groups[pool].push(t);
        });
        return groups;
    }, [data]);

    // Select first pool by default
    React.useEffect(() => {
        if (!selectedPool && Object.keys(threadsByPool).length > 0) {
            setSelectedPool(Object.keys(threadsByPool)[0]);
        }
    }, [threadsByPool, selectedPool]);

    if (!data) {
        return (
            <Container sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                    No analysis data found. Please upload a thread dump.
                </Typography>
            </Container>
        );
    }

    const currentThreads = selectedPool ? threadsByPool[selectedPool] : [];

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            
            {/* LEFT SIDEBAR: Thread Pools */}
            <Paper 
                elevation={3}
                sx={{ 
                    width: 280, 
                    flexShrink: 0, 
                    bgcolor: 'white', 
                    borderRadius: 0, 
                    borderRight: '1px solid #eee',
                    overflowY: 'auto'
                }}
            >
                <Box p={2} borderBottom="1px solid #eee">
                    <Typography variant="subtitle1" fontWeight="bold">Thread Groupings</Typography>
                </Box>
                <List component="nav">
                    {Object.keys(threadsByPool).map((pool) => (
                        <ListItemButton 
                            key={pool}
                            selected={selectedPool === pool}
                            onClick={() => setSelectedPool(pool)}
                            sx={{ 
                                mb: 1, mx: 1, borderRadius: 1,
                                '&.Mui-selected': { bgcolor: '#fff3e0', color: '#e65100', borderLeft: '4px solid #ff9800' }
                            }}
                        >
                            <ListItemText 
                                primary={pool} 
                                secondary={`${threadsByPool[pool].length} threads`} 
                                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Paper>

            {/* RIGHT CONTENT: Thread List */}
            <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto', bgcolor: '#f8f9fa' }}>
                <Box mb={3}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>{selectedPool}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Showing {currentThreads.length} threads in this pool
                    </Typography>
                </Box>

                {currentThreads.map(thread => (
                    <ThreadRow key={thread.id} thread={thread} />
                ))}
            </Box>
        </Box>
    );
};

export default ThreadExplorer;