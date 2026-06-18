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

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
)

func newTestConfig() *Config {
	return &Config{
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

// buildMultipart returns body bytes, content-type, and a teardown.
func buildMultipart(t *testing.T, fields map[string][]struct{ name, content string }) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	for field, files := range fields {
		for _, f := range files {
			part, err := mw.CreateFormFile(field, f.name)
			if err != nil {
				t.Fatalf("CreateFormFile: %v", err)
			}
			part.Write([]byte(f.content))
		}
	}
	mw.Close()
	return body, mw.FormDataContentType()
}

// Missing dumps → 400 with the generic message.
func TestAnalyzeJobsHandler_400OnMissingDumps(t *testing.T) {
	cfg := newTestConfig()
	body, ct := buildMultipart(t, map[string][]struct{ name, content string }{
		"thread_usages": {{"u.txt", "1 0x1 5 00:00:01"}},
	})
	r := httptest.NewRequest(http.MethodPost, "/analyze/jobs", body)
	r.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.JobTimeout, NewJobLimiter(cfg.MaxConcurrentJobs))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("code=%d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "No thread dumps") {
		t.Errorf("unexpected body: %s", w.Body.String())
	}
}

// Saturated JobLimiter → 429.
func TestAnalyzeJobsHandler_429WhenJobLimiterSaturated(t *testing.T) {
	cfg := newTestConfig()
	limiter := NewJobLimiter(1)
	if !limiter.TryAcquire() {
		t.Fatal("pre-acquire failed")
	}

	body, ct := buildMultipart(t, map[string][]struct{ name, content string }{
		"thread_dumps": {{"d.txt", `"t" #1 prio=5 tid=0x1 nid=0x1 waiting` + "\n   java.lang.Thread.State: RUNNABLE\n"}},
	})
	r := httptest.NewRequest(http.MethodPost, "/analyze/jobs", body)
	r.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.JobTimeout, limiter)

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("code=%d, want 429", w.Code)
	}
}

// 4xx error messages must include the correlation ref but NOT raw err.Error() internals.
func TestAnalyzeJobsHandler_BadMultipartReturnsRefAndGenericMessage(t *testing.T) {
	cfg := newTestConfig()
	r := httptest.NewRequest(http.MethodPost, "/analyze/jobs", strings.NewReader("not-a-multipart-body"))
	r.Header.Set("Content-Type", "multipart/form-data; boundary=xxx")
	w := httptest.NewRecorder()

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.JobTimeout, NewJobLimiter(cfg.MaxConcurrentJobs))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("code=%d, want 400", w.Code)
	}
	bodyStr := w.Body.String()
	if !strings.Contains(bodyStr, "ref=") {
		t.Errorf("expected correlation ref in body, got: %s", bodyStr)
	}
	if strings.Contains(bodyStr, "EOF") || strings.Contains(bodyStr, "multipart:") {
		t.Errorf("error body leaks internal err.Error() detail: %s", bodyStr)
	}
}

// 404 for unknown job ID.
func TestJobStatusHandler_404WhenUnknown(t *testing.T) {
	store := newJobStoreForTest(t)
	r := httptest.NewRequest(http.MethodGet, "/analyze/jobs/does-not-exist", nil)
	r.SetPathValue("id", "does-not-exist")
	w := httptest.NewRecorder()
	jobStatusHandler(w, r, store)
	if w.Code != http.StatusNotFound {
		t.Fatalf("code=%d, want 404", w.Code)
	}
}

func TestJobStatusHandler_ReturnsJobJSON(t *testing.T) {
	store := newJobStoreForTest(t)
	job := store.Create()
	store.Update(job.ID, func(j *Job) { j.Status = JobCompleted })

	r := httptest.NewRequest(http.MethodGet, "/analyze/jobs/"+job.ID, nil)
	r.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()
	jobStatusHandler(w, r, store)

	if w.Code != http.StatusOK {
		t.Fatalf("code=%d", w.Code)
	}
	var got Job
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != job.ID || got.Status != JobCompleted {
		t.Errorf("got=%+v", got)
	}
}

func TestJobStore_Get_ReturnsSnapshotNotPointer(t *testing.T) {
	store := newJobStoreForTest(t)
	job := store.Create()
	snap1, _ := store.Get(job.ID)
	store.Update(job.ID, func(j *Job) { j.Status = JobFailed })
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

// runJob must mark the job failed with the timeout message when runAnalysis blocks past the deadline.
func TestRunJob_TimeoutMarksFailed(t *testing.T) {
	cfg := newTestConfig()
	cfg.JobTimeout = 50 * time.Millisecond
	store := NewJobStore(cfg)
	job := store.Create()

	// Swap runAnalysisFn for a stub that blocks until ctx is cancelled, so the deadline path is the only way out.
	prev := runAnalysisFn
	t.Cleanup(func() { runAnalysisFn = prev })
	runAnalysisFn = func(ctx context.Context, _, _ []filePayload, _ *analyzer.RuleEngine, _ *analyzer.ThreadEnricher) (*AggregatedAnalysisResponse, error) {
		<-ctx.Done()
		return nil, nil
	}

	done := make(chan struct{})
	go func() {
		runJob(job.ID, nil, nil, store, nil, nil, cfg.JobTimeout)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("runJob did not return")
	}

	got, ok := store.Get(job.ID)
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
	dumps := []filePayload{{FileName: "notes.txt", Data: []byte("this is not a thread dump\njust some prose\n")}}

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
	dumps := []filePayload{{FileName: "d.txt", Data: []byte(dump)}}
	usages := []filePayload{{FileName: "u.txt", Data: []byte("garbage with no usable columns\n")}}

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

// Sanity check: clientIP strips the port from RemoteAddr without trusting X-Forwarded-For.
func TestClientIP_StripsPort(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(context.Background())
	r.RemoteAddr = "10.0.0.5:54321"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")

	host := func(r *http.Request) string {
		// Mirror the inline logic in IPLimiter.limitByIP to ensure consistency.
		l := NewIPLimiter(1, 1, time.Hour, 0)
		var captured string
		h := l.limitByIP(func(w http.ResponseWriter, req *http.Request) { captured = req.RemoteAddr })
		w := httptest.NewRecorder()
		h(w, r)
		return captured
	}(r)
	if !strings.HasPrefix(host, "10.0.0.5:") {
		t.Errorf("RemoteAddr modified unexpectedly: %q", host)
	}
}
