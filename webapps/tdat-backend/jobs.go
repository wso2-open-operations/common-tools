package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"sync"
	"tdat-backend/internal/ai"
	"tdat-backend/internal/analyzer"
	"tdat-backend/internal/parser"
	"time"

	"github.com/google/uuid"
)

type JobStatus string

const (
	JobPending   JobStatus = "pending"
	JobRunning   JobStatus = "running"
	JobCompleted JobStatus = "completed"
	JobFailed    JobStatus = "failed"
)

// Job represents one asynchronous analysis request. Result is populated once Status is
// JobCompleted; Error is populated on JobFailed.
type Job struct {
	ID        string                      `json:"job_id"`
	Status    JobStatus                   `json:"status"`
	CreatedAt time.Time                   `json:"created_at"`
	UpdatedAt time.Time                   `json:"updated_at"`
	Result    *AggregatedAnalysisResponse `json:"result,omitempty"`
	Error     string                      `json:"error,omitempty"`
}

// JobStore is a process-local, in-memory job registry safe for concurrent use.
type JobStore struct {
	mu   sync.RWMutex
	jobs map[string]*Job
}

func NewJobStore() *JobStore {
	return &JobStore{jobs: make(map[string]*Job)}
}

func (s *JobStore) Create() *Job {
	now := time.Now()
	j := &Job{
		ID:        uuid.New().String(),
		Status:    JobPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.mu.Lock()
	s.jobs[j.ID] = j
	s.mu.Unlock()
	return j
}

func (s *JobStore) Get(id string) (*Job, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	j, ok := s.jobs[id]
	return j, ok
}

// Update atomically mutates a job under the store's write lock.
func (s *JobStore) Update(id string, fn func(*Job)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if j, ok := s.jobs[id]; ok {
		fn(j)
		j.UpdatedAt = time.Now()
	}
}

// filePayload holds an uploaded file fully buffered in memory so analysis can
// continue after the HTTP request has returned.
type filePayload struct {
	FileName string
	Data     []byte
}

func readMultipartFiles(headers []*multipart.FileHeader) ([]filePayload, error) {
	out := make([]filePayload, 0, len(headers))
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
		out = append(out, filePayload{FileName: h.Filename, Data: data})
	}
	return out, nil
}

// analyzeJobsHandler buffers the uploaded files, registers a Job, kicks off the
// analysis in a background goroutine, and returns the job id immediately.
func analyzeJobsHandler(w http.ResponseWriter, r *http.Request, store *JobStore, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) {
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, "Files too large. Limit is 100MB.", http.StatusBadRequest)
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
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	usages, err := readMultipartFiles(usageHeaders)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	job := store.Create()

	go func(jobID string) {
		store.Update(jobID, func(j *Job) { j.Status = JobRunning })

		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("job %s panicked: %v", jobID, rec)
				store.Update(jobID, func(j *Job) {
					j.Status = JobFailed
					j.Error = fmt.Sprintf("internal error: %v", rec)
				})
			}
		}()

		result := runAnalysis(dumps, usages, eng, enricher)
		store.Update(jobID, func(j *Job) {
			j.Status = JobCompleted
			j.Result = result
		})
	}(job.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	if err := json.NewEncoder(w).Encode(map[string]string{"job_id": job.ID}); err != nil {
		log.Printf("Failed to encode job_id response: %v", err)
	}
}

// jobStatusHandler returns the current Job record, including Result once the
// job is completed.
func jobStatusHandler(w http.ResponseWriter, r *http.Request, store *JobStore) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	job, ok := store.Get(id)
	if !ok {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(job); err != nil {
		log.Printf("Failed to encode job response: %v", err)
	}
}

// runAnalysis runs the full parsing/enrichment/Grule/AI pipeline over
// already-buffered file payloads and returns the aggregated response.
func runAnalysis(dumps, usages []filePayload, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) *AggregatedAnalysisResponse {
	var parsedFiles []analyzer.ParsedFile
	var errorMessages []string
	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, dump := range dumps {
		wg.Add(1)
		go func(index int, d filePayload) {
			defer wg.Done()

			var usageReader io.Reader
			if index < len(usages) {
				u := usages[index]
				parsed, _ := parser.ParseThreadUsage(bytes.NewReader(u.Data))
				if len(parsed) == 0 {
					mu.Lock()
					errorMessages = append(errorMessages, fmt.Sprintf("Invalid file. No valid thread usage data found in %s", u.FileName))
					mu.Unlock()
					return
				}
				usageReader = bytes.NewReader(u.Data)
			}

			threads, err := parser.ProcessAndCorrelate(bytes.NewReader(d.Data), usageReader)
			if err != nil {
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Failed to parse %s: %v", d.FileName, err))
				mu.Unlock()
				return
			}

			if len(threads) == 0 {
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Invalid Files. No threads found in %s", d.FileName))
				mu.Unlock()
				return
			}

			enricher.Enrich(threads)

			usageDataProvided := (usageReader != nil)
			if err := eng.AnalyzeThreads(threads, usageDataProvided); err != nil {
				log.Printf("Rule engine error on file %s: %v", d.FileName, err)
				mu.Lock()
				errorMessages = append(errorMessages, fmt.Sprintf("Rule analysis failed for %s: %v", d.FileName, err))
				mu.Unlock()
			}

			mu.Lock()
			parsedFiles = append(parsedFiles, analyzer.ParsedFile{
				FileName: d.FileName,
				Threads:  threads,
			})
			mu.Unlock()
		}(i, dump)
	}

	wg.Wait()

	aggregatedThreads := analyzer.AggregateThreads(parsedFiles)

	usageUploaded := len(usages) > 0
	aiInsights, err := ai.GetInsights(aggregatedThreads, usageUploaded)
	if err != nil {
		log.Printf("AI insights error: %v", err)
		errorMessages = append(errorMessages, fmt.Sprintf("AI insights unavailable: %v", err))
	}

	return &AggregatedAnalysisResponse{
		SessionID:   uuid.New().String(),
		Timestamp:   time.Now().Format(time.RFC3339),
		Threads:     aggregatedThreads,
		ThreadPools: enricher.PoolMetadata(),
		AIInsights:  aiInsights,
		Errors:      errorMessages,
	}
}
