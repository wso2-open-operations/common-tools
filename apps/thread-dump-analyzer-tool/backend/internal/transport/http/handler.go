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
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/cors"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/job"
)

// NewRouter builds the HTTP handler: a ServeMux with all routes registered,
// wrapped in CORS middleware. Ready to attach to an http.Server.
// requireAuth gates the analyze endpoints behind Bearer-JWT validation; pass an
// identity wrapper when auth is disabled. /health and the HTML form stay open.
func NewRouter(cfg *config.Config, jobStore *job.JobStore, engine *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher, ipLimiter *IPLimiter, jobLimiter *job.JobLimiter, requireAuth func(http.HandlerFunc) http.HandlerFunc) http.Handler {
	mux := http.NewServeMux()

	// The manual-testing form sends no Authorization header, so only expose it when auth is off.
	if !cfg.AuthEnabled {
		mux.HandleFunc("GET /{$}", serveHTML)
	}
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	// IP rate-limit wraps auth so unauthenticated floods can't burn JWT verification cycles.
	mux.HandleFunc("POST /analyze/jobs", ipLimiter.limitByIP(requireAuth(func(w http.ResponseWriter, r *http.Request) {
		analyzeJobsHandler(w, r, jobStore, engine, enricher, cfg.MaxUploadBytes, cfg.JobTimeout, jobLimiter)
	})))
	mux.HandleFunc("GET /analyze/jobs/{id}", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		jobStatusHandler(w, r, jobStore)
	}))

	c := cors.New(cors.Options{
		AllowedOrigins: cfg.CORSAllowedOrigins,
		AllowedMethods: cfg.CORSAllowedMethods,
		AllowedHeaders: cfg.CORSAllowedHeaders,
		Debug:          cfg.CORSDebug,
		Logger:         slog.NewLogLogger(slog.Default().Handler(), slog.LevelDebug),
	})
	return c.Handler(mux)
}

// readMultipartFiles buffers each uploaded file into memory so analysis can continue after the request returns.
func readMultipartFiles(headers []*multipart.FileHeader) ([]job.FilePayload, error) {
	out := make([]job.FilePayload, 0, len(headers))
	for _, h := range headers {
		f, err := h.Open()
		if err != nil {
			return nil, fmt.Errorf("open %s: %w", h.Filename, err)
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", h.Filename, err)
		}
		out = append(out, job.FilePayload{FileName: h.Filename, Data: data})
	}
	return out, nil
}

func analyzeJobsHandler(w http.ResponseWriter, r *http.Request, store *job.JobStore, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher, maxUploadBytes int64, jobTimeout time.Duration, jobLimiter *job.JobLimiter) {
	// reqID correlates the generic client message with the full server-side log entry.
	reqID := uuid.NewString()

	// Cap body size so ParseMultipartForm keeps file parts in RAM, not $TMPDIR.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		slog.Warn("multipart parse failed", "request_id", reqID, "error", err)
		http.Error(w, fmt.Sprintf("Could not process upload. Limit is %d MiB (ref=%s)", maxUploadBytes>>20, reqID), http.StatusBadRequest)
		return
	}

	dumpHeaders := r.MultipartForm.File["thread_dumps"]
	usageHeaders := r.MultipartForm.File["thread_usages"]

	if len(dumpHeaders) == 0 {
		http.Error(w, "No thread dumps uploaded", http.StatusBadRequest)
		return
	}

	dumps, err := readMultipartFiles(dumpHeaders)
	if err != nil {
		slog.Warn("failed to read thread_dumps upload", "request_id", reqID, "error", err)
		http.Error(w, fmt.Sprintf("Failed to process upload (ref=%s)", reqID), http.StatusBadRequest)
		return
	}
	usages, err := readMultipartFiles(usageHeaders)
	if err != nil {
		slog.Warn("failed to read thread_usages upload", "request_id", reqID, "error", err)
		http.Error(w, fmt.Sprintf("Failed to process upload (ref=%s)", reqID), http.StatusBadRequest)
		return
	}

	if !jobLimiter.TryAcquire() {
		http.Error(w, "Server busy, too many concurrent analyses; try again shortly", http.StatusTooManyRequests)
		return
	}

	j := store.Create()
	go func() {
		defer jobLimiter.Release()
		job.RunJob(j.ID, dumps, usages, store, eng, enricher, jobTimeout)
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"job_id": j.ID})
}

func jobStatusHandler(w http.ResponseWriter, r *http.Request, store *job.JobStore) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	j, ok := store.Get(id)
	if !ok {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(j)
}

func serveHTML(w http.ResponseWriter, r *http.Request) {
	html := `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Thread Dump Analyzer Tool</title>
		<style>
			body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; background-color: #f4f4f9; color: #333; }
			.container { max-width: 800px; margin: 0 auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
			h2 { margin-top: 0; color: #444; }
			.form-group { margin-bottom: 1.5rem; }
			label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
			input[type="file"] { display: block; width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; }
			.hint { font-size: 0.875rem; color: #777; margin-top: 0.25rem; }
			button { background-color: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 600; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
			button:hover { background-color: #0056b3; }
			button:disabled { background-color: #6aabf7; cursor: not-allowed; }
			#summary-box { margin-top: 2rem; padding: 1rem 1.25rem; background: #fde9cd; border-left: 4px solid #ff6d00; border-radius: 4px; display: none; }
			#summary-box h3 { margin: 0 0 0.5rem; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #ff6d00; }
			#summary-text { margin: 0; line-height: 1.6; }
			#json-output { margin-top: 1.5rem; display: none; }
			#json-output h3 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin: 0 0 0.5rem; }
			pre { background: #f4f4f9; border: 1px solid #ddd; border-radius: 4px; padding: 1rem; overflow: auto; font-size: 0.8rem; max-height: 500px; }
		</style>
	</head>
	<body>
		<div class="container">
			<h2>Thread Dump Analyzer</h2>
			<form id="upload-form">
				<div class="form-group">
					<label for="thread_dumps">1. Thread Dumps (Required)</label>
					<input type="file" id="thread_dumps" name="thread_dumps" multiple required>
					<div class="hint">Upload one or more thread dump files.</div>
				</div>
				<div class="form-group">
					<label for="thread_usages">2. Thread Usage (Optional)</label>
					<input type="file" id="thread_usages" name="thread_usages" multiple>
				</div>
				<button type="submit" id="submit-btn">Analyze</button>
			</form>

			<div id="summary-box">
				<h3>Executive Summary</h3>
				<p id="summary-text"></p>
			</div>

			<div id="json-output">
				<h3>Full JSON Response</h3>
				<pre id="json-pre"></pre>
			</div>
		</div>
		<script>
			const sleep = ms => new Promise(r => setTimeout(r, ms));

			document.getElementById('upload-form').addEventListener('submit', async function(e) {
				e.preventDefault();
				const btn = document.getElementById('submit-btn');
				btn.disabled = true;
				btn.textContent = 'Analyzing...';
				document.getElementById('summary-box').style.display = 'none';
				document.getElementById('json-output').style.display = 'none';

				const form = new FormData();
				for (const f of document.getElementById('thread_dumps').files) form.append('thread_dumps', f);
				for (const f of document.getElementById('thread_usages').files) form.append('thread_usages', f);

				try {
					const submitRes = await fetch('/analyze/jobs', { method: 'POST', body: form });
					if (!submitRes.ok) throw new Error('submit failed: HTTP ' + submitRes.status);
					const { job_id } = await submitRes.json();

					let data;
					while (true) {
						await sleep(1000);
						const pollRes = await fetch('/analyze/jobs/' + job_id);
						if (!pollRes.ok) throw new Error('poll failed: HTTP ' + pollRes.status);
						const job = await pollRes.json();
						if (job.status === 'completed') { data = job.result; break; }
						if (job.status === 'failed') throw new Error(job.error || 'job failed');
					}

					if (data.ai_insights && data.ai_insights.executive_summary) {
						document.getElementById('summary-text').textContent = data.ai_insights.executive_summary;
						document.getElementById('summary-box').style.display = 'block';
					}

					document.getElementById('json-pre').textContent = JSON.stringify(data, null, 2);
					document.getElementById('json-output').style.display = 'block';
				} catch (err) {
					alert('Request failed: ' + err.message);
				} finally {
					btn.disabled = false;
					btn.textContent = 'Analyze';
				}
			});
		</script>
	</body>
	</html>
	`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}
