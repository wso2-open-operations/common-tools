package main

import (
	"encoding/json"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"tdat-backend/internal/analyzer"
	"tdat-backend/internal/parser"
	"time"

	"github.com/google/uuid"
)

// Top-level JSON response format for a structured analysis
type AggregatedAnalysisResponse struct {
	SessionID string                    `json:"session_id"`
	Timestamp string                    `json:"timestamp"`
	Threads   []analyzer.AnalyzedThread `json:"threads"`
	Errors    []string                  `json:"errors,omitempty"`
}

// enableCORS sets the necessary headers to allow cross-origin requests from the frontend.
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		// Handle preflight browser requests gracefully
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// Start HTTP server

func main() {
	// Initialize Rules Engine (Grule) by loading rules from rules.grl
	engine, err := analyzer.NewEngine("./internal/rules/rules.grl")
	if err != nil {
		log.Fatalf("Failed to load rules engine: %v", err)
	}

	// Initialize Thread Enricher by loading YAML config for thread pool categorization.
	enricher, err := analyzer.NewThreadEnricher("./config/thread_pools.yaml")
	if err != nil {
		log.Fatalf("Failed to initialize thread enricher: %v", err)
	}

	// HTTP Routes
	http.HandleFunc("/", serveHTML)
	http.HandleFunc("/parse", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		parseHandler(w, r, engine, enricher)
	}))

	// Start Server
	fmt.Println("Server started at http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

// Request Handler Logic

func parseHandler(w http.ResponseWriter, r *http.Request, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse Multipart Form (Limit upload size to 50MB)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, "Files too large. Limit is 50MB.", http.StatusBadRequest)
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

	// Process each uploaded thread dump file sequentially
	for i, dumpHeader := range dumpHeaders {
		// Open Thread Dump
		dumpFile, err := dumpHeader.Open()
		if err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Failed to open dump %s: %v", dumpHeader.Filename, err))
			continue
		}

		// Open corresponding Usage File if it exists
		var usageFile multipart.File
		if i < len(usageHeaders) {
			if uFile, err := usageHeaders[i].Open(); err == nil {
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
			errorMessages = append(errorMessages, fmt.Sprintf("Failed to parse %s: %v", dumpHeader.Filename, err))
			continue
		}

		// Enrichment with Regex Matching - Categorizes threads into pools based on YAML config.
		enricher.Enrich(threads)

		// Analysis of Rules Engine
		// Check if usage data was provided for CPU inference logic
		usageDataProvided := (usageFile != nil && err == nil)
		if err := eng.AnalyzeThreads(threads, usageDataProvided); err != nil {
			// Log rule engine errors but continue processing other files.
			log.Printf("Rule engine error on file %s: %v", dumpHeader.Filename, err)
			errorMessages = append(errorMessages, fmt.Sprintf("Rule analysis failed for %s: %v", dumpHeader.Filename, err))
		}

		// Collect processed data for later aggregation
		parsedFiles = append(parsedFiles, analyzer.ParsedFile{
			FileName: dumpHeader.Filename,
			Threads:  threads,
		})
	}

	// Aggregation - Pivots data from a file-centric view to a thread-centric history view.
	aggregatedThreads := analyzer.AggregateThreads(parsedFiles)

	// Construct Final Response Object
	response := AggregatedAnalysisResponse{
		SessionID: uuid.New().String(),
		Timestamp: time.Now().Format(time.RFC3339),
		Threads:   aggregatedThreads,
		Errors:    errorMessages,
	}

	// Send JSON Response
	w.Header().Set("Content-Type", "application/json")
	// Use an Encoder to stream the JSON response directly to the HTTP writer
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
			<form action="/parse" method="post" enctype="multipart/form-data">
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
