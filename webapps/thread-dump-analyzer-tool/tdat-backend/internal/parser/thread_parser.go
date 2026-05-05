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

package parser

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
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

	// Fields for Rules Engine
	RiskLevel            string   `json:"risk_level"` // "CRITICAL", "HIGH", "MEDIUM", "INFO"
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

// HasRepeatedLock reports whether the thread holds the same lock address more than once —
// a sign of recursive or nested synchronization on the same object.
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
}

// GlobalStats holds aggregate data for Global Rules
type GlobalStats struct {
	TotalThreads              int
	BlockedCount              int
	BlockedPercentage         float64
	PreviousBlockedPercentage float64 // set externally for temporal spike detection
	ThreadCountGrowth         float64 // set externally for temporal leak detection
	IsUsageDataProvided       bool
}

var (
	//Captures Thread name and Thread ID
	threadHeaderRE = regexp.MustCompile(`^"(.+?)"\s+.*tid=(\S+)`)
	//Captures Native Thread ID in hex
	nidRE = regexp.MustCompile(`nid=0[xX]([0-9a-fA-F]+)`)
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
					if val, err := strconv.ParseInt(nidMatch[1], 16, 64); err == nil {
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
						if unit == "s" {
							t.CPUTime = val * 1000
						} else {
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

	// Mark threads that appear in the deadlock summary section.
	// Deadlocks are JVM-reported summary blocks, not per-thread states — flag them
	// as CRITICAL during extraction so the result is correct even before rules run.
	// Setting Analyzed = true prevents the rules engine from re-firing on the same finding.
	for i := range threads {
		if deadlockedNames[threads[i].Name] {
			threads[i].IsDeadlocked = true
			threads[i].RiskLevel = "CRITICAL"
			threads[i].AddIssue("Deadlock Detected: Thread is part of a JVM-reported monitor lock cycle.")
			threads[i].Recommendation = "Investigate application locking logic immediately. A JVM restart is usually required to clear the deadlock."
			threads[i].Analyzed = true
		}
	}

	return threads, scanner.Err()
}

/* Parsing Thread Usage */

func ParseThreadUsage(r io.Reader) ([]ThreadUsage, error) {
	var usages []ThreadUsage
	scanner := bufio.NewScanner(r)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		columns := strings.Fields(line)

		// 4 columns: PID, TID, %CPU, TIME
		if len(columns) < 4 {
			continue
		}
		if columns[0] == "PID" {
			continue
		}

		// Parse TID
		tidRaw := columns[1]
		var tidInt int64
		// Handle hex and decimal TID
		if strings.HasPrefix(strings.ToLower(tidRaw), "0x") {
			val, err := strconv.ParseInt(tidRaw[2:], 16, 64)
			if err != nil {
				continue
			}
			tidInt = val
		} else {
			val, err := strconv.Atoi(tidRaw)
			if err != nil {
				continue
			}
			tidInt = int64(val)
		}

		// Parse CPU Percentage
		cpuStr := strings.Trim(columns[2], " %")
		cpuVal, err := strconv.ParseFloat(cpuStr, 64)
		if err != nil {
			continue
		}

		timeSeconds := parseTime(columns[3])
		timeMs := timeSeconds * 1000

		usages = append(usages, ThreadUsage{
			TID:           tidInt,
			CPUPercentage: cpuVal,
			UserTime:      timeMs,
		})
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return usages, nil
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

func ProcessAndCorrelate(dumpReader, usageReader io.Reader) ([]Thread, error) {
	threads, err := ParseThread(dumpReader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dump: %w", err)
	}

	if usageReader != nil {
		usages, err := ParseThreadUsage(usageReader)
		if err == nil {
			usageMap := make(map[int64]ThreadUsage)
			for _, u := range usages {
				usageMap[u.TID] = u
			}
			for i := range threads {
				t := &threads[i]
				if usage, found := usageMap[t.NativeID]; found {
					t.CPUPercentage = usage.CPUPercentage
					if usage.UserTime > 0 {
						t.CPUTime = usage.UserTime
					}
				}
			}
		}
	}

	// Flag runaway-CPU threads (>= 100%) as CRITICAL natively.
	// These are unambiguous infinite-loop / busy-spin signals and don't need rule inference.
	for i := range threads {
		t := &threads[i]
		if t.Analyzed {
			continue
		}
		if t.CPUPercentage >= 100.0 {
			t.RiskLevel = "CRITICAL"
			t.AddIssue(fmt.Sprintf("Runaway CPU Thread: thread is consuming %.1f%% CPU (likely infinite loop or busy-spin).", t.CPUPercentage))
			t.Recommendation = "Inspect the stack trace immediately for infinite loops, busy-waiting, or runaway computation. Consider thread.yield()/sleep where appropriate."
			t.Analyzed = true
		}
	}

	return threads, nil
}
