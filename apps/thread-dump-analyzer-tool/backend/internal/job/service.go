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

package job

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/ai"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"
)

// AggregatedAnalysisResponse is the top-level JSON response format for a structured analysis.
type AggregatedAnalysisResponse struct {
	SessionID      string                       `json:"session_id"`
	Timestamp      string                       `json:"timestamp"`
	Threads        []analyzer.AnalyzedThread    `json:"threads"`
	ThreadPools    map[string]analyzer.PoolInfo `json:"thread_pools,omitempty"`
	HealthScore    int                          `json:"health_score"`
	HealthFactors  []analyzer.HealthFactor      `json:"health_factors,omitempty"`
	PatternMatches []analyzer.PatternMatch      `json:"pattern_matches,omitempty"`
	AIInsights     *ai.AIInsights               `json:"ai_insights,omitempty"`
	Errors         []string                     `json:"errors,omitempty"`
}

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

func NewJobStore(cfg *config.Config) *JobStore {
	s := &JobStore{
		jobs:        make(map[string]*Job),
		ttl:         cfg.JobTTL,
		maxSize:     cfg.JobStoreMaxSize,
		janitorTick: cfg.JobJanitorTick,
	}
	go s.janitor()
	return s
}

// janitor periodically evicts terminal jobs older than ttl and trims the store to maxSize for the process lifetime.
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

// JobLimiter caps in-flight analysis jobs via a counting semaphore so an upload burst cannot exhaust memory or goroutines.
type JobLimiter struct {
	sem chan struct{}
}

func NewJobLimiter(max int) *JobLimiter {
	if max <= 0 {
		max = 1
	}
	return &JobLimiter{sem: make(chan struct{}, max)}
}

func (l *JobLimiter) TryAcquire() bool {
	select {
	case l.sem <- struct{}{}:
		return true
	default:
		return false
	}
}

// Release frees one slot; defensive non-blocking receive guards against double-release bugs.
func (l *JobLimiter) Release() {
	select {
	case <-l.sem:
	default:
	}
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

// FilePayload holds an uploaded file fully buffered in memory so analysis can continue after the HTTP request has returned.
type FilePayload struct {
	FileName string
	Data     []byte
}

type analysisResult struct {
	resp  *AggregatedAnalysisResponse
	err   error
	rec   any
	stack []byte
}

// Indirection seam so tests can swap runAnalysis for a blocking stub to drive the timeout path deterministically.
var runAnalysisFn = runAnalysis

// RunJob drives one analysis under a deadline; the inner sub-goroutine respects ctx at phase boundaries and a buffered done channel keeps it leak-free.
func RunJob(jobID string, dumps, usages []FilePayload, store *JobStore, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher, jobTimeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), jobTimeout)
	defer cancel()

	store.Update(jobID, func(j *Job) { j.Status = JobRunning })

	done := make(chan analysisResult, 1)
	go func() {
		var resp *AggregatedAnalysisResponse
		var err error
		var rec any
		var stack []byte
		defer func() {
			if r := recover(); r != nil {
				rec = r
				stack = debug.Stack()
			}
			done <- analysisResult{resp: resp, err: err, rec: rec, stack: stack}
		}()
		resp, err = runAnalysisFn(ctx, dumps, usages, eng, enricher)
	}()

	select {
	case r := <-done:
		if r.rec != nil {
			slog.Error("analysis panicked", "job_id", jobID, "panic", fmt.Sprintf("%v", r.rec), "stack", string(r.stack))
			store.Update(jobID, func(j *Job) {
				j.Status = JobFailed
				j.Error = fmt.Sprintf("internal error (ref=%s)", jobID)
			})
			return
		}
		if ctx.Err() != nil {
			store.Update(jobID, func(j *Job) {
				j.Status = JobFailed
				j.Error = fmt.Sprintf("analysis timed out after %s", jobTimeout)
			})
			return
		}
		if r.err != nil {
			slog.Info("analysis rejected invalid upload", "job_id", jobID, "error", r.err)
			store.Update(jobID, func(j *Job) {
				j.Status = JobFailed
				j.Error = r.err.Error()
			})
			return
		}
		store.Update(jobID, func(j *Job) {
			j.Status = JobCompleted
			j.Result = r.resp
		})
	case <-ctx.Done():
		store.Update(jobID, func(j *Job) {
			j.Status = JobFailed
			j.Error = fmt.Sprintf("analysis timed out after %s", jobTimeout)
		})
	}
}

// Holds phase 1 output (parse/correlate/enrich) so phase 2 runs serially with GlobalStats carry-over.
type preppedFile struct {
	fileName          string
	threads           []parser.Thread
	usageDataProvided bool
}

// validationError carries a user-facing message for unanalyzable uploads; RunJob surfaces it as the job error.
type validationError struct{ msg string }

func (e *validationError) Error() string { return e.msg }

// runAnalysis is a two-phase pipeline: phase 1 (parallel parse/correlate/enrich) feeds phase 2 (serial rules with temporal state carry-over).
func runAnalysis(ctx context.Context, dumps, usages []FilePayload, eng *analyzer.RuleEngine, enricher *analyzer.ThreadEnricher) (*AggregatedAnalysisResponse, error) {
	prepped := make([]*preppedFile, len(dumps))
	errSlots := make([][]string, len(dumps))
	invalidSlots := make([]string, len(dumps)) // fatal per-file validation message; any non-empty entry fails the job
	var wg sync.WaitGroup

	// Phase 1: parallel parse/correlate/enrich indexed by upload order.
	for i, dump := range dumps {
		wg.Add(1)
		go func(index int, d FilePayload) {
			defer wg.Done()

			if ctx.Err() != nil {
				return
			}

			var usageReader io.Reader
			if index < len(usages) {
				u := usages[index]
				// Validate usage file by parsing; treat parse error or empty result the same (invalid).
				parsed, usageDiags, _ := parser.ParseThreadUsage(bytes.NewReader(u.Data))
				if len(parsed) == 0 {
					msg := fmt.Sprintf("Invalid thread usage file: no valid CPU usage data found in %q", u.FileName)
					if len(usageDiags) > 0 {
						msg += " (" + strings.Join(usageDiags, "; ") + ")"
					}
					invalidSlots[index] = msg
					return
				}
				usageReader = bytes.NewReader(u.Data)
			}

			threads, diagnostics, err := parser.ProcessAndCorrelate(bytes.NewReader(d.Data), usageReader, d.FileName)
			if err != nil {
				invalidSlots[index] = fmt.Sprintf("Failed to parse %q: %v", d.FileName, err)
				return
			}
			if len(threads) == 0 {
				invalidSlots[index] = fmt.Sprintf("Invalid file: no Java threads found in %q. Is it a Java thread dump?", d.FileName)
				return
			}

			errSlots[index] = append(errSlots[index], diagnostics...)
			enricher.Enrich(ctx, threads)

			prepped[index] = &preppedFile{
				fileName:          d.FileName,
				threads:           threads,
				usageDataProvided: usageReader != nil,
			}
		}(i, dump)
	}

	wg.Wait()

	// Fail fast: if any uploaded dump or usage file was invalid, abort before pools/rules/AI.
	if ctx.Err() == nil {
		var invalid []string
		for _, m := range invalidSlots {
			if m != "" {
				invalid = append(invalid, m)
			}
		}
		if len(invalid) > 0 {
			return nil, &validationError{strings.Join(invalid, "; ")}
		}
	}

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
		if ctx.Err() != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Rule analysis skipped for %s: %v", p.fileName, ctx.Err()))
			continue
		}

		stats, err := eng.AnalyzeThreads(ctx, p.threads, p.usageDataProvided, prevBlockedPct, prevTotalThreads)
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
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
	healthScore, healthFactors := analyzer.ComputeHealth(aggregatedThreads)

	var aiInsights *ai.AIInsights
	if ctx.Err() == nil {
		usageUploaded := len(usages) > 0
		var err error
		aiInsights, err = ai.GetInsights(ctx, aggregatedThreads, usageUploaded)
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
			errorMessages = append(errorMessages, fmt.Sprintf("AI insights unavailable: %v", err))
		}
	}

	return &AggregatedAnalysisResponse{
		SessionID:      uuid.New().String(),
		Timestamp:      time.Now().Format(time.RFC3339),
		Threads:        aggregatedThreads,
		ThreadPools:    enricher.PoolMetadata(),
		HealthScore:    healthScore,
		HealthFactors:  healthFactors,
		PatternMatches: patternMatches,
		AIInsights:     aiInsights,
		Errors:         errorMessages,
	}, nil
}
