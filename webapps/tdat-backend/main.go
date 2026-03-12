package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"sync"
	"tdat-backend/internal/analyzer"
	"tdat-backend/internal/parser"
	"time"

	"github.com/google/uuid"
	"github.com/rs/cors"
)

// Top-level JSON response format for a structured analysis
type AggregatedAnalysisResponse struct {
	SessionID   string                       `json:"session_id"`
	Timestamp   string                       `json:"timestamp"`
	Threads     []analyzer.AnalyzedThread    `json:"threads"`
	ThreadPools map[string]analyzer.PoolInfo `json:"thread_pools,omitempty"`
	Errors      []string                     `json:"errors,omitempty"`
}

// Start HTTP server

func main() {
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

	// Create a new ServeMux
	mux := http.NewServeMux()

	// Register your routes on the mux
	mux.HandleFunc("GET /{$}", serveHTML)
	mux.HandleFunc("POST /api/v1/analyze", func(w http.ResponseWriter, r *http.Request) {
		parseHandler(w, r, engine, enricher)
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

// Request Handler Logic

func parseHandler(w http.ResponseWriter, r *http.Request, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) {

	// Parse Multipart Form (Limit upload size to 100MB)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, "Files too large. Limit is 100MB.", http.StatusBadRequest)
		return
	}

	// Retrieve file headers from the form data
	dumpHeaders := r.MultipartForm.File["thread_dumps"]
	usageHeaders := r.MultipartForm.File["thread_usages"]

	if len(dumpHeaders) == 0 {
		http.Error(w, "No thread dumps uploaded", http.StatusBadRequest)
		return
	}

	var parsedFiles []analyzer.ParsedFile
	var errorMessages []string

	var wg sync.WaitGroup
	var mu sync.Mutex

	// Process each uploaded thread dump file concurrently
	for i, dumpHeader := range dumpHeaders {
		wg.Add(1)

		// Launch a new goroutine for each file
		go func(index int, dHeader *multipart.FileHeader) {
			defer wg.Done()

			// Open Thread Dump
			dumpFile, err := dHeader.Open()
			if err != nil {
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Failed to open dump %s: %v", dHeader.Filename, err))
				mu.Unlock()
				return
			}

			// Open corresponding Usage File if it exists
			var usageFile multipart.File
			if index < len(usageHeaders) {
				usageHeader := usageHeaders[index]
				if uFile, err := usageHeader.Open(); err == nil {
					// Validate that the file contains valid thread usage data
					usages, _ := parser.ParseThreadUsage(uFile)
					if len(usages) == 0 {
						uFile.Close()
						mu.Lock()
						errorMessages = append(errorMessages, fmt.Sprintf("Invalid file. No valid thread usage data found in %s", usageHeader.Filename))
						mu.Unlock()
						return
					}
					// Reset reader to beginning for actual processing
					uFile.Seek(0, io.SeekStart)
					usageFile = uFile
				}
			}

			// Parse Raw Data & Correlate with Usage
			threads, err := parser.ProcessAndCorrelate(dumpFile, usageFile)

			// Close file handles immediately after reading
			dumpFile.Close()
			if usageFile != nil {
				usageFile.Close()
			}

			if err != nil {
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Failed to parse %s: %v", dHeader.Filename, err))
				mu.Unlock()
				return
			}

			// Check if threads exist in uploaded files
			if len(threads) == 0 {
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Invalid Files. No threads found in %s", dHeader.Filename))
				mu.Unlock()
				return
			}

			// Enrichment with Regex Matching - Categorizes threads into pools based on YAML config.
			enricher.Enrich(threads)

			/* Analysis of Rules Engine */

			// Check if usage data was provided for CPU inference logic
			usageDataProvided := (usageFile != nil)
			if err := eng.AnalyzeThreads(threads, usageDataProvided); err != nil {
				// Log rule engine errors but continue processing other files.
				log.Printf("Rule engine error on file %s: %v", dHeader.Filename, err)

				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Rule analysis failed for %s: %v", dHeader.Filename, err))
				mu.Unlock()
			}

			// Collect processed data for later aggregation
			mu.Lock()
			parsedFiles = append(parsedFiles, analyzer.ParsedFile{
				FileName: dHeader.Filename,
				Threads:  threads,
			})
			mu.Unlock()

		}(i, dumpHeader)
	}

	// Wait for all goroutines to finish processing before moving to aggregation
	wg.Wait()

	// Pivots data from a file-centric view to a thread-centric history view.
	aggregatedThreads := analyzer.AggregateThreads(parsedFiles)

	// Construct Final Response Object
	response := AggregatedAnalysisResponse{
		SessionID:   uuid.New().String(),
		Timestamp:   time.Now().Format(time.RFC3339),
		Threads:     aggregatedThreads,
		ThreadPools: enricher.PoolMetadata(),
		Errors:      errorMessages,
	}

	// Send JSON Response
	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode JSON response: %v", err)
	}
}

/* HTML page for testing */
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
		</style>
	</head>
	<body>
		<div class="container">
			<h2>Thread Dump Analyzer</h2>
			<form action="/api/v1/analyze" method="post" enctype="multipart/form-data">
				<div class="form-group">
					<label for="thread_dumps">1. Thread Dumps (Required)</label>
					<input type="file" id="thread_dumps" name="thread_dumps" multiple required>
					<div class="hint">Upload one or more thread dump files.</div>
				</div>
				<div class="form-group">
					<label for="thread_usages">2. Thread Usage (Optional)</label>
					<input type="file" id="thread_usages" name="thread_usages" multiple>
				</div>
				<button type="submit">Analyze</button>
			</form>
		</div>
	</body>
	</html>
	`
	w.Write([]byte(html))
}
