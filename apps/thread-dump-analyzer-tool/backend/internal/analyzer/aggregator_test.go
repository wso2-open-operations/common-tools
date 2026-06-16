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
	"testing"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"
)

func TestAggregateThreads_PerThreadSnapshotsPerFile(t *testing.T) {
	files := []ParsedFile{
		{FileName: "dump1.txt", Threads: []parser.Thread{
			{ID: "0x1", Name: "worker", NativeID: 100, ThreadPool: "P", State: "RUNNABLE"},
		}},
		{FileName: "dump2.txt", Threads: []parser.Thread{
			{ID: "0x1", Name: "worker", NativeID: 100, ThreadPool: "P", State: "BLOCKED"},
		}},
	}
	out := AggregateThreads(files)
	if len(out) != 1 {
		t.Fatalf("expected 1 aggregated thread, got %d", len(out))
	}
	if len(out[0].Snapshots) != 2 {
		t.Fatalf("expected 2 snapshots, got %d", len(out[0].Snapshots))
	}
	if out[0].Snapshots[0].FileName != "dump1.txt" || out[0].Snapshots[1].FileName != "dump2.txt" {
		t.Errorf("snapshots out of order: %v", out[0].Snapshots)
	}
}

// Composite identity is {id, name, native_id, thread_pool} — differing on ANY field splits into separate entries.
func TestAggregateThreads_DifferingPoolSplitsIdentity(t *testing.T) {
	files := []ParsedFile{
		{FileName: "dump1.txt", Threads: []parser.Thread{
			{ID: "0x1", Name: "worker", NativeID: 100, ThreadPool: "PoolA"},
		}},
		{FileName: "dump2.txt", Threads: []parser.Thread{
			{ID: "0x1", Name: "worker", NativeID: 100, ThreadPool: "PoolB"},
		}},
	}
	out := AggregateThreads(files)
	if len(out) != 2 {
		t.Fatalf("expected 2 aggregated threads (same id, different pool), got %d", len(out))
	}
	pools := map[string]bool{out[0].ThreadPool: true, out[1].ThreadPool: true}
	if !pools["PoolA"] || !pools["PoolB"] {
		t.Errorf("expected both pools represented, got %#v", pools)
	}
}

func TestAggregateThreads_CreationOrderPreserved(t *testing.T) {
	files := []ParsedFile{
		{FileName: "dump1.txt", Threads: []parser.Thread{
			{ID: "0x1", Name: "first", NativeID: 1, ThreadPool: "P"},
			{ID: "0x2", Name: "second", NativeID: 2, ThreadPool: "P"},
			{ID: "0x3", Name: "third", NativeID: 3, ThreadPool: "P"},
		}},
	}
	out := AggregateThreads(files)
	if len(out) != 3 {
		t.Fatalf("got %d threads", len(out))
	}
	if out[0].Name != "first" || out[1].Name != "second" || out[2].Name != "third" {
		t.Errorf("order not preserved: %v", []string{out[0].Name, out[1].Name, out[2].Name})
	}
}
