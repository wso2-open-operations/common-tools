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

import "testing"

// Multi-snapshot threads must count once per identity, not per-snapshot.
func TestComputePatternMatches_CountsUniqueThreadsNotSnapshots(t *testing.T) {
	threads := []AnalyzedThread{
		{ID: "1", Snapshots: []ThreadSnapshot{
			{Issues: []string{"Deadlock Detected: cycle"}},
			{Issues: []string{"Deadlock Detected: cycle"}},
		}},
		{ID: "2", Snapshots: []ThreadSnapshot{
			{Issues: []string{"Deadlock Detected: cycle"}},
		}},
		{ID: "3", Snapshots: []ThreadSnapshot{
			{Issues: []string{"Runaway CPU Thread: 150% CPU"}},
		}},
	}
	out := ComputePatternMatches(threads)

	byName := map[string]int{}
	for _, p := range out {
		byName[p.RuleName] = p.MatchedThreadCount
	}
	if byName["DeadlockDetection"] != 2 {
		t.Errorf("DeadlockDetection count=%d, want 2 unique threads", byName["DeadlockDetection"])
	}
	if byName["RunawayCPUThread"] != 1 {
		t.Errorf("RunawayCPUThread count=%d, want 1", byName["RunawayCPUThread"])
	}
}

func TestComputePatternMatches_OmitsZeroCounts(t *testing.T) {
	threads := []AnalyzedThread{
		{ID: "1", Snapshots: []ThreadSnapshot{{Issues: []string{"Deadlock Detected: x"}}}},
	}
	out := ComputePatternMatches(threads)
	for _, p := range out {
		if p.MatchedThreadCount == 0 {
			t.Errorf("expected zero-count rules to be omitted, found %q", p.RuleName)
		}
	}
	if len(out) != 1 {
		t.Errorf("expected exactly 1 matched rule, got %d", len(out))
	}
}
