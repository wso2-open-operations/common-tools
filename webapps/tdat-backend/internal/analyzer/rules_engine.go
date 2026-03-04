package analyzer

import (
	"runtime"
	"sync"
	"tdat-backend/internal/parser"

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

	// Load the rules from the file system
	err := ruleBuilder.BuildRuleFromResource("ThreadRules", "0.0.1", pkg.NewFileResource(ruleFilePath))
	if err != nil {
		return nil, err
	}

	return &RuleEngine{
		KnowledgeLibrary: lib,
	}, nil
}

// AnalyzeThreads applies the rules to a slice of threads concurrently
func (e *RuleEngine) AnalyzeThreads(threads []parser.Thread, usageDataProvided bool) error {

	// Preprocessing: CPU Usage Inference
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
		TotalThreads:        len(threads),
		IsUsageDataProvided: usageDataProvided,
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

	// Thread level Concurrency Setup
	numWorkers := runtime.NumCPU()
	if numWorkers > len(threads) {
		numWorkers = len(threads)
	}
	if numWorkers == 0 {
		return nil
	}

	chunkSize := (len(threads) + numWorkers - 1) / numWorkers
	var wg sync.WaitGroup

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

			for j := range threadChunk {
				t := &threadChunk[j]

				// Get a fresh KnowledgeBase clone so Retract() doesn't break other threads
				kb, _ := e.KnowledgeLibrary.NewKnowledgeBaseInstance("ThreadRules", "0.0.1")

				// Get a fresh Engine to prevent working memory accumulation
				workerEngine := engine.NewGruleEngine()

				dataCtx := ast.NewDataContext()
				_ = dataCtx.Add("t", t)
				_ = dataCtx.Add("global", stats)

				// Execute rules safely isolated from all other goroutines
				_ = workerEngine.Execute(dataCtx, kb)
			}
		}(threads[start:end])
	}

	// Wait for all chunks to finish
	wg.Wait()

	return nil
}
