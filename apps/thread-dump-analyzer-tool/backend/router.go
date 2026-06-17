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
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"

	"github.com/rs/cors"
	"golang.org/x/time/rate"
)

// IPLimiter applies a per-remote-IP token bucket; idle visitors are evicted by a background janitor.
type IPLimiter struct {
	rps      rate.Limit
	burst    int
	ttl      time.Duration
	mu       sync.Mutex
	visitors map[string]*ipVisitor
}

type ipVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPLimiter(rps float64, burst int, ttl, janitorTick time.Duration) *IPLimiter {
	l := &IPLimiter{
		rps:      rate.Limit(rps),
		burst:    burst,
		ttl:      ttl,
		visitors: make(map[string]*ipVisitor),
	}
	if janitorTick > 0 {
		go l.janitor(janitorTick)
	}
	return l
}

func (l *IPLimiter) Allow(ip string) bool {
	l.mu.Lock()
	v, ok := l.visitors[ip]
	if !ok {
		v = &ipVisitor{limiter: rate.NewLimiter(l.rps, l.burst)}
		l.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	l.mu.Unlock()
	return v.limiter.Allow()
}

func (l *IPLimiter) janitor(tick time.Duration) {
	ticker := time.NewTicker(tick)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-l.ttl)
		l.mu.Lock()
		for ip, v := range l.visitors {
			if v.lastSeen.Before(cutoff) {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

// limitByIP wraps a handler so each remote IP gets its own token bucket; 429 on refuse.
// Trusts r.RemoteAddr (OS-reported TCP peer) — does not honor X-Forwarded-For to avoid client spoofing.
func (l *IPLimiter) limitByIP(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		if !l.Allow(host) {
			http.Error(w, "Too many requests, please slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	}
}

// NewRouter builds the HTTP handler: a ServeMux with all routes registered,
// wrapped in CORS middleware. Ready to attach to an http.Server.
// requireAuth gates the analyze endpoints behind Bearer-JWT validation; pass an
// identity wrapper when auth is disabled. /health and the HTML form stay open.
func NewRouter(cfg *Config, jobStore *JobStore, engine *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher, ipLimiter *IPLimiter, jobLimiter *JobLimiter, requireAuth func(http.HandlerFunc) http.HandlerFunc) http.Handler {
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
