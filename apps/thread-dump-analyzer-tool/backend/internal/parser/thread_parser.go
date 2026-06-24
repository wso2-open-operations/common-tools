// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
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

package parser

import (
	"bufio"
	"fmt"
	"io"
	"log/slog"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// Risk levels assigned to Thread.RiskLevel. Values mirror the strings used in
// internal/rules/rules.grl — keep both in sync.
const (
	RiskCritical = "CRITICAL"
	RiskHigh     = "HIGH"
	RiskMedium   = "MEDIUM"
	RiskInfo     = "INFO"
	RiskNormal   = "NORMAL"
)

// Thread represents a single thread from the dump
type Thread struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	ThreadPool    string   `json:"thread_pool,omitempty"`
	State         string   `json:"state"`
	NativeID      int64    `json:"native_id"`
	StackTrace    []string `json:"stack_trace"`
	ElapsedTime   float64  `json:"elapsed_time_s"`
	CPUTime       float64  `json:"cpu_time_ms"`
	CPUPercentage float64  `json:"cpu_percent"`
	Analyzed      bool     `json:"analyzed"`

	// RiskLevel is one of the Risk* constants. Stays a plain string because Grule
	// rules assign string literals via reflection, which won't convert to a named type.
	RiskLevel            string   `json:"risk_level"`
	Issues               []string `json:"issues"`
	Recommendation       string   `json:"recommendation"`
	IsDeadlocked         bool     `json:"is_deadlocked,omitempty"`
	WaitingToLockAddress string   `json:"waiting_to_lock_address,omitempty"`
	LockContentionCount  int      `json:"lock_contention_count,omitempty"`
}

// AddIssue appends an issue string — called by Grule rules.
func (t *Thread) AddIssue(issue string) {
	t.Issues = append(t.Issues, issue)
}

// NameContains reports whether the thread name contains s (case-insensitive).
func (t *Thread) NameContains(s string) bool {
	return strings.Contains(strings.ToLower(t.Name), strings.ToLower(s))
}

// NameStartsWith reports whether the thread name has the given prefix (case-sensitive).
func (t *Thread) NameStartsWith(prefix string) bool {
	return strings.HasPrefix(t.Name, prefix)
}

// StackTraceCount returns how many stack frames contain keyword.
func (t *Thread) StackTraceCount(keyword string) int {
	count := 0
	for _, line := range t.StackTrace {
		if strings.Contains(line, keyword) {
			count++
		}
	}
	return count
}

// HasRepeatedLock reports whether the thread holds the same lock address more than once.
func (t *Thread) HasRepeatedLock() bool {
	seen := map[string]bool{}
	for _, line := range t.StackTrace {
		if m := lockedAddressRE.FindStringSubmatch(line); len(m) >= 2 {
			if seen[m[1]] {
				return true
			}
			seen[m[1]] = true
		}
	}
	return false
}

// ThreadUsage represents thread usage data
type ThreadUsage struct {
	CPUPercentage float64 `json:"cpu_percent"`
	UserTime      float64 `json:"user_time_ms"`
	TID           int64   `json:"tid"`
	// Owning process from column[0]; used to filter non-JVM rows when `top -H` was captured without `-p <pid>`.
	PID int64 `json:"pid,omitempty"`
}

// GlobalStats holds aggregate data for Global Rules
type GlobalStats struct {
	TotalThreads              int
	BlockedCount              int
	BlockedPercentage         float64
	PreviousBlockedPercentage float64 // set externally for temporal spike detection
	ThreadCountGrowth         float64 // set externally for temporal leak detection
	IsUsageDataProvided       bool
	// Count of threads with JDBC/Hibernate in stack and ElapsedTime > 5s; gates DatabaseWait HIGH.
	JDBCStallCount int
}

var (
	//Captures Thread name and Thread ID
	threadHeaderRE = regexp.MustCompile(`^"(.+?)"\s+.*tid=(\S+)`)
	//Captures Native Thread ID in hex (0x..) or decimal (JDK 21+)
	nidRE = regexp.MustCompile(`nid=(0[xX][0-9a-fA-F]+|[0-9]+)`)
	//Captures Thread State
	stateRE = regexp.MustCompile(`\s*java\.lang\.Thread\.State:\s+(.+)`)
	//Captures Stack Trace lines
	stackLineRE = regexp.MustCompile(`^\s+(at\s+|-).*`)
	//Captures cpu attribute
	cpuAttributeRE = regexp.MustCompile(`cpu=([\d\.]+)\s*(ms|s|ns)?`)
	//Captures elapsed attribute
	elapsedAttributeRE = regexp.MustCompile(`elapsed=([\d\.]+)\s*(ms|s)?`)
	//Captures "Found X Java-level deadlock" section header
	deadlockSectionRE = regexp.MustCompile(`(?i)found.*java-level deadlock`)
	//Captures thread names listed in deadlock section: "name":
	deadlockThreadNameRE = regexp.MustCompile(`^"(.+?)":\s*$`)
	//Captures the monitor address from "waiting to lock <0x...>" stack lines
	waitingToLockRE = regexp.MustCompile(`waiting to lock <(0x[0-9a-fA-F]+)>`)
	//Captures the monitor address from "- locked <0x...>" stack lines
	lockedAddressRE = regexp.MustCompile(`- locked <(0x[0-9a-fA-F]+)>`)
)

/* Parsing Thread Dumps */

func ParseThread(r io.Reader) ([]Thread, error) {
	var threads []Thread
	var currentThread *Thread
	inDeadlockSection := false
	deadlockedNames := map[string]bool{}

	scanner := bufio.NewScanner(r)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		// Raw line for Regex matching
		rawLine := scanner.Text()
		// Create a trimmed version for safe prefix checking and clean output
		trimmedLine := strings.TrimSpace(rawLine)

		// Skip empty lines
		if trimmedLine == "" {
			continue
		}

		// Detect start of deadlock summary section — stop normal parsing from here
		if deadlockSectionRE.MatchString(trimmedLine) {
			inDeadlockSection = true
			currentThread = nil // prevent stray stack lines from being attributed
			continue
		}

		// Collect deadlocked thread names and skip all deadlock section lines
		if inDeadlockSection {
			if m := deadlockThreadNameRE.FindStringSubmatch(trimmedLine); len(m) >= 2 {
				deadlockedNames[m[1]] = true
			}
			continue
		}

		// Detect standard thread header
		if strings.HasPrefix(trimmedLine, `"`) {
			match := threadHeaderRE.FindStringSubmatch(rawLine)
			if len(match) >= 3 {
				if currentThread != nil {
					threads = append(threads, *currentThread)
				}

				t := &Thread{
					Name:       match[1],
					ID:         match[2],
					StackTrace: []string{},
					Issues:     []string{},
				}

				if nidMatch := nidRE.FindStringSubmatch(rawLine); len(nidMatch) >= 2 {
					// parseTID handles hex (0x..) and decimal nid, matching the usage-file TID parser.
					if val, ok := parseTID(nidMatch[1]); ok {
						t.NativeID = val
					}
				}

				if m := cpuAttributeRE.FindStringSubmatch(rawLine); len(m) >= 2 {
					val, err := strconv.ParseFloat(m[1], 64)
					if err == nil {
						unit := ""
						if len(m) > 2 {
							unit = m[2]
						}
						switch unit {
						case "s":
							t.CPUTime = val * 1000
						case "ns":
							t.CPUTime = val / 1_000_000
						default: // "ms" or no unit
							t.CPUTime = val
						}
					}
				}

				if m := elapsedAttributeRE.FindStringSubmatch(rawLine); len(m) >= 2 {
					val, err := strconv.ParseFloat(m[1], 64)
					if err == nil {
						unit := ""
						if len(m) > 2 {
							unit = m[2]
						}
						if unit == "ms" {
							t.ElapsedTime = val / 1000
						} else {
							t.ElapsedTime = val
						}
					}
				}
				currentThread = t
			}
			continue
		}

		if currentThread == nil {
			continue
		}

		// State Parsing
		if strings.HasPrefix(trimmedLine, "java.lang.Thread.State") {
			match := stateRE.FindStringSubmatch(rawLine)
			if len(match) >= 2 {
				rawState := strings.TrimSpace(match[1])
				parts := strings.Split(rawState, " ")
				if len(parts) > 0 {
					currentThread.State = parts[0]
				}
			}
			continue
		}

		// Stacktrace Parsing
		if stackLineRE.MatchString(rawLine) {
			currentThread.StackTrace = append(currentThread.StackTrace, trimmedLine)
			// Capture the first "waiting to lock" monitor address for contention rules
			if currentThread.WaitingToLockAddress == "" {
				if m := waitingToLockRE.FindStringSubmatch(trimmedLine); len(m) >= 2 {
					currentThread.WaitingToLockAddress = m[1]
				}
			}
		}
	}

	if currentThread != nil {
		threads = append(threads, *currentThread)
	}

	// Pre-flag deadlocked threads as CRITICAL; Analyzed=true prevents rules re-firing.
	// Deadlocks are JVM-reported findings, not inferred.
	for i := range threads {
		if deadlockedNames[threads[i].Name] {
			threads[i].IsDeadlocked = true
			threads[i].RiskLevel = RiskCritical
			threads[i].AddIssue("Deadlock Detected: Thread is part of a JVM-reported monitor lock cycle.")
			threads[i].Recommendation = "Investigate application locking logic immediately. A JVM restart is usually required to clear the deadlock."
			threads[i].Analyzed = true
		}
	}

	return threads, scanner.Err()
}

/* Parsing Thread Usage */

// usageColumns maps the fields we read to their column index; -1 means absent.
type usageColumns struct {
	pid  int
	tid  int
	cpu  int
	time int
}

// Lowercased header synonyms covering ps/top column-name variants.
var (
	tidHeaders  = []string{"tid", "lwp", "spid"}
	cpuHeaders  = []string{"%cpu", "pcpu", "cpu"}
	timeHeaders = []string{"time", "time+"}
	pidHeaders  = []string{"pid"}
)

// mapUsageColumns resolves column indices from a header row by synonym; first match per field wins.
func mapUsageColumns(header []string) usageColumns {
	cols := usageColumns{pid: -1, tid: -1, cpu: -1, time: -1}
	for i, raw := range header {
		name := strings.ToLower(raw)
		switch {
		case cols.tid < 0 && slices.Contains(tidHeaders, name):
			cols.tid = i
		case cols.cpu < 0 && slices.Contains(cpuHeaders, name):
			cols.cpu = i
		case cols.time < 0 && slices.Contains(timeHeaders, name):
			cols.time = i
		case cols.pid < 0 && slices.Contains(pidHeaders, name):
			cols.pid = i
		}
	}
	return cols
}

// ParseThreadUsage reads CPU usage rows, mapping columns by header synonyms when a header is present.
// It returns non-fatal diagnostics (e.g. a header with no thread-id column) alongside the parsed rows.
func ParseThreadUsage(r io.Reader) ([]ThreadUsage, []string, error) {
	var usages []ThreadUsage
	var diagnostics []string
	scanner := bufio.NewScanner(r)

	// Legacy fixed positions, overridden once a recognizable header is found.
	cols := usageColumns{pid: 0, tid: 1, cpu: 2, time: 3}
	headerSeen := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		columns := strings.Fields(line)

		// A non-numeric first token is a header candidate or a top banner line.
		if _, ok := parseTID(columns[0]); !ok {
			if !headerSeen {
				// Accept as the header only if it names columns we recognize.
				if cand := mapUsageColumns(columns); cand.tid >= 0 || cand.cpu >= 0 {
					cols = cand
					headerSeen = true
					if cand.tid < 0 {
						diagnostics = append(diagnostics, fmt.Sprintf("usage header %v has no recognizable thread-id column (tid/lwp/spid); cannot correlate CPU data", columns))
					}
				}
			}
			continue
		}

		// TID and %CPU are required; skip rows that lack either.
		if cols.tid < 0 || cols.cpu < 0 || len(columns) <= cols.tid || len(columns) <= cols.cpu {
			continue
		}

		tidInt, ok := parseTID(columns[cols.tid])
		if !ok {
			continue
		}
		cpuVal, err := strconv.ParseFloat(strings.Trim(columns[cols.cpu], " %"), 64)
		if err != nil {
			continue
		}

		u := ThreadUsage{TID: tidInt, CPUPercentage: cpuVal}
		if cols.pid >= 0 && len(columns) > cols.pid {
			if pid, ok := parseTID(columns[cols.pid]); ok {
				u.PID = pid
			}
		}
		if cols.time >= 0 && len(columns) > cols.time {
			u.UserTime = parseTime(columns[cols.time]) * 1000
		}
		usages = append(usages, u)
	}

	if err := scanner.Err(); err != nil {
		return nil, diagnostics, err
	}
	return usages, diagnostics, nil
}

// Parses a TID/PID token, accepting hex (`0x...`) or decimal.
func parseTID(raw string) (int64, bool) {
	if strings.HasPrefix(strings.ToLower(raw), "0x") {
		val, err := strconv.ParseInt(raw[2:], 16, 64)
		if err != nil {
			return 0, false
		}
		return val, true
	}
	val, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, false
	}
	return val, true
}

// Returns usages filtered to the most frequent PID along with that PID and the distinct PID count.
// When only one PID is present (or none can be inferred) the slice is returned unchanged.
func FilterUsagesByDominantPID(usages []ThreadUsage) (filtered []ThreadUsage, dominantPID int64, pidCount int) {
	if len(usages) == 0 {
		return usages, 0, 0
	}
	counts := make(map[int64]int)
	for _, u := range usages {
		counts[u.PID]++
	}
	if len(counts) <= 1 {
		for pid := range counts {
			dominantPID = pid
		}
		return usages, dominantPID, len(counts)
	}
	for pid, c := range counts {
		if c > counts[dominantPID] {
			dominantPID = pid
		}
	}
	filtered = make([]ThreadUsage, 0, counts[dominantPID])
	for _, u := range usages {
		if u.PID == dominantPID {
			filtered = append(filtered, u)
		}
	}
	return filtered, dominantPID, len(counts)
}

func parseTime(t string) float64 {
	t = strings.TrimSpace(t)
	if strings.Contains(t, ":") {
		parts := strings.Split(t, ":")
		var totalSeconds float64
		multiplier := 1.0
		for i := len(parts) - 1; i >= 0; i-- {
			val, err := strconv.ParseFloat(parts[i], 64)
			if err == nil {
				totalSeconds += val * multiplier
			}
			multiplier *= 60
		}
		return totalSeconds
	}
	val, _ := strconv.ParseFloat(t, 64)
	return val
}

// Helper for Grule to easily check stack traces
func (t *Thread) HasInStackTrace(keyword string) bool {
	for _, line := range t.StackTrace {
		if strings.Contains(line, keyword) {
			return true
		}
	}
	return false
}

/* Correlation Logic */

// Joins thread dump with CPU-usage file by NativeID == TID. dumpFileName is for log context only.
// Returns non-fatal diagnostics (multi-PID filter, zero-match) so the caller can surface them in API errors[].
func ProcessAndCorrelate(dumpReader, usageReader io.Reader, dumpFileName string) ([]Thread, []string, error) {
	var diagnostics []string

	threads, err := ParseThread(dumpReader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse dump: %w", err)
	}

	if usageReader != nil {
		usages, usageDiags, err := ParseThreadUsage(usageReader)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to parse thread usage: %w", err)
		}
		diagnostics = append(diagnostics, usageDiags...)

		rawUsageCount := len(usages)
		filtered, dominantPID, pidCount := FilterUsagesByDominantPID(usages)
		usages = filtered
		if pidCount > 1 {
			msg := fmt.Sprintf("cpu correlation: %s contained %d distinct PIDs; filtered to dominant PID %d (%d/%d rows kept). Capture with `top -H -p <jvm_pid>` to avoid this.",
				dumpFileName, pidCount, dominantPID, len(usages), rawUsageCount)
			slog.Warn(msg, "dump_file", dumpFileName, "pid_count", pidCount, "dominant_pid", dominantPID)
			diagnostics = append(diagnostics, msg)
		}

		usageMap := make(map[int64]ThreadUsage)
		for _, u := range usages {
			usageMap[u.TID] = u
		}

		matched := 0
		var unmatchedNativeIDs []int64
		for i := range threads {
			t := &threads[i]
			if usage, ok := usageMap[t.NativeID]; ok {
				t.CPUPercentage = usage.CPUPercentage
				t.CPUTime = usage.UserTime
				matched++
			} else if len(unmatchedNativeIDs) < 5 {
				unmatchedNativeIDs = append(unmatchedNativeIDs, t.NativeID)
			}
		}

		logAttrs := []any{
			"dump_file", dumpFileName,
			"usage_rows", rawUsageCount,
			"usage_rows_after_pid_filter", len(usages),
			"usage_map_size", len(usageMap),
			"threads_parsed", len(threads),
			"threads_matched", matched,
		}
		if matched == 0 && len(usages) > 0 && len(threads) > 0 {
			var sampleTIDs []int64
			for i, u := range usages {
				if i >= 5 {
					break
				}
				sampleTIDs = append(sampleTIDs, u.TID)
			}
			slog.Warn("cpu correlation produced zero matches — likely TID/NativeID format mismatch",
				append(logAttrs,
					"sample_usage_tids", sampleTIDs,
					"sample_unmatched_native_ids", unmatchedNativeIDs,
				)...,
			)
			diagnostics = append(diagnostics, fmt.Sprintf(
				"cpu correlation: 0/%d usage rows matched any thread native_id in %s (sample TIDs %v vs native IDs %v). Likely a TID-format mismatch or wrong PID captured.",
				len(usages), dumpFileName, sampleTIDs, unmatchedNativeIDs,
			))
		} else {
			slog.Debug("cpu correlation completed", logAttrs...)
		}
	}

	// Flag runaway-CPU threads (>= 100%) as CRITICAL natively; unambiguous infinite-loop / busy-spin.
	for i := range threads {
		t := &threads[i]
		if t.Analyzed {
			continue
		}
		if t.CPUPercentage >= 100.0 {
			t.RiskLevel = RiskCritical
			t.AddIssue(fmt.Sprintf("Runaway CPU Thread: thread is consuming %.1f%% CPU (likely infinite loop or busy-spin).", t.CPUPercentage))
			t.Recommendation = "Inspect the stack trace immediately for infinite loops, busy-waiting, or runaway computation. Consider thread.yield()/sleep where appropriate."
			t.Analyzed = true
		}
	}

	return threads, diagnostics, nil
}
