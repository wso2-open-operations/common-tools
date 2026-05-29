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

package analyzer

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/parser"

	"github.com/hyperjumptech/grule-rule-engine/ast"
	"github.com/hyperjumptech/grule-rule-engine/builder"
	"github.com/hyperjumptech/grule-rule-engine/engine"
	"github.com/hyperjumptech/grule-rule-engine/pkg"
)

type RuleEngine struct {
	KnowledgeLibrary *ast.KnowledgeLibrary
}

// NewEngine initializes Grule and loads the GRL file
func NewEngine(ruleFilePath string) (*RuleEngine, error) {
	lib := ast.NewKnowledgeLibrary()
	ruleBuilder := builder.NewRuleBuilder(lib)

	err := ruleBuilder.BuildRuleFromResource("ThreadRules", "0.0.1", pkg.NewFileResource(ruleFilePath))
	if err != nil {
		return nil, err
	}

	return &RuleEngine{
		KnowledgeLibrary: lib,
	}, nil
}

// Applies rules concurrently with prev metrics for temporal rules; honors ctx between threads.
// Caller should pass the returned GlobalStats as prev values on next invocation.
func (e *RuleEngine) AnalyzeThreads(ctx context.Context, threads []parser.Thread, usageDataProvided bool, prevBlockedPct float64, prevTotalThreads int) (*parser.GlobalStats, error) {

	if !usageDataProvided {
		for i := range threads {
			t := &threads[i]
			elapsedMs := t.ElapsedTime * 1000.0
			if elapsedMs > 0 && t.CPUTime > 0 {
				t.CPUPercentage = (t.CPUTime / elapsedMs) * 100.0
			} else {
				t.CPUPercentage = 0.0
			}
		}
	}

	// Calculate Global State
	stats := &parser.GlobalStats{
		TotalThreads:              len(threads),
		IsUsageDataProvided:       usageDataProvided,
		PreviousBlockedPercentage: prevBlockedPct,
	}
	blockedCount := 0
	for _, t := range threads {
		if t.State == "BLOCKED" {
			blockedCount++
		}
	}
	if len(threads) > 0 {
		stats.BlockedPercentage = (float64(blockedCount) / float64(len(threads))) * 100.0
	}
	if prevTotalThreads > 0 {
		stats.ThreadCountGrowth = (float64(len(threads)-prevTotalThreads) / float64(prevTotalThreads)) * 100.0
	}

	// Compute lock contention counts: how many threads are waiting for each monitor address
	lockAddrCount := map[string]int{}
	for _, t := range threads {
		if t.WaitingToLockAddress != "" {
			lockAddrCount[t.WaitingToLockAddress]++
		}
	}
	for i := range threads {
		if threads[i].WaitingToLockAddress != "" {
			threads[i].LockContentionCount = lockAddrCount[threads[i].WaitingToLockAddress]
		}
	}

	// Count system-wide JDBC stalls so DatabaseWait can require a minimum share before firing HIGH.
	for _, t := range threads {
		if t.ElapsedTime > 5.0 && (t.HasInStackTrace("java.sql") || t.HasInStackTrace("Hibernate") || t.HasInStackTrace("jdbc")) {
			stats.JDBCStallCount++
		}
	}

	// Thread level Concurrency Setup
	numWorkers := runtime.NumCPU()
	if numWorkers > len(threads) {
		numWorkers = len(threads)
	}
	if numWorkers == 0 {
		return stats, nil
	}

	chunkSize := (len(threads) + numWorkers - 1) / numWorkers
	var wg sync.WaitGroup
	var firstErrOnce sync.Once
	var firstErr error
	captureErr := func(err error) {
		firstErrOnce.Do(func() { firstErr = err })
	}

	for i := 0; i < numWorkers; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if start >= len(threads) {
			break
		}
		if end > len(threads) {
			end = len(threads)
		}

		wg.Add(1)

		// Launch a worker for this specific chunk
		go func(threadChunk []parser.Thread) {
			defer wg.Done()

			// One engine + one KB clone per worker — Grule's Execute() resets WorkingMemory and rule flags on every call.
			workerEngine := engine.NewGruleEngine()
			kb, err := e.KnowledgeLibrary.NewKnowledgeBaseInstance("ThreadRules", "0.0.1")
			if err != nil {
				captureErr(fmt.Errorf("knowledge base instance for worker chunk: %w", err))
				return
			}

			for j := range threadChunk {
				if err := ctx.Err(); err != nil {
					captureErr(err)
					return
				}
				t := &threadChunk[j]

				dataCtx := ast.NewDataContext()
				if err := dataCtx.Add("t", t); err != nil {
					captureErr(fmt.Errorf("add 't' to data context for thread %s: %w", t.Name, err))
					continue
				}
				if err := dataCtx.Add("global", stats); err != nil {
					captureErr(fmt.Errorf("add 'global' to data context for thread %s: %w", t.Name, err))
					continue
				}

				if err := workerEngine.Execute(dataCtx, kb); err != nil {
					captureErr(fmt.Errorf("rule execution for thread %s: %w", t.Name, err))
				}
			}
		}(threads[start:end])
	}

	// Wait for all chunks to finish
	wg.Wait()

	return stats, firstErr
}
