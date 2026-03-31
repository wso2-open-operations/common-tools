import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress as MuiCircularProgress,
  Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LayersIcon from '@mui/icons-material/Layers';
import { PieChart } from '@mui/x-charts';
import { useAnalysisData } from '@context/AnalysisContext';
import type { Thread, ThreadSnapshot, AIInsights } from '@/types/api';
import { useNavigate } from 'react-router-dom';

// Types

interface DashboardSummary {
  threadCount: number;
  criticalIssues: number;
  blockedThreads: number;
  healthScore: number;
  trendPercent: number | null;
}

interface ThreadCluster {
  clusterName: string;
  count: number;
  dominantState: string;
  threadNames: string[];
}

interface LongRunningThread {
  threadName: string;
  state: string;
  elapsedSeconds: number;
}

// Constants

const STATE_COLORS: Record<string, string> = {
  RUNNABLE: '#43a047',
  WAITING: '#ff9800',
  TIMED_WAITING: '#1976d2',
  BLOCKED: '#e53935',
  TERMINATED: '#9e9e9e',
  'N/A': '#bdbdbd',
};

const STATE_ORDER = ['RUNNABLE', 'WAITING', 'TIMED_WAITING', 'BLOCKED', 'TERMINATED', 'N/A'];

// Helpers

function computeHealthScore(snapshots: ThreadSnapshot[]): number {
  if (snapshots.length === 0) return 100;
  const total = snapshots.length;
  const blocked = snapshots.filter(s => s.state === 'BLOCKED').length;
  const waiting = snapshots.filter(s => s.state === 'WAITING').length;
  const timedWaiting = snapshots.filter(s => s.state === 'TIMED_WAITING').length;
  const penalty =
    (blocked / total) * 50 +
    (waiting / total) * 15 +
    (timedWaiting / total) * 5;
  return Math.max(0, Math.round(100 - penalty));
}

function getHealthMeta(score: number): { label: string; labelColor: string; barColor: string } {
  if (score >= 90) return { label: 'Excellent', labelColor: '#2e7d32', barColor: '#43a047' };
  if (score >= 75) return { label: 'Good', labelColor: '#388e3c', barColor: '#43a047' };
  if (score >= 50) return { label: 'Fair', labelColor: '#f57c00', barColor: '#ff9800' };
  return { label: 'Poor', labelColor: '#c62828', barColor: '#e53935' };
}

function getClusterKey(stackTrace: string[]): string {
  for (const line of stackTrace) {
    const trimmed = line.trim();
    if (trimmed.startsWith('at ')) return trimmed.substring(3).trim();
  }
  return stackTrace[0]?.trim() || 'Unknown';
}

// ThreadStateChip

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    RUNNABLE: { bg: '#e8f5e9', text: '#2e7d32' },
    BLOCKED: { bg: '#ffebee', text: '#c62828' },
    WAITING: { bg: '#fff3e0', text: '#e65100' },
    TIMED_WAITING: { bg: '#fff8e1', text: '#f57f17' },
    NEW: { bg: '#e3f2fd', text: '#1565c0' },
    TERMINATED: { bg: '#f5f5f5', text: '#616161' },
  };
  const c = colorMap[state] ?? { bg: '#f5f5f5', text: '#616161' };
  return (
    <Chip
      label={state}
      size="small"
      sx={{
        backgroundColor: c.bg,
        color: c.text,
        fontWeight: 700,
        fontSize: '0.65rem',
        height: 22,
        borderRadius: 1,
        letterSpacing: '0.04em',
      }}
    />
  );
};

// DashboardHome

const DashboardHome: React.FC = () => {
  const { data } = useAnalysisData();
  const navigate = useNavigate();
  const [selectedDump, setSelectedDump] = useState<string>('');
  const [activityTab, setActivityTab] = useState(0);

  const threads: Thread[] = data?.threads ?? [];
  const aiInsights: AIInsights | undefined = data?.ai_insights;

  // Unique dump names, sorted naturally
  const dumpNames = useMemo(() => {
    const names = new Set<string>();
    threads.forEach(t => t.snapshots.forEach(s => names.add(s.dump_name)));
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [threads]);

  // Default to first dump on load or when dumps change
  useEffect(() => {
    if (dumpNames.length > 0 && !dumpNames.includes(selectedDump)) {
      setSelectedDump(dumpNames[0]);
    }
  }, [dumpNames, selectedDump]);

  // Latest snapshot per thread (for summary cards)
  const latestSnapshots = useMemo((): ThreadSnapshot[] =>
    threads.flatMap(t => t.snapshots.length > 0 ? [t.snapshots[t.snapshots.length - 1]] : []),
    [threads]
  );

  // Count threads present in the latest dump specifically
  const latestDumpCount = useMemo((): number => {
    if (dumpNames.length === 0) return 0;
    const lastDump = dumpNames[dumpNames.length - 1];
    return threads.filter(t => t.snapshots.some(s => s.dump_name === lastDump)).length;
  }, [threads, dumpNames]);

  // Thread count trend: compare last two dumps
  const trendPercent = useMemo((): number | null => {
    if (dumpNames.length < 2) return null;
    const prev = dumpNames[dumpNames.length - 2];
    const curr = dumpNames[dumpNames.length - 1];
    const prevCount = threads.filter(t => t.snapshots.some(s => s.dump_name === prev)).length;
    const currCount = threads.filter(t => t.snapshots.some(s => s.dump_name === curr)).length;
    if (prevCount === 0) return null;
    return parseFloat(((currCount - prevCount) / prevCount * 100).toFixed(1));
  }, [threads, dumpNames]);

  // Dashboard summary derived from latest snapshots
  const summary: DashboardSummary = useMemo(() => ({
    threadCount: latestDumpCount,
    criticalIssues: latestSnapshots.filter(s => s.state === 'BLOCKED').length,
    blockedThreads: latestSnapshots.filter(s => s.state === 'BLOCKED').length,
    healthScore: computeHealthScore(latestSnapshots),
    trendPercent,
  }), [latestSnapshots, latestDumpCount, trendPercent]);

  // Snapshots belonging to the selected dump file
  const selectedSnapshots = useMemo((): Array<{ thread: Thread; snapshot: ThreadSnapshot }> => {
    const effectiveDump = dumpNames.includes(selectedDump) ? selectedDump : dumpNames[0] ?? '';
    const result: Array<{ thread: Thread; snapshot: ThreadSnapshot }> = [];
    threads.forEach(t => {
      const snap = t.snapshots.find(s => s.dump_name === effectiveDump);
      if (snap) result.push({ thread: t, snapshot: snap });
    });
    return result;
  }, [threads, selectedDump, dumpNames]);

  // Thread-state distribution for the donut chart.
  // Threads present in the dump but with no parseable state are normalised to 'N/A'.
  const stateDistribution = useMemo((): Record<string, number> => {
    const counts: Record<string, number> = {};
    selectedSnapshots.forEach(({ snapshot }) => {
      const state = snapshot.state?.trim() || 'N/A';
      counts[state] = (counts[state] ?? 0) + 1;
    });
    return counts;
  }, [selectedSnapshots]);

  const totalSelectedThreads = selectedSnapshots.length;

  // Pie-chart series data (only non-zero states)
  const pieData = useMemo(() =>
    STATE_ORDER
      .filter(s => (stateDistribution[s] ?? 0) > 0)
      .map((s, idx) => ({
        id: idx,
        value: stateDistribution[s] ?? 0,
        color: STATE_COLORS[s],
        label: s,
      })),
    [stateDistribution]
  );

  // Long-running threads for selected dump, sorted by elapsed time desc
  const longRunningThreads = useMemo((): LongRunningThread[] =>
    [...selectedSnapshots]
      .filter(({ snapshot }) => snapshot.elapsed_time_s > 0)
      .sort((a, b) => b.snapshot.elapsed_time_s - a.snapshot.elapsed_time_s)
      .slice(0, 25)
      .map(({ thread, snapshot }) => ({
        threadName: thread.name,
        state: snapshot.state?.trim() || 'N/A',
        elapsedSeconds: snapshot.elapsed_time_s,
      })),
    [selectedSnapshots]
  );

  // Thread clusters: group by top stack frame, show clusters with >1 thread
  const threadClusters = useMemo((): ThreadCluster[] => {
    const clusterMap = new Map<string, Array<{ thread: Thread; snapshot: ThreadSnapshot }>>();
    selectedSnapshots.forEach(({ thread, snapshot }) => {
      const key = getClusterKey(snapshot.stack_trace);
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push({ thread, snapshot });
    });
    return [...clusterMap.entries()]
      .map(([key, items]) => {
        const stateCounts: Record<string, number> = {};
        items.forEach(({ snapshot }) => {
          const st = snapshot.state?.trim() || 'N/A';
          stateCounts[st] = (stateCounts[st] ?? 0) + 1;
        });
        const dominantState =
          Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
        return {
          clusterName: key,
          count: items.length,
          dominantState,
          threadNames: items.map(i => i.thread.name),
        };
      })
      .filter(c => c.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [selectedSnapshots]);

  // Key findings derived from rule engine risk levels and issues
  const keyFindings = useMemo(() => {
    type FindingItem = { label: string; color: string; bgColor: string; affectedThreads: string[] };
    const findings: FindingItem[] = [];

    const deadlocked = threads.filter(t =>
      t.snapshots.some(s => s.issues?.some(i => i.toLowerCase().includes('deadlock')))
    );
    if (deadlocked.length > 0) {
      findings.push({ label: 'Deadlock Detected', color: '#c62828', bgColor: '#ffebee', affectedThreads: deadlocked.map(t => t.name) });
    }

    const deadlockedSet = new Set(deadlocked.map(t => t.name));

    const critical = threads.filter(t =>
      !deadlockedSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'CRITICAL')
    );
    if (critical.length > 0) {
      findings.push({ label: 'Critical Risk', color: '#e53935', bgColor: '#fff5f5', affectedThreads: critical.map(t => t.name) });
    }

    const criticalSet = new Set([...deadlocked, ...critical].map(t => t.name));

    const high = threads.filter(t =>
      !criticalSet.has(t.name) && t.snapshots.some(s => s.risk_level === 'HIGH')
    );
    if (high.length > 0) {
      findings.push({ label: 'High Risk', color: '#ef6c00', bgColor: '#fff3e0', affectedThreads: high.map(t => t.name) });
    }

    if (dumpNames.length > 0) {
      const lastDump = dumpNames[dumpNames.length - 1];
      const blocked = threads.filter(t => {
        const snap = t.snapshots.find(s => s.dump_name === lastDump);
        return snap?.state === 'BLOCKED' && !criticalSet.has(t.name) && !high.map(x => x.name).includes(t.name);
      });
      if (blocked.length > 0) {
        findings.push({ label: 'Blocked Threads', color: '#f57c00', bgColor: '#fff8e1', affectedThreads: blocked.map(t => t.name) });
      }
    }

    const excludedNames = new Set([
      ...deadlocked, ...critical, ...high,
    ].map(t => t.name));
    const longRunning = selectedSnapshots
      .filter(({ snapshot }) => snapshot.elapsed_time_s > 60)
      .filter(({ thread }) => !excludedNames.has(thread.name))
      .map(({ thread }) => thread.name);
    if (longRunning.length > 0) {
      findings.push({ label: 'Long-Running (>60s)', color: '#1565c0', bgColor: '#e3f2fd', affectedThreads: longRunning });
    }

    return findings;
  }, [threads, dumpNames, selectedSnapshots]);

  const { label: healthLabel, labelColor: healthLabelColor, barColor: healthBarColor } =
    getHealthMeta(summary.healthScore);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 2000, mx: 'auto' }}>

      {/* Row 1: Summary Cards */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">

        {/* Thread Count */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ flex: 1, minWidth: 180, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
              Thread Count (Last Dump)
            </Typography>
            <ShowChartIcon sx={{ fontSize: 18, color: '#42a5f5' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111' }}>
            {summary.threadCount.toLocaleString()}
          </Typography>
          {summary.trendPercent !== null ? (
            <Chip
              icon={
                summary.trendPercent >= 0
                  ? <TrendingUpIcon sx={{ fontSize: '14px !important' }} />
                  : <TrendingDownIcon sx={{ fontSize: '14px !important' }} />
              }
              label={`${summary.trendPercent >= 0 ? '+' : ''}${summary.trendPercent}% vs previous`}
              size="small"
              sx={{
                bgcolor: summary.trendPercent >= 0 ? '#e8f5e9' : '#ffebee',
                color: summary.trendPercent >= 0 ? '#2e7d32' : '#c62828',
                fontWeight: 600,
                fontSize: '0.68rem',
                height: 22,
              }}
            />
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
              Single snapshot
            </Typography>
          )}
        </Paper>

        {/* Critical Issues */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ flex: 1, minWidth: 180, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
              Critical Issues
            </Typography>
            <ErrorOutlineIcon sx={{ fontSize: 18, color: '#e53935' }} />
          </Box>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ mt: 0.75, mb: 1.25, color: summary.criticalIssues > 0 ? '#e53935' : '#111' }}
          >
            {summary.criticalIssues}
          </Typography>
          <Chip
            label={summary.criticalIssues > 0 ? 'Requires attention' : 'All clear'}
            size="small"
            sx={{
              bgcolor: summary.criticalIssues > 0 ? '#ffebee' : '#e8f5e9',
              color: summary.criticalIssues > 0 ? '#c62828' : '#2e7d32',
              fontWeight: 600,
              fontSize: '0.68rem',
              height: 22,
            }}
          />
        </Paper>

        {/* Blocked Threads */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ flex: 1, minWidth: 180, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
              Blocked Threads
            </Typography>
            <PauseCircleOutlineIcon sx={{ fontSize: 18, color: '#ff9800' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75, mb: 1.25, color: '#111' }}>
            {summary.blockedThreads}
          </Typography>
          <Chip
            label={summary.blockedThreads > 0 ? 'Active contention' : 'No contention'}
            size="small"
            sx={{
              bgcolor: summary.blockedThreads > 0 ? '#fff3e0' : '#e8f5e9',
              color: summary.blockedThreads > 0 ? '#e65100' : '#2e7d32',
              fontWeight: 600,
              fontSize: '0.68rem',
              height: 22,
            }}
          />
        </Paper>

        {/* Health Score */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ flex: 1, minWidth: 180, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
            Health Score
          </Typography>
          <Box display="flex" flexDirection="column" alignItems="center" mt={0.75}>
            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 0.75 }}>
              {/* Track */}
              <MuiCircularProgress
                variant="determinate"
                value={100}
                size={76}
                thickness={5}
                sx={{ color: '#e0e0e0', position: 'absolute' }}
              />
              {/* Filled arc */}
              <MuiCircularProgress
                variant="determinate"
                value={summary.healthScore}
                size={76}
                thickness={5}
                sx={{ color: healthBarColor }}
              />
              <Box sx={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography fontWeight={700} sx={{ fontSize: '1rem', lineHeight: 1 }}>
                  {summary.healthScore}%
                </Typography>
              </Box>
            </Box>
            <Typography variant="caption" sx={{ color: healthLabelColor, fontWeight: 600, fontSize: '0.75rem' }}>
              {healthLabel}
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Row 2 + Sidebar */}
      <Box display="flex" gap={3} flexDirection={{ xs: 'column', md: 'row' }}>

        {/* Left column */}
        <Box flex={2} minWidth={0} display="flex" flexDirection="column" gap={3}>

          {/* Chart row: Thread State Distribution + Key Findings */}
          <Box display="flex" gap={3} flexDirection={{ xs: 'column', lg: 'row' }} alignItems="stretch">

            {/* Thread State Distribution */}
            <Paper
              elevation={0}
              variant="outlined"
              sx={{ flex: 7, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0', minWidth: 0 }}
            >
              <Typography variant="subtitle2" fontWeight={700} mb={1.75}>
                Thread State Distribution
              </Typography>

              {/* Snapshot selector */}
              {dumpNames.length > 0 && (
                <Box mb={2.5} display="flex" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
                    Snapshot:
                  </Typography>
                  <Select
                    value={dumpNames.includes(selectedDump) ? selectedDump : (dumpNames[0] || '')}
                    onChange={(e) => { if (e.target.value) setSelectedDump(e.target.value); }}
                    size="small"
                    sx={{
                      minWidth: 220,
                      height: 36,
                      bgcolor: 'white',
                      fontSize: '0.8rem',
                      borderRadius: 1
                    }}
                  >
                    {dumpNames.map((name) => (
                      <MenuItem
                        key={name}
                        value={name}
                        sx={{
                          fontSize: '0.8rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          minWidth: 200
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          {name}
                        </Box>

                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}

              {/* Donut chart + legend */}
              {totalSelectedThreads > 0 ? (
                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                  {/* Donut */}
                  <Box sx={{ position: 'relative', flexShrink: 0, width: 240, height: 240 }}>
                    <PieChart
                      series={[{
                        data: pieData,
                        innerRadius: 68,
                        outerRadius: 108,
                        paddingAngle: 2,
                        cornerRadius: 3,
                      }]}
                      width={240}
                      height={240}
                      sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
                      margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    />
                    {/* Center label overlay */}
                    <Box sx={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1 }}>
                        {totalSelectedThreads.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', letterSpacing: '0.1em', mt: 0.3 }}>
                        THREADS
                      </Typography>
                    </Box>
                  </Box>

                  {/* Legend */}
                  <Box flex={1} minWidth={150}>
                    {STATE_ORDER.map(state => {
                      const count = stateDistribution[state] ?? 0;
                      const pct = totalSelectedThreads > 0
                        ? Math.round(count / totalSelectedThreads * 100)
                        : 0;
                      return (
                        <Box
                          key={state}
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          py={0.9}
                          sx={{ borderBottom: '1px solid #f0f0f0', '&:last-child': { borderBottom: 0 } }}
                        >
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{
                              width: 10, height: 10, borderRadius: '50%',
                              bgcolor: STATE_COLORS[state], flexShrink: 0,
                            }} />
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                              {state}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{ fontSize: '0.8rem', color: '#222', minWidth: 52, textAlign: 'right' }}
                            >
                              {count.toLocaleString()}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ minWidth: 34, textAlign: 'right', fontSize: '0.75rem' }}
                            >
                              {pct}%
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Typography variant="caption" color="text.disabled" fontStyle="italic">
                  No thread data available for this snapshot.
                </Typography>
              )}
            </Paper>

            {/* Key Findings */}
            <Paper
              elevation={0}
              variant="outlined"
              sx={{ flex: 4, p: 2.5, borderRadius: 2, borderColor: '#E0E0E0', minWidth: 220 }}
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
                      sx={{
                        borderLeft: `3px solid ${finding.color}`,
                        bgcolor: finding.bgColor,
                        p: 1.5,
                        borderRadius: '0 6px 6px 0',
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        display="block"
                        mb={0.75}
                        sx={{ color: finding.color }}
                      >
                        {finding.label} ({finding.affectedThreads.length})
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {finding.affectedThreads.slice(0, 5).map((name, i) => (
                          <Chip
                            key={i}
                            label={name}
                            size="small"
                            onClick={() => navigate('/thread-explorer', { state: { searchThread: name } })}
                            sx={{
                              fontSize: '0.6rem',
                              height: 20,
                              cursor: 'pointer',
                              bgcolor: 'white',
                              border: `1px solid ${finding.color}`,
                              color: finding.color,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              maxWidth: 160,
                              '&:hover': { opacity: 0.75 },
                            }}
                          />
                        ))}
                        {finding.affectedThreads.length > 5 && (
                          <Chip
                            label={`+${finding.affectedThreads.length - 5} more`}
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
          </Box>

          {/* Thread Activity */}
          <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2, borderColor: '#E0E0E0', overflow: 'hidden' }}>
            <Box sx={{ borderBottom: '1px solid #E0E0E0' }}>
              <Tabs
                value={activityTab}
                onChange={(_, v) => setActivityTab(v)}
                sx={{
                  px: 2,
                  minHeight: 46,
                  '& .MuiTab-root': {
                    minHeight: 46,
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    fontWeight: 500,
                    gap: 0.75,
                  },
                  '& .Mui-selected': { fontWeight: 700 },
                }}
              >
                <Tab icon={<LayersIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Thread Clusters" />
                <Tab icon={<AccessTimeIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Long-Running Threads" />
              </Tabs>
            </Box>

            {/* Thread Clusters tab */}
            {activityTab === 0 && (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>CLUSTER GROUP</TableCell>
                      <TableCell align="center" sx={{ ...thSx, width: 120 }}>THREAD COUNT</TableCell>
                      <TableCell align="center" sx={{ ...thSx, width: 160 }}>DOMINANT STATE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {threadClusters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                          <Typography variant="caption" color="text.disabled" fontStyle="italic">
                            No clusters detected — requires &gt;1 thread sharing the same top stack frame.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : threadClusters.map((cluster, idx) => (
                      <TableRow
                        key={idx}
                        hover
                        sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                        onClick={() =>
                          navigate('/thread-explorer', { state: { searchThread: cluster.threadNames[0] } })
                        }
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            title={cluster.clusterName}
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: '#1565c0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 440,
                            }}
                          >
                            {cluster.clusterName}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                            {cluster.count}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <ThreadStateChip state={cluster.dominantState} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Long-Running tab */}
            {activityTab === 1 && (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>THREAD NAME</TableCell>
                      <TableCell align="center" sx={{ ...thSx, width: 160 }}>STATE</TableCell>
                      <TableCell align="right" sx={{ ...thSx, width: 160 }}>ELAPSED TIME</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {longRunningThreads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                          <Typography variant="caption" color="text.disabled" fontStyle="italic">
                            No elapsed-time data available for this snapshot.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : longRunningThreads.map((t, idx) => (
                      <TableRow
                        key={idx}
                        hover
                        sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                        onClick={() => navigate('/thread-explorer', { state: { searchThread: t.threadName } })}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            title={t.threadName}
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.78rem',
                              color: '#1565c0',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 520,
                            }}
                          >
                            {t.threadName}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <ThreadStateChip state={t.state} />
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={
                              t.elapsedSeconds >= 1
                                ? `${Math.round(t.elapsedSeconds).toLocaleString()}s`
                                : `${Math.round(t.elapsedSeconds * 1000)}ms`
                            }
                            size="small"
                            sx={{
                              bgcolor: t.elapsedSeconds > 3600 ? '#fff3e0' : '#f5f5f5',
                              color: t.elapsedSeconds > 3600 ? '#e65100' : '#555',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              height: 22,
                              fontFamily: 'monospace',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>

        {/* Right Sidebar: AI Insights */}
        <Box flex={1} minWidth={280} maxWidth={{ md: 420 }}>
          <Paper
            elevation={0}
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2,
              borderColor: '#E0E0E0',
              position: 'sticky',
              top: 24,
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <AutoAwesomeIcon sx={{ fontSize: 20, color: '#ff6d00' }} />
              <Typography variant="subtitle2" fontWeight={700}>
                AI Insights
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              AI analysis and recommendations based on detected patterns and anomalies in the thread dump data
            </Typography>

            {!aiInsights ? (
              <Typography variant="caption" color="text.disabled" fontStyle="italic">
                AI insights unavailable — ensure GROQ_API_KEY is set and a valid dump was uploaded.
              </Typography>
            ) : (
              <>
                {/* Executive Summary */}
                <Box sx={{ borderLeft: '3px solid #ef9a9a', backgroundColor: '#fce4ec', p: 2, borderRadius: '0 8px 8px 0', mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="#b71c1c">
                    Executive Summary
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {aiInsights.executive_summary || '—'}
                  </Typography>
                </Box>

                {/* Pattern Recognition */}
                <Box sx={{ borderLeft: '3px solid #90caf9', backgroundColor: '#e3f2fd', p: 2, borderRadius: '0 8px 8px 0', mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="#1565c0">
                    Pattern Recognition
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {aiInsights.pattern_recognition || '—'}
                  </Typography>
                </Box>

                {/* Recommended Actions */}
                <Box sx={{ borderLeft: '3px solid #ffe082', backgroundColor: '#fff8e1', p: 2, borderRadius: '0 8px 8px 0' }}>
                  <Typography variant="caption" fontWeight={700} display="block" mb={0.75} color="#e65100">
                    Recommended Actions
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {aiInsights.recommended_actions || '—'}
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

// Shared table header cell styles
const thSx = {
  fontWeight: 700,
  fontSize: '0.71rem',
  color: '#666',
  letterSpacing: '0.05em',
  bgcolor: '#fafafa',
  borderBottom: '1px solid #E0E0E0',
} as const;

export default DashboardHome;
