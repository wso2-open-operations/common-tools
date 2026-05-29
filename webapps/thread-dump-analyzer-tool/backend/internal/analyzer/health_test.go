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

func snap(file, state, risk string) ThreadSnapshot {
	return ThreadSnapshot{FileName: file, State: state, RiskLevel: risk}
}

func TestComputeHealth_EmptyIsPerfect(t *testing.T) {
	if score, factors := ComputeHealth(nil); score != 100 || factors != nil {
		t.Fatalf("got (%d, %v), want (100, nil)", score, factors)
	}
}

func TestComputeHealth_AllRunnableIsPerfect(t *testing.T) {
	threads := []AnalyzedThread{
		{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}},
	}
	if score, factors := ComputeHealth(threads); score != 100 || len(factors) != 0 {
		t.Fatalf("got (%d, %v), want (100, [])", score, factors)
	}
}

func TestComputeHealth_StatePenalties(t *testing.T) {
	// 4 threads: 1 BLOCKED, 1 WAITING, 2 RUNNABLE -> 25%*50 + 25%*15 = 12.5+3.75 -> 13+4=17 penalty.
	threads := []AnalyzedThread{
		{Snapshots: []ThreadSnapshot{snap("d1", "BLOCKED", "")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "WAITING", "")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}},
	}
	score, factors := ComputeHealth(threads)
	if score != 83 {
		t.Fatalf("score = %d, want 83", score)
	}
	if len(factors) != 2 {
		t.Fatalf("factors = %v, want 2 entries", factors)
	}
}

func TestComputeHealth_CriticalIsCountBased(t *testing.T) {
	// A lone CRITICAL thread among many RUNNABLE should still drop the score by 12.
	threads := make([]AnalyzedThread, 0, 100)
	threads = append(threads, AnalyzedThread{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "CRITICAL")}})
	for i := 0; i < 99; i++ {
		threads = append(threads, AnalyzedThread{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}})
	}
	if score, _ := ComputeHealth(threads); score != 88 {
		t.Fatalf("score = %d, want 88", score)
	}
}

func TestComputeHealth_UsesLatestDumpNaturalOrder(t *testing.T) {
	// dump_10 is the latest by natural order, not lexical (where dump_2 > dump_10).
	threads := []AnalyzedThread{{Snapshots: []ThreadSnapshot{
		snap("dump_2", "BLOCKED", ""),
		snap("dump_10", "RUNNABLE", ""),
	}}}
	if score, factors := ComputeHealth(threads); score != 100 || len(factors) != 0 {
		t.Fatalf("got (%d, %v), want latest=dump_10 clean (100, [])", score, factors)
	}
}

func TestComputeHealth_FactorsSumToDeficit(t *testing.T) {
	threads := []AnalyzedThread{
		{Snapshots: []ThreadSnapshot{snap("d1", "BLOCKED", "CRITICAL")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "WAITING", "")}},
		{Snapshots: []ThreadSnapshot{snap("d1", "RUNNABLE", "")}},
	}
	score, factors := ComputeHealth(threads)
	sum := 0
	for _, f := range factors {
		sum += f.Penalty
	}
	if sum != 100-score {
		t.Fatalf("factors sum to %d, want %d (100-score)", sum, 100-score)
	}
}