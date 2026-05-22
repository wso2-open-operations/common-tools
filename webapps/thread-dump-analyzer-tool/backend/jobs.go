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
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sort"
	"sync"
	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/ai"
	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/parser"
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

// Job represents one asynchronous analysis request.
// Result is populated once Status is JobCompleted; Error is populated on JobFailed.
type Job struct {
	ID        string                      `json:"job_id"`
	Status    JobStatus                   `json:"status"`
	CreatedAt time.Time                   `json:"created_at"`
	UpdatedAt time.Time                   `json:"updated_at"`
	Result    *AggregatedAnalysisResponse `json:"result,omitempty"`
	Error     string                      `json:"error,omitempty"`
}

// JobStore is a process-local, in-memory job registry safe for concurrent use.
// Retention config (ttl/maxSize/janitorTick) is captured per-store at construction.
type JobStore struct {
	mu          sync.RWMutex
	jobs        map[string]*Job
	ttl         time.Duration
	maxSize     int
	janitorTick time.Duration
}

func NewJobStore(cfg *Config) *JobStore {
	s := &JobStore{
		jobs:        make(map[string]*Job),
		ttl:         cfg.JobTTL,
		maxSize:     cfg.JobStoreMaxSize,
		janitorTick: cfg.JobJanitorTick,
	}
	go s.janitor()
	return s
}

// janitor periodically evicts terminal jobs older than ttl and trims the store
// to maxSize. Runs for the lifetime of the process.
func (s *JobStore) janitor() {
	ticker := time.NewTicker(s.janitorTick)
	defer ticker.Stop()
	for range ticker.C {
		s.evict()
	}
}

// evict removes expired terminal jobs and trims the store to maxSize.
// Pending/running jobs are never evicted.
func (s *JobStore) evict() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-s.ttl)
	for id, j := range s.jobs {
		if isTerminal(j.Status) && j.UpdatedAt.Before(cutoff) {
			delete(s.jobs, id)
		}
	}

	if len(s.jobs) <= s.maxSize {
		return
	}

	type entry struct {
		id string
		ts time.Time
	}
	terminal := make([]entry, 0, len(s.jobs))
	for id, j := range s.jobs {
		if isTerminal(j.Status) {
			terminal = append(terminal, entry{id, j.UpdatedAt})
		}
	}
	sort.Slice(terminal, func(i, j int) bool { return terminal[i].ts.Before(terminal[j].ts) })

	excess := len(s.jobs) - s.maxSize
	for i := 0; i < excess && i < len(terminal); i++ {
		delete(s.jobs, terminal[i].id)
	}
}

func isTerminal(s JobStatus) bool {
	return s == JobCompleted || s == JobFailed
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
	if !ok {
		return nil, false
	}
	// Copy under read lock to prevent mutation of returned job after lock release.
	snapshot := *j
	return &snapshot, true
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

// filePayload holds an uploaded file fully buffered in memory so analysis can continue after the HTTP request has returned.
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

func analyzeJobsHandler(w http.ResponseWriter, r *http.Request, store *JobStore, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher, maxUploadBytes int64) {
	// Cap body size so ParseMultipartForm keeps file parts in RAM, not $TMPDIR.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, fmt.Sprintf("Files too large. Limit is %d MiB.", maxUploadBytes>>20), http.StatusBadRequest)
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
	json.NewEncoder(w).Encode(map[string]string{"job_id": job.ID})
}

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
	json.NewEncoder(w).Encode(job)
}

// Holds phase 1 output (parse/correlate/enrich) so phase 2 runs serially with GlobalStats carry-over.
type preppedFile struct {
	fileName          string
	threads           []parser.Thread
	usageDataProvided bool
}

// Two-phase pipeline: phase 1 (parallel parse/correlate/enrich) feeds phase 2 (serial rules with temporal state carry-over).
func runAnalysis(dumps, usages []filePayload, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) *AggregatedAnalysisResponse {
	prepped := make([]*preppedFile, len(dumps))
	errSlots := make([][]string, len(dumps))
	var wg sync.WaitGroup

	// Phase 1: parallel parse/correlate/enrich indexed by upload order.
	for i, dump := range dumps {
		wg.Add(1)
		go func(index int, d filePayload) {
			defer wg.Done()

			var usageReader io.Reader
			if index < len(usages) {
				u := usages[index]
				// Validate usage file by parsing; treat parse error or empty result the same (invalid).
				parsed, _ := parser.ParseThreadUsage(bytes.NewReader(u.Data))
				if len(parsed) == 0 {
					errSlots[index] = append(errSlots[index], fmt.Sprintf("Invalid file. No valid thread usage data found in %s", u.FileName))
					return
				}
				usageReader = bytes.NewReader(u.Data)
			}

			threads, diagnostics, err := parser.ProcessAndCorrelate(bytes.NewReader(d.Data), usageReader, d.FileName)
			if err != nil {
				errSlots[index] = append(errSlots[index], fmt.Sprintf("Failed to parse %s: %v", d.FileName, err))
				return
			}
			errSlots[index] = append(errSlots[index], diagnostics...)

			if len(threads) == 0 {
				errSlots[index] = append(errSlots[index], fmt.Sprintf("Invalid Files. No threads found in %s", d.FileName))
				return
			}

			enricher.Enrich(threads)

			prepped[index] = &preppedFile{
				fileName:          d.FileName,
				threads:           threads,
				usageDataProvided: usageReader != nil,
			}
		}(i, dump)
	}

	wg.Wait()

	var parsedFiles []analyzer.ParsedFile
	var errorMessages []string
	prevBlockedPct := 0.0
	prevTotalThreads := 0

	// Phase 2: serial, ordered rule engine execution with temporal state carry-over.
	for i := range prepped {
		errorMessages = append(errorMessages, errSlots[i]...)
		p := prepped[i]
		if p == nil {
			continue
		}

		stats, err := eng.AnalyzeThreads(p.threads, p.usageDataProvided, prevBlockedPct, prevTotalThreads)
		if err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Rule analysis failed for %s: %v", p.fileName, err))
		}
		if stats != nil {
			prevBlockedPct = stats.BlockedPercentage
			prevTotalThreads = stats.TotalThreads
		}

		parsedFiles = append(parsedFiles, analyzer.ParsedFile{
			FileName: p.fileName,
			Threads:  p.threads,
		})
	}

	aggregatedThreads := analyzer.AggregateThreads(parsedFiles)
	patternMatches := analyzer.ComputePatternMatches(aggregatedThreads)

	usageUploaded := len(usages) > 0
	aiInsights, err := ai.GetInsights(aggregatedThreads, usageUploaded)
	if err != nil {
		msg := fmt.Sprintf("AI insights unavailable: %v", err)
		errorMessages = append(errorMessages, msg)
	}

	return &AggregatedAnalysisResponse{
		SessionID:      uuid.New().String(),
		Timestamp:      time.Now().Format(time.RFC3339),
		Threads:        aggregatedThreads,
		ThreadPools:    enricher.PoolMetadata(),
		PatternMatches: patternMatches,
		AIInsights:     aiInsights,
		Errors:         errorMessages,
	}
}
