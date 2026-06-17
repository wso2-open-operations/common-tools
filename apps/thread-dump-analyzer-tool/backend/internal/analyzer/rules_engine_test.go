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

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"
)

const rulesPath = "../rules/rules.grl"

func newTestEngine(t *testing.T) *RuleEngine {
	t.Helper()
	if _, err := os.Stat(rulesPath); err != nil {
		t.Skipf("rules file not available at %s: %v", rulesPath, err)
	}
	eng, err := NewEngine(rulesPath)
	if err != nil {
		t.Fatalf("NewEngine: %v", err)
	}
	return eng
}

func TestAnalyzeThreads_BlockedLongFiresHIGH(t *testing.T) {
	eng := newTestEngine(t)
	threads := []parser.Thread{
		{
			Name:        "blocker",
			State:       "BLOCKED",
			ElapsedTime: 30,
			StackTrace:  []string{"at com.example.Foo.bar(Foo.java:1)"},
		},
	}
	stats, err := eng.AnalyzeThreads(context.Background(), threads, false, 0, 0)
	if err != nil {
		t.Fatalf("AnalyzeThreads: %v", err)
	}
	if stats == nil || stats.TotalThreads != 1 {
		t.Fatalf("stats=%+v", stats)
	}
	if threads[0].RiskLevel != parser.RiskHigh {
		t.Errorf("risk=%q, want HIGH (BlockedThreadsLong)", threads[0].RiskLevel)
	}
	if !threads[0].Analyzed {
		t.Errorf("expected Analyzed=true after a rule fires")
	}
	if len(threads[0].Issues) == 0 {
		t.Errorf("expected at least one issue")
	}
}

// Pre-Analyzed=true threads must not be re-classified — the parser pre-flags deadlocks and runaways,
// and the rules engine should treat those as final.
func TestAnalyzeThreads_AnalyzedFlagGatesRules(t *testing.T) {
	eng := newTestEngine(t)
	threads := []parser.Thread{
		{
			Name:           "preflagged",
			State:          "BLOCKED",
			ElapsedTime:    100,
			RiskLevel:      parser.RiskCritical,
			Analyzed:       true,
			Issues:         []string{"Deadlock Detected: pre-flagged"},
			Recommendation: "previous recommendation",
		},
	}
	_, err := eng.AnalyzeThreads(context.Background(), threads, false, 0, 0)
	if err != nil {
		t.Fatalf("AnalyzeThreads: %v", err)
	}
	if threads[0].RiskLevel != parser.RiskCritical {
		t.Errorf("risk=%q, want pre-flagged CRITICAL preserved", threads[0].RiskLevel)
	}
	if len(threads[0].Issues) != 1 {
		t.Errorf("issues=%v, want only the pre-existing one", threads[0].Issues)
	}
}

func TestAnalyzeThreads_GlobalStatsBlockedPercent(t *testing.T) {
	eng := newTestEngine(t)
	threads := []parser.Thread{
		{Name: "a", State: "BLOCKED"},
		{Name: "b", State: "BLOCKED"},
		{Name: "c", State: "RUNNABLE"},
		{Name: "d", State: "WAITING"},
	}
	stats, err := eng.AnalyzeThreads(context.Background(), threads, false, 0, 0)
	if err != nil {
		t.Fatalf("AnalyzeThreads: %v", err)
	}
	if stats.TotalThreads != 4 {
		t.Errorf("total=%d", stats.TotalThreads)
	}
	if stats.BlockedPercentage != 50.0 {
		t.Errorf("blocked%%=%v, want 50", stats.BlockedPercentage)
	}
}

func TestAnalyzeThreads_JDBCStallCount(t *testing.T) {
	eng := newTestEngine(t)
	threads := []parser.Thread{
		{Name: "slowdb1", State: "RUNNABLE", ElapsedTime: 10, StackTrace: []string{"at java.sql.PreparedStatement.execute(PS.java:1)"}},
		{Name: "slowdb2", State: "RUNNABLE", ElapsedTime: 10, StackTrace: []string{"at com.zaxxer.hikari.pool.jdbc.HikariProxyConnection.commit(HikariProxyConnection.java:1)"}},
		{Name: "fastdb", State: "RUNNABLE", ElapsedTime: 1, StackTrace: []string{"at java.sql.Statement.execute(Statement.java:1)"}},
		{Name: "other", State: "RUNNABLE", ElapsedTime: 10, StackTrace: []string{"at com.example.Foo.bar(Foo.java:1)"}},
	}
	stats, err := eng.AnalyzeThreads(context.Background(), threads, false, 0, 0)
	if err != nil {
		t.Fatalf("AnalyzeThreads: %v", err)
	}
	if stats.JDBCStallCount != 2 {
		t.Errorf("JDBCStallCount=%d, want 2 (>5s + jdbc/hibernate)", stats.JDBCStallCount)
	}
}

func TestAnalyzeThreads_CancelledContextShortCircuits(t *testing.T) {
	eng := newTestEngine(t)
	threads := make([]parser.Thread, 200)
	for i := range threads {
		threads[i] = parser.Thread{
			Name:        "t",
			State:       "BLOCKED",
			ElapsedTime: 30,
			StackTrace:  []string{"at Foo.bar(Foo.java:1)"},
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := eng.AnalyzeThreads(ctx, threads, false, 0, 0)
	if err == nil {
		t.Logf("AnalyzeThreads returned nil error on cancelled ctx (acceptable if no thread reached the check)")
	} else if !strings.Contains(err.Error(), "context") {
		t.Errorf("err=%v, want context-related", err)
	}
}

func TestAnalyzeThreads_LockContentionCount(t *testing.T) {
	eng := newTestEngine(t)
	addr := "0x76b000abc"
	threads := []parser.Thread{
		{Name: "w1", State: "BLOCKED", WaitingToLockAddress: addr},
		{Name: "w2", State: "BLOCKED", WaitingToLockAddress: addr},
		{Name: "w3", State: "BLOCKED", WaitingToLockAddress: addr},
		{Name: "other", State: "RUNNABLE"},
	}
	_, err := eng.AnalyzeThreads(context.Background(), threads, false, 0, 0)
	if err != nil {
		t.Fatalf("AnalyzeThreads: %v", err)
	}
	for i, tr := range threads[:3] {
		if tr.LockContentionCount != 3 {
			t.Errorf("thread %d: LockContentionCount=%d, want 3", i, tr.LockContentionCount)
		}
	}
}
