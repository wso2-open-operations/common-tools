package main

import (
	"fmt"
	"log"
	"net/http"
	"tdat-backend/internal/ai"
	"tdat-backend/internal/analyzer"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

// Top-level JSON response format for a structured analysis
type AggregatedAnalysisResponse struct {
	SessionID   string                       `json:"session_id"`
	Timestamp   string                       `json:"timestamp"`
	Threads     []analyzer.AnalyzedThread    `json:"threads"`
	ThreadPools map[string]analyzer.PoolInfo `json:"thread_pools,omitempty"`
	AIInsights  *ai.AIInsights               `json:"ai_insights,omitempty"`
	Errors      []string                     `json:"errors,omitempty"`
}

// Start HTTP server

func main() {
	// Load .env file if present (ignore error if not found)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	// Initialize Rules Engine
	engine, err := analyzer.NewEngine("./internal/rules/rules.grl")
	if err != nil {
		log.Fatalf("Failed to load rules engine: %v", err)
	}

	// Initialize Thread Enricher
	enricher, err := analyzer.NewThreadEnricher("./config/thread_pools.yaml")
	if err != nil {
		log.Fatalf("Failed to initialize thread enricher: %v", err)
	}

	// In-memory registry of asynchronous analysis jobs
	jobStore := NewJobStore()

	// Create a new ServeMux
	mux := http.NewServeMux()

	// Register routes
	mux.HandleFunc("GET /{$}", serveHTML)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("POST /api/v1/analyze/jobs", func(w http.ResponseWriter, r *http.Request) {
		analyzeJobsHandler(w, r, jobStore, engine, enricher)
	})
	mux.HandleFunc("GET /api/v1/analyze/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		jobStatusHandler(w, r, jobStore)
	})

	// Configure robust CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"}, // Allow all origins
		AllowedMethods: []string{"GET", "POST", "OPTIONS", "PUT", "DELETE"},
		AllowedHeaders: []string{"Accept", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization"},
		Debug:          true,
	})

	// Wrap the entire router with the CORS middleware
	handler := c.Handler(mux)

	// Start Server using the wrapped handler
	fmt.Println("Server started at http://localhost:8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatal(err)
	}
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
					const submitRes = await fetch('/api/v1/analyze/jobs', { method: 'POST', body: form });
					const { job_id } = await submitRes.json();

					let data;
					while (true) {
						await sleep(1000);
						const pollRes = await fetch('/api/v1/analyze/jobs/' + job_id);
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
	w.Write([]byte(html))
}
