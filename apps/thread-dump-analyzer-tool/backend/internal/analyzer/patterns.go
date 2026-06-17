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

package analyzer

import "strings"

// One rule's hit count; rule_name mirrors internal/rules/rules.grl, issue_prefix mirrors AddIssue.
type PatternMatch struct {
	RuleName           string `json:"rule_name"`
	IssuePrefix        string `json:"issue_prefix"`
	MatchedThreadCount int    `json:"matched_thread_count"`
}

// Authoritative rule→issue-prefix map; keep in lockstep with rules.grl + parser pre-flags.
var rulePatterns = []struct {
	Name        string
	IssuePrefix string
}{
	{"DeadlockDetection", "Deadlock Detected"},
	{"RunawayCPUThread", "Runaway CPU Thread"},
	{"PassThroughStarvation", "PassThrough HTTP worker is blocked on backend I/O"},
	{"WSO2StuckIO", "WSO2 PassThrough I/O Thread is STUCK"},
	{"WSO2HeavyMediation", "Heavy Mediation / CPU Usage on WSO2 I/O Thread"},
	{"DBConnectionPoolExhaustion", "Stuck waiting for a Database Connection"},
	{"BlockedThreadsLong", "Thread Blocked for > 10s"},
	{"HighGlobalBlockage", "System-Wide Blockage"},
	{"SuddenBlockageSpike", "Sudden Blockage Spike"},
	{"ThreadStarvation", "Thread Starvation Risk"},
	{"GCPauseDetected", "GC Activity Detected"},
	{"DatabaseWait", "Thread executing Database/JDBC operations for > 5s"},
	{"CriticalLockContention", "Critical Lock Contention"},
	{"LongMonitorWait", "Long Monitor Wait"},
	{"HighContentionLock", "High Lock Contention"},
	{"CatastrophicThreadCount", "Catastrophic Thread Leak"},
	{"SustainedHighCPU", "Sustained High CPU Usage"},
	{"TimerSchedulerBlocked", "Timer/Scheduler Blocked"},
	{"LDAPUserStoreTimeout", "Thread delayed by slow LDAP/Active Directory response"},
	{"OAuth2TokenBottleneck", "Stuck during OAuth2 token validation"},
	{"HTTPRequestBottleneck", "HTTP Thread Bottleneck"},
	{"ThreadPoolSaturationWarning", "Worker Thread Pool member is blocked or long-running"},
	{"RecursiveLockContention", "Recursive Lock Contention"},
	{"NativeThreadIssue", "Native Thread Issue"},
	{"ThreadLeak", "Thread Leak Suspected"},
	{"HazelcastCacheContention", "Thread blocked on Hazelcast distributed cache"},
	{"IdleThreadsLong", "Long Idle Duration"},
	{"SevereLockContention", "Thread is BLOCKED waiting for a monitor lock"},
	{"HighCPUInfo", "Sustained High CPU - verify expected"},
	{"StandaloneThread", "Standalone Thread"},
}

// Counts unique threads (not snapshots) whose issues match each registered prefix.
func ComputePatternMatches(threads []AnalyzedThread) []PatternMatch {
	counts := make([]int, len(rulePatterns))
	for _, t := range threads {
		matched := make([]bool, len(rulePatterns))
		for _, s := range t.Snapshots {
			for _, issue := range s.Issues {
				for i, rp := range rulePatterns {
					if !matched[i] && strings.HasPrefix(issue, rp.IssuePrefix) {
						matched[i] = true
					}
				}
			}
		}
		for i := range rulePatterns {
			if matched[i] {
				counts[i]++
			}
		}
	}
	result := make([]PatternMatch, 0, len(rulePatterns))
	for i, rp := range rulePatterns {
		if counts[i] > 0 {
			result = append(result, PatternMatch{
				RuleName:           rp.Name,
				IssuePrefix:        rp.IssuePrefix,
				MatchedThreadCount: counts[i],
			})
		}
	}
	return result
}
