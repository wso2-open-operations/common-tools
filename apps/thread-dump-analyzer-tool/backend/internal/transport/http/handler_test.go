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
	"compress/gzip"
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
		MaxUploadBytes:            1 << 20,
		MaxDecompressedBytes:      10 << 20,
		MaxTotalDecompressedBytes: 20 << 20,
		JobTTL:                    time.Hour,
		JobStoreMaxSize:           10,
		JobJanitorTick:            time.Hour,
		JobTimeout:                500 * time.Millisecond,
		MaxConcurrentJobs:         5,
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

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.MaxDecompressedBytes, cfg.MaxTotalDecompressedBytes, cfg.JobTimeout, job.NewJobLimiter(cfg.MaxConcurrentJobs))

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

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.MaxDecompressedBytes, cfg.MaxTotalDecompressedBytes, cfg.JobTimeout, limiter)

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

	analyzeJobsHandler(w, r, newJobStoreForTest(t), nil, nil, cfg.MaxUploadBytes, cfg.MaxDecompressedBytes, cfg.MaxTotalDecompressedBytes, cfg.JobTimeout, job.NewJobLimiter(cfg.MaxConcurrentJobs))

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

// gzipBytes compresses data so tests can build gzip-encoded multipart parts.
func gzipBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	if _, err := zw.Write(data); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}
	return buf.Bytes()
}

// Raw (non-gzip) data passes through untouched so cURL and the HTML form keep working.
func TestMaybeGunzip_PassesRawThrough(t *testing.T) {
	raw := []byte("plain thread dump text")
	out, err := maybeGunzip("d.txt", raw, 1<<20)
	if err != nil {
		t.Fatalf("maybeGunzip: %v", err)
	}
	if string(out) != string(raw) {
		t.Errorf("raw data altered: got %q", out)
	}
}

// A gzip part round-trips back to its original bytes.
func TestMaybeGunzip_InflatesGzip(t *testing.T) {
	content := []byte("Full thread dump\n\"main\" RUNNABLE\n")
	out, err := maybeGunzip("d.txt.gz", gzipBytes(t, content), 1<<20)
	if err != nil {
		t.Fatalf("maybeGunzip: %v", err)
	}
	if string(out) != string(content) {
		t.Errorf("inflate mismatch: got %q, want %q", out, content)
	}
}

// A small gzip that inflates past the cap is rejected, not buffered into memory.
func TestMaybeGunzip_RejectsDecompressionBomb(t *testing.T) {
	gz := gzipBytes(t, make([]byte, 1<<20)) // 1 MiB of zeros, tiny once compressed
	if _, err := maybeGunzip("bomb.gz", gz, 1<<10); err == nil {
		t.Fatal("expected error for oversized inflate, got nil")
	}
}

// readMultipartFiles inflates gzip parts and strips the .gz suffix from the stored name.
func TestReadMultipartFiles_InflatesGzipPart(t *testing.T) {
	content := []byte(`"t" #1 prio=5 tid=0x1 nid=0x1` + "\n   java.lang.Thread.State: RUNNABLE\n")

	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	part, err := mw.CreateFormFile("thread_dumps", "d.txt.gz")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	part.Write(gzipBytes(t, content))
	mw.Close()

	form, err := multipart.NewReader(body, mw.Boundary()).ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("ReadForm: %v", err)
	}
	defer form.RemoveAll()

	var total int64
	out, err := readMultipartFiles(form.File["thread_dumps"], 1<<20, 1<<20, &total)
	if err != nil {
		t.Fatalf("readMultipartFiles: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("got %d payloads, want 1", len(out))
	}
	if string(out[0].Data) != string(content) {
		t.Errorf("data not inflated: got %q", out[0].Data)
	}
	if out[0].FileName != "d.txt" {
		t.Errorf("filename not trimmed: got %q", out[0].FileName)
	}
}

// Parts that each clear the per-file cap still fail once their running total passes the request cap.
func TestReadMultipartFiles_RejectsCumulativeOverflow(t *testing.T) {
	content := bytes.Repeat([]byte("x"), 600<<10) // 600 KiB each: two together exceed a 1 MiB request cap

	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	for i := 0; i < 2; i++ {
		part, err := mw.CreateFormFile("thread_dumps", "d.txt")
		if err != nil {
			t.Fatalf("CreateFormFile: %v", err)
		}
		part.Write(content)
	}
	mw.Close()

	form, err := multipart.NewReader(body, mw.Boundary()).ReadForm(2 << 20)
	if err != nil {
		t.Fatalf("ReadForm: %v", err)
	}
	defer form.RemoveAll()

	// Per-file cap (1 MiB) clears each 600 KiB part, but the 1 MiB request cap rejects the second.
	var total int64
	if _, err := readMultipartFiles(form.File["thread_dumps"], 1<<20, 1<<20, &total); err == nil {
		t.Fatal("expected cumulative cap overflow error, got nil")
	}
}
