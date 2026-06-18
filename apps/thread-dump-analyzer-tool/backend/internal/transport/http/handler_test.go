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

package http

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/job"
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

func newJobStoreForTest(t *testing.T) *job.JobStore {
	t.Helper()
	return job.NewJobStore(newTestConfig())
}

// buildMultipart returns body bytes and the content-type header.
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

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.JobTimeout, job.NewJobLimiter(cfg.MaxConcurrentJobs))

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
	limiter := job.NewJobLimiter(1)
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

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.JobTimeout, job.NewJobLimiter(cfg.MaxConcurrentJobs))

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
	jb := store.Create()
	store.Update(jb.ID, func(j *job.Job) { j.Status = job.JobCompleted })

	r := httptest.NewRequest(http.MethodGet, "/analyze/jobs/"+jb.ID, nil)
	r.SetPathValue("id", jb.ID)
	w := httptest.NewRecorder()
	jobStatusHandler(w, r, store)

	if w.Code != http.StatusOK {
		t.Fatalf("code=%d", w.Code)
	}
	var got job.Job
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != jb.ID || got.Status != job.JobCompleted {
		t.Errorf("got=%+v", got)
	}
}
