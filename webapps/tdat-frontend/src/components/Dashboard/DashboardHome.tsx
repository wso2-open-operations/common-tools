import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Chip, InputBase,
  Collapse
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAnalysisData } from '../../context/AnalysisContext';
import type { Thread, ThreadSnapshot } from '../../types/api';

// Derived Lock Types

interface BlockedThreadInfo {
  thread: Thread;
  snapshot: ThreadSnapshot;
  lockAddress: string;
  waitTime: string;
}

interface LockOwnerInfo {
  thread: Thread;
  snapshot: ThreadSnapshot;
}

interface DerivedLockEntry {
  className: string;
  lockAddress: string;
  owner: LockOwnerInfo | null;
  blockedThreads: BlockedThreadInfo[];
}

// Stack Trace Parsing Utilities

// Parses thread stack traces to extract lock contention information.
const LOCK_WAITING_REGEX = /[-\s]waiting to lock\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const LOCK_HOLDING_REGEX = /[-\s]locked\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const PARKING_REGEX = /[-\s]parking to wait for\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const WAITING_ON_REGEX = /[-\s]waiting on\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;

interface LockRef {
  address: string;
  className: string;
}

function findWaitingLock(stackTrace: string[]): LockRef | null {
  for (const line of stackTrace) {
    const waitMatch = line.match(LOCK_WAITING_REGEX);
    if (waitMatch) return { address: waitMatch[1], className: waitMatch[2] };

    const parkMatch = line.match(PARKING_REGEX);
    if (parkMatch) return { address: parkMatch[1], className: parkMatch[2] };

    const waitOnMatch = line.match(WAITING_ON_REGEX);
    if (waitOnMatch) return { address: waitOnMatch[1], className: waitOnMatch[2] };
  }
  return null;
}

function findHeldLocks(stackTrace: string[]): LockRef[] {
  const locks: LockRef[] = [];
  for (const line of stackTrace) {
    const match = line.match(LOCK_HOLDING_REGEX);
    if (match) {
      locks.push({ address: match[1], className: match[2] });
    }
  }
  return locks;
}

 // Groups blocked threads by the lock they're waiting on, and finds the owner. 
function deriveLockContention(threads: Thread[]): DerivedLockEntry[] {
  if (!threads || threads.length === 0) return [];

  // Use the latest snapshot for each thread
  const latestSnapshotMap = new Map<Thread, ThreadSnapshot>();
  threads.forEach(thread => {
    if (thread.snapshots.length > 0) {
      const latest = thread.snapshots[thread.snapshots.length - 1];
      latestSnapshotMap.set(thread, latest);
    }
  });

  // Collect all threads waiting on locks
  const waitingByLock = new Map<string, { className: string; threads: BlockedThreadInfo[] }>();

  // Collect all threads holding locks
  const holdingByLock = new Map<string, { thread: Thread; snapshot: ThreadSnapshot }>();

  latestSnapshotMap.forEach((snapshot, thread) => {
    // Check if this thread is waiting on a lock
    const waitingLock = findWaitingLock(snapshot.stack_trace);
    if (waitingLock && (snapshot.state === 'BLOCKED' || snapshot.state === 'WAITING' || snapshot.state === 'TIMED_WAITING')) {
      if (!waitingByLock.has(waitingLock.address)) {
        waitingByLock.set(waitingLock.address, {
          className: waitingLock.className,
          threads: [],
        });
      }
      waitingByLock.get(waitingLock.address)!.threads.push({
        thread,
        snapshot,
        lockAddress: waitingLock.address,
        waitTime: snapshot.elapsed_time_s > 0 ? `${Math.round(snapshot.elapsed_time_s * 1000)}ms` : '',
      });
    }

    // Check if this thread is holding any locks
    const heldLocks = findHeldLocks(snapshot.stack_trace);
    heldLocks.forEach(lock => {
      if (!holdingByLock.has(lock.address)) {
        holdingByLock.set(lock.address, { thread, snapshot });
      }
    });
  });

  // Build final lock entries to only include locks that have at least 1 blocked thread
  const entries: DerivedLockEntry[] = [];

  waitingByLock.forEach((data, address) => {
    const holder = holdingByLock.get(address) ?? null;

    entries.push({
      className: data.className,
      lockAddress: address,
      owner: holder ? { thread: holder.thread, snapshot: holder.snapshot } : null,
      blockedThreads: data.threads.sort((a, b) => a.thread.name.localeCompare(b.thread.name)),
    });
  });

  // Sort by number of blocked threads descending
  entries.sort((a, b) => b.blockedThreads.length - a.blockedThreads.length);

  return entries;
}

// Stat Card

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

// Thread State Chip

const ThreadStateChip: React.FC<{ state: string }> = ({ state }) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    RUNNABLE: { bg: '#e8f5e9', text: '#2e7d32' },
    BLOCKED: { bg: '#ffebee', text: '#c62828' },
    WAITING: { bg: '#fff3e0', text: '#e65100' },
    TIMED_WAITING: { bg: '#fff8e1', text: '#f57f17' },
    NEW: { bg: '#e3f2fd', text: '#1565c0' },
    TERMINATED: { bg: '#f5f5f5', text: '#616161' },
  };
  const c = colorMap[state] || { bg: '#f5f5f5', text: '#616161' };

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
        flexShrink: 0,
      }}
    />
  );
};

// Lock Contention Card

const LockContentionCard: React.FC<{ lock: DerivedLockEntry; defaultExpanded?: boolean }> = ({ lock, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Box
      sx={{
        borderLeft: '3px solid #e53935',
        mb: 2,
        backgroundColor: '#fff',
        borderRadius: '0 8px 8px 0',
      }}
    >
      {/* Header Row */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          p: 2,
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#fafafa' },
          borderRadius: '0 8px 8px 0',
        }}
      >
        <Box sx={{ mr: 1, mt: 0.25 }}>
          {expanded ? (
            <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          )}
        </Box>
        <LockOutlinedIcon sx={{ fontSize: 18, color: '#e53935', mr: 1, mt: 0.3 }} />
        <Box>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#111' }}
          >
            {lock.className}
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block">
            &lt;{lock.lockAddress}&gt;
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {lock.blockedThreads.length} thread{lock.blockedThreads.length !== 1 ? 's' : ''} blocked waiting for this lock
          </Typography>
        </Box>
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, pl: 5 }}>
          {/* Lock Owner */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, display: 'block', mb: 1, mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}
          >
            Lock Owner
          </Typography>
          {lock.owner ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: '1px solid #c8e6c9',
                backgroundColor: '#f1f8e9',
                borderRadius: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#1565c0',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {lock.owner.thread.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This thread is currently holding the lock
                </Typography>
              </Box>
              <ThreadStateChip state={lock.owner.snapshot.state} />
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: '1px solid #e0e0e0',
                backgroundColor: '#fafafa',
                borderRadius: 1.5,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" fontStyle="italic">
                Lock owner could not be identified from the thread dump
              </Typography>
            </Paper>
          )}

          {/* Blocked Threads */}
          {lock.blockedThreads.length > 0 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}
              >
                Blocked Threads ({lock.blockedThreads.length})
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                {lock.blockedThreads.map((blocked, idx) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      border: '1px solid #ffcdd2',
                      backgroundColor: '#fff8f0',
                      borderRadius: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: '#1565c0',
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {blocked.thread.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Waiting to lock &lt;{blocked.lockAddress}&gt;
                        {blocked.waitTime ? ` (${blocked.waitTime})` : ''}
                      </Typography>
                    </Box>
                    <ThreadStateChip state={blocked.snapshot.state} />
                  </Paper>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// Summary Computation

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

  // Count unique contended locks as critical issues
  const criticalIssues = new Set(
    latestSnapshots
      .filter(s => s.state === 'BLOCKED')
      .map(s => {
        const lock = findWaitingLock(s.stack_trace);
        return lock?.address;
      })
      .filter(Boolean)
  ).size;

  // Time range from dump names
  const dumpNames = [...new Set(latestSnapshots.map(s => s.dump_name))].sort();
  const timeRange = dumpNames.length > 1
    ? `${dumpNames[0]} - ${dumpNames[dumpNames.length - 1]}`
    : dumpNames[0] || 'N/A';

  return { threadCount, criticalIssues, highCpuThreads, blockedThreads, timeRange };
}

/* Main Component */

const DashboardHome: React.FC = () => {
  const { data } = useAnalysisData();
  const [searchQuery, setSearchQuery] = useState('');

  const threads = data?.threads ?? [];

  // Derive summary stats
  const summary = useMemo(() => computeSummary(threads), [threads]);

  // Derive lock contention from stack traces
  const lockEntries = useMemo(() => deriveLockContention(threads), [threads]);

  // Filter lock entries by search
  const filteredLocks = useMemo(() => {
    if (!searchQuery.trim()) return lockEntries;
    const q = searchQuery.toLowerCase();
    return lockEntries.filter(lock =>
      lock.className.toLowerCase().includes(q) ||
      lock.lockAddress.toLowerCase().includes(q) ||
      lock.owner?.thread.name.toLowerCase().includes(q) ||
      lock.blockedThreads.some(bt => bt.thread.name.toLowerCase().includes(q))
    );
  }, [lockEntries, searchQuery]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>

      {/* Top Bar: Search*/}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            px: 1.5,
            py: 0.25,
            width: 320,
          }}
        >
          <SearchIcon sx={{ color: 'text.disabled', fontSize: 20, mr: 1 }} />
          <InputBase
            placeholder="Search threads, pools, or stack traces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1, fontSize: '0.85rem' }}
          />
        </Paper>
      </Box>

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

        {/* LEFT COLUMN */}
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

          {/* Lock Contention & Monitors */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid #e8e8e8',
              borderRadius: 2,
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <LockOutlinedIcon sx={{ fontSize: 20, color: '#e53935' }} />
              <Typography variant="subtitle2" fontWeight={700}>
                Lock Contention & Monitors
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
              Critical monitors under contention and blocked thread correlations
            </Typography>

            {filteredLocks.length > 0 ? (
              filteredLocks.map((lock, idx) => (
                <LockContentionCard
                  key={lock.lockAddress}
                  lock={lock}
                  defaultExpanded={idx === 0}
                />
              ))
            ) : (
              <Box
                sx={{
                  py: 4,
                  textAlign: 'center',
                  color: 'text.disabled',
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                <Typography variant="body2" color="text.disabled">
                  {threads.length === 0
                    ? 'No analysis data loaded'
                    : searchQuery
                      ? 'No lock contention matches your search'
                      : 'No lock contention detected in the thread dumps'}
                </Typography>
              </Box>
            )}
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