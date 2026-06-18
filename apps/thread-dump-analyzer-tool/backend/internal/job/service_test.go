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

package job

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
)

func newTestConfig() *config.Config {
	return &config.Config{
		MaxUploadBytes:    1 << 20,
		JobTTL:            time.Hour,
		JobStoreMaxSize:   10,
		JobJanitorTick:    time.Hour,
		JobTimeout:        500 * time.Millisecond,
		MaxConcurrentJobs: 5,
	}
}

func newJobStoreForTest(t *testing.T) *JobStore {
	t.Helper()
	return NewJobStore(newTestConfig())
}

func TestJobLimiter_TryAcquireCapsAtMax(t *testing.T) {
	l := NewJobLimiter(2)
	if !l.TryAcquire() {
		t.Fatal("first acquire should succeed")
	}
	if !l.TryAcquire() {
		t.Fatal("second acquire should succeed")
	}
	if l.TryAcquire() {
		t.Fatal("third acquire should fail at cap=2")
	}
	l.Release()
	if !l.TryAcquire() {
		t.Fatal("after release, acquire should succeed")
	}
}

func TestJobLimiter_ReleaseIsNonBlockingOnEmpty(t *testing.T) {
	l := NewJobLimiter(1)
	done := make(chan struct{})
	go func() {
		l.Release()
		l.Release()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Release blocked on empty semaphore — non-blocking guard missing")
	}
}

func TestJobLimiter_ConcurrentAcquireRelease(t *testing.T) {
	const cap = 5
	l := NewJobLimiter(cap)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if l.TryAcquire() {
				l.Release()
			}
		}()
	}
	wg.Wait()
	for i := 0; i < cap; i++ {
		if !l.TryAcquire() {
			t.Fatalf("acquire %d after concurrent churn should succeed", i)
		}
	}
}

func TestJobLimiter_ZeroOrNegativeMaxBecomesOne(t *testing.T) {
	for _, max := range []int{0, -1} {
		l := NewJobLimiter(max)
		if !l.TryAcquire() {
			t.Fatalf("max=%d should still allow one acquire", max)
		}
		if l.TryAcquire() {
			t.Fatalf("max=%d should cap at 1", max)
		}
	}
}

func TestJobStore_Get_ReturnsSnapshotNotPointer(t *testing.T) {
	store := newJobStoreForTest(t)
	jb := store.Create()
	snap1, _ := store.Get(jb.ID)
	store.Update(jb.ID, func(j *Job) { j.Status = JobFailed })
	if snap1.Status == JobFailed {
		t.Error("Get must return a snapshot; later Update leaked into prior caller")
	}
}

func TestJobStore_TerminalEvictionUnderPressure(t *testing.T) {
	cfg := newTestConfig()
	cfg.JobStoreMaxSize = 2
	store := NewJobStore(cfg)

	a := store.Create()
	b := store.Create()
	c := store.Create()
	store.Update(a.ID, func(j *Job) { j.Status = JobCompleted; j.UpdatedAt = time.Now().Add(-time.Hour) })
	store.Update(b.ID, func(j *Job) { j.Status = JobCompleted })
	store.Update(c.ID, func(j *Job) { j.Status = JobRunning })

	store.evict()

	if _, ok := store.Get(a.ID); ok {
		t.Error("expected oldest terminal job a to be evicted")
	}
	if _, ok := store.Get(b.ID); !ok {
		t.Error("newer terminal job b should remain")
	}
	if _, ok := store.Get(c.ID); !ok {
		t.Error("running job c must never be evicted")
	}
}

// RunJob must mark the job failed with the timeout message when runAnalysis blocks past the deadline.
func TestRunJob_TimeoutMarksFailed(t *testing.T) {
	cfg := newTestConfig()
	cfg.JobTimeout = 50 * time.Millisecond
	store := NewJobStore(cfg)
	jb := store.Create()

	// Swap runAnalysisFn for a stub that blocks until ctx is cancelled, so the deadline path is the only way out.
	prev := runAnalysisFn
	t.Cleanup(func() { runAnalysisFn = prev })
	runAnalysisFn = func(ctx context.Context, _, _ []FilePayload, _ *analyzer.RuleEngine, _ *analyzer.ThreadEnricher) (*AggregatedAnalysisResponse, error) {
		<-ctx.Done()
		return nil, nil
	}

	done := make(chan struct{})
	go func() {
		RunJob(jb.ID, nil, nil, store, nil, nil, cfg.JobTimeout)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("RunJob did not return")
	}

	got, ok := store.Get(jb.ID)
	if !ok {
		t.Fatalf("job missing")
	}
	if got.Status != JobFailed {
		t.Fatalf("status=%s, want %s", got.Status, JobFailed)
	}
	wantErr := "analysis timed out after " + cfg.JobTimeout.String()
	if got.Error != wantErr {
		t.Errorf("Job.Error=%q, want %q", got.Error, wantErr)
	}
}

// A non-dump file in thread_dumps must fail the job with a clear message naming the file.
func TestRunAnalysis_FailsFastOnNonDumpFile(t *testing.T) {
	dumps := []FilePayload{{FileName: "notes.txt", Data: []byte("this is not a thread dump\njust some prose\n")}}

	resp, err := runAnalysis(context.Background(), dumps, nil, nil, nil)
	if resp != nil {
		t.Fatalf("expected nil response on invalid upload, got %+v", resp)
	}
	if err == nil {
		t.Fatal("expected a validation error")
	}
	if !strings.Contains(err.Error(), "notes.txt") || !strings.Contains(err.Error(), "no Java threads") {
		t.Errorf("error should name the file and reason, got: %v", err)
	}
}

// A malformed thread_usages file must fail the job even when its paired dump is valid.
func TestRunAnalysis_FailsFastOnInvalidUsageFile(t *testing.T) {
	dump := `"main" #1 prio=5 tid=0x1 nid=0x1 runnable` + "\n   java.lang.Thread.State: RUNNABLE\n"
	dumps := []FilePayload{{FileName: "d.txt", Data: []byte(dump)}}
	usages := []FilePayload{{FileName: "u.txt", Data: []byte("garbage with no usable columns\n")}}

	resp, err := runAnalysis(context.Background(), dumps, usages, nil, nil)
	if resp != nil {
		t.Fatalf("expected nil response on invalid usage, got %+v", resp)
	}
	if err == nil {
		t.Fatal("expected a validation error")
	}
	if !strings.Contains(err.Error(), "u.txt") || !strings.Contains(err.Error(), "thread usage") {
		t.Errorf("error should name the usage file and reason, got: %v", err)
	}
}
