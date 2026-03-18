import React, { useMemo } from 'react';
import {
  Box, Typography, Paper, Chip
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAnalysisData } from '../../context/AnalysisContext';
import type { Thread, ThreadSnapshot } from '../../types/api';
import { useNavigate } from 'react-router-dom';

function computeSummary(threads: Thread[]) {
  const latestSnapshots: ThreadSnapshot[] = [];
  threads.forEach(t => {
    if (t.snapshots.length > 0) {
      latestSnapshots.push(t.snapshots[t.snapshots.length - 1]);
    }
  });

  const threadCount = latestSnapshots.length;
  const blockedThreads = latestSnapshots.filter(s => s.state === 'BLOCKED').length;
  const highCpuThreads = latestSnapshots.filter(s => s.cpu_percent > 0).length;
  const criticalIssues = latestSnapshots.filter(s => s.state === 'BLOCKED').length;

  const dumpNames = [...new Set(latestSnapshots.map(s => s.dump_name))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const timeRange = dumpNames.length > 1
    ? `${dumpNames[0]} - ${dumpNames[dumpNames.length - 1]}`
    : dumpNames[0] || 'N/A';

  return { threadCount, criticalIssues, highCpuThreads, blockedThreads, timeRange };
}

// Stat Cards

interface StatCardProps {
  label: string;
  value: string | number;
  alert?: boolean;
  isTime?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, alert = false, isTime = false }) => (
  <Paper
    elevation={0}
    sx={{
      flex: 1,
      p: 2,
      border: '1px solid #e8e8e8',
      borderRadius: 1.5,
      position: 'relative',
      minWidth: 0,
    }}
  >
    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.01em' }}
      >
        {label}
      </Typography>
      {alert && (
        <WarningAmberIcon sx={{ fontSize: 16, color: '#e53935' }} />
      )}
    </Box>
    <Typography
      variant={isTime ? 'body1' : 'h4'}
      fontWeight={isTime ? 500 : 700}
      sx={{ mt: 0.5, color: '#111', fontSize: isTime ? '0.9rem' : undefined }}
    >
      {value}
    </Typography>
  </Paper>
);

// Main Component

const DashboardHome: React.FC = () => {
  const { data } = useAnalysisData();
  const navigate = useNavigate();

  const threads = data?.threads ?? [];

  const summary = useMemo(() => computeSummary(threads), [threads]);

  const topCpuThreads = useMemo(() =>
    [...threads]
      .map(t => ({ name: t.name, cpu: t.snapshots.at(-1)?.cpu_percent ?? 0 }))
      .filter(t => t.cpu > 0)
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5),
  [threads]);

  const topElapsedThreads = useMemo(() =>
    [...threads]
      .map(t => ({ name: t.name, elapsed: t.snapshots.at(-1)?.elapsed_time_s ?? 0 }))
      .filter(t => t.elapsed > 0)
      .sort((a, b) => b.elapsed - a.elapsed)
      .slice(0, 5),
  [threads]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 2000, mx: 'auto' }}>

      {/* Analysis Summary */}
      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
        Analysis Summary
      </Typography>
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <StatCard label="Thread Count (Last Dump)" value={summary.threadCount} />
        <StatCard label="Critical Issues" value={summary.criticalIssues} alert={summary.criticalIssues > 0} />
        <StatCard label="High-CPU Threads" value={summary.highCpuThreads} alert={summary.highCpuThreads > 0} />
        <StatCard label="Blocked Threads" value={summary.blockedThreads} alert={summary.blockedThreads > 0} />
        <StatCard label="Analysis Time Range" value={summary.timeRange} isTime />
      </Box>

      {/* Main Content */}
      <Box display="flex" gap={3} flexDirection={{ xs: 'column', md: 'row' }}>

        <Box flex={2} minWidth={0}>

          {/* Key Findings (placeholder) */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid #e8e8e8',
              borderRadius: 2,
              mb: 3,
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Key Findings
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Critical issues and patterns detected by the analysis engine
            </Typography>

            <Box display="flex" flexDirection="column" gap={0}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                <strong> Placeholder: </strong> This section will highlight the most critical findings from the thread dump analysis, such as detected deadlocks, hotspots of contention, or threads with unusually high CPU usage. Each finding will include a brief description and its potential impact on application performance and stability.
              </Typography>
            </Box>
          </Paper>

          {/* Interesting Highlights */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid #e8e8e8',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Interesting Highlights
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
              Threads with notable CPU usage or long elapsed times
            </Typography>

            <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>

              {/* High CPU Threads */}
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
                  <TrendingUpIcon sx={{ fontSize: 16, color: '#e53935' }} />
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="#e53935"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    High CPU Threads
                  </Typography>
                </Box>
                {topCpuThreads.length > 0 ? (
                  topCpuThreads.map((t, idx) => (
                    <Box
                      key={idx}
                      onClick={() => navigate('/thread-explorer', { state: { searchThread: t.name } })}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1,
                        px: 1.5,
                        mb: 0.75,
                        borderRadius: 1.5,
                        border: '1px solid #ffcdd2',
                        bgcolor: '#fff8f8',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#ffebee', borderColor: '#e53935' },
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#1565c0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 1 }}
                        title={t.name}
                      >
                        {t.name}
                      </Typography>
                      <Chip
                        label={`${t.cpu.toFixed(1)}%`}
                        size="small"
                        sx={{ bgcolor: '#e53935', color: 'white', fontWeight: 700, fontSize: '0.65rem', height: 20, flexShrink: 0 }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="caption" color="text.disabled" fontStyle="italic">
                    No high-CPU threads detected
                  </Typography>
                )}
              </Box>

              {/* Long-Running Threads */}
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: '#ff6d00' }} />
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="#e65100"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    Long-Running Threads
                  </Typography>
                </Box>
                {topElapsedThreads.length > 0 ? (
                  topElapsedThreads.map((t, idx) => (
                    <Box
                      key={idx}
                      onClick={() => navigate('/thread-explorer', { state: { searchThread: t.name } })}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1,
                        px: 1.5,
                        mb: 0.75,
                        borderRadius: 1.5,
                        border: '1px solid #ffe0b2',
                        bgcolor: '#fff8f0',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#fff3e0', borderColor: '#ff9800' },
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#1565c0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 1 }}
                        title={t.name}
                      >
                        {t.name}
                      </Typography>
                      <Chip
                        label={t.elapsed >= 1 ? `${t.elapsed.toFixed(1)}s` : `${Math.round(t.elapsed * 1000)}ms`}
                        size="small"
                        sx={{ bgcolor: '#ff6d00', color: 'white', fontWeight: 700, fontSize: '0.65rem', height: 20, flexShrink: 0 }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="caption" color="text.disabled" fontStyle="italic">
                    No long-running threads detected
                  </Typography>
                )}
              </Box>

            </Box>
          </Paper>
        </Box>

        {/* AI Insights (placeholder) */}
        <Box flex={1} minWidth={280} maxWidth={{ md: 420 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid #e8e8e8',
              borderRadius: 2,
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

            {/* Executive Summary */}
            <Box
              sx={{
                borderLeft: '3px solid #ef9a9a',
                backgroundColor: '#fce4ec',
                p: 2,
                borderRadius: '0 8px 8px 0',
                mb: 2,
              }}
            >
              <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="#b71c1c">
                Executive Summary
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                <strong> Placeholder: </strong>  This section will provide a high-level overview of the most critical findings, patterns, and recommended actions based on the thread dump data.
              </Typography>
            </Box>

            {/* Recommended Actions */}
            <Box
              sx={{
                borderLeft: '3px solid #ffe082',
                backgroundColor: '#fff8e1',
                p: 2,
                borderRadius: '0 8px 8px 0',
                mb: 2,
              }}
            >
              <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="#e65100">
                Recommended Actions
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                <strong> Placeholder: </strong> This section will suggest specific steps to address identified issues, such as code changes, configuration tweaks, or further monitoring recommendations.
              </Typography>
            </Box>

            {/* Pattern Recognition */}
            <Box
              sx={{
                borderLeft: '3px solid #ef9a9a',
                backgroundColor: '#fce4ec',
                p: 2,
                borderRadius: '0 8px 8px 0',
              }}
            >
              <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="#b71c1c">
                Pattern Recognition
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                <strong> Placeholder: </strong>  This section will highlight any recurring patterns or anomalies detected across the thread dumps, such as specific locks frequently contended, common stack trace signatures, or trends in thread states over time.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardHome;
