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
	"path/filepath"
	"testing"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"
)

func writeTestPoolYAML(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "thread_pools.yaml")
	content := `pools:
  - name: "Tomcat HTTP Threads"
    patterns:
      - "^http-nio-\\d+-exec-\\d+$"
    description: "Tomcat HTTP worker"
    expected_behavior: "Idle when no traffic"
  - name: "Worker Threads"
    patterns:
      - "^pool-\\d+-thread-\\d+$"
    description: "Generic worker"
    expected_behavior: "Idle or running tasks"
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write yaml: %v", err)
	}
	return path
}

func TestEnrich_ClassifiesAndFallsBack(t *testing.T) {
	enr, err := NewThreadEnricher(writeTestPoolYAML(t))
	if err != nil {
		t.Fatalf("NewThreadEnricher: %v", err)
	}
	threads := []parser.Thread{
		{Name: "http-nio-8080-exec-1"},
		{Name: "pool-3-thread-7"},
		{Name: "MyOddThread"},
	}
	enr.Enrich(context.Background(), threads)

	if threads[0].ThreadPool != "Tomcat HTTP Threads" {
		t.Errorf("got pool=%q for http-nio", threads[0].ThreadPool)
	}
	if threads[1].ThreadPool != "Worker Threads" {
		t.Errorf("got pool=%q for pool-3-thread-7", threads[1].ThreadPool)
	}
	if threads[2].ThreadPool != "Standalone/ Ungrouped Threads" {
		t.Errorf("expected standalone fallback, got %q", threads[2].ThreadPool)
	}
}

func TestEnrich_ConcurrentSafe(t *testing.T) {
	enr, err := NewThreadEnricher(writeTestPoolYAML(t))
	if err != nil {
		t.Fatalf("NewThreadEnricher: %v", err)
	}
	threads := make([]parser.Thread, 5000)
	for i := range threads {
		if i%2 == 0 {
			threads[i].Name = "http-nio-8080-exec-1"
		} else {
			threads[i].Name = "pool-1-thread-1"
		}
	}

	enr.Enrich(context.Background(), threads)

	for i, tr := range threads {
		if tr.ThreadPool == "" {
			t.Errorf("thread %d unclassified", i)
		}
	}
}

func TestEnrich_HonorsCancelledContext(t *testing.T) {
	enr, err := NewThreadEnricher(writeTestPoolYAML(t))
	if err != nil {
		t.Fatalf("NewThreadEnricher: %v", err)
	}
	threads := make([]parser.Thread, 10000)
	for i := range threads {
		threads[i].Name = "http-nio-8080-exec-1"
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// Context is cancelled before Enrich starts, so no thread should be classified; a non-zero count means cancellation was checked too late.
	enr.Enrich(ctx, threads)

	classified := 0
	for _, tr := range threads {
		if tr.ThreadPool != "" {
			classified++
		}
	}
	if classified != 0 {
		t.Errorf("expected cancellation before any classification; got %d classified threads", classified)
	}
}

func TestPoolMetadata_ExposesAllPools(t *testing.T) {
	enr, err := NewThreadEnricher(writeTestPoolYAML(t))
	if err != nil {
		t.Fatalf("NewThreadEnricher: %v", err)
	}
	md := enr.PoolMetadata()
	if len(md) != 2 {
		t.Fatalf("metadata len=%d, want 2", len(md))
	}
	if md["Tomcat HTTP Threads"].Description != "Tomcat HTTP worker" {
		t.Errorf("missing/wrong Tomcat description: %#v", md["Tomcat HTTP Threads"])
	}
}
