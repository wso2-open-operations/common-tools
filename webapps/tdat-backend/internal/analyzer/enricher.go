package analyzer

import (
	"fmt"
	"os"
	"regexp"
	"runtime"
	"sync"
	"tdat-backend/internal/parser"

	"gopkg.in/yaml.v3"
)

/* YAML Configuration Structures */

type poolConfig struct {
	Name     string   `yaml:"name"`
	Patterns []string `yaml:"patterns"`
}

type threadPoolsConfig struct {
	Pools []poolConfig `yaml:"pools"`
}

/* Runtime Structure Logic*/

// Pre-compiled regexes for performance
type compiledPool struct {
	Name    string
	RegExps []*regexp.Regexp
}

// ThreadEnricher handles loading config and applying matches
type ThreadEnricher struct {
	compiledPools []compiledPool
}

// NewThreadEnricher function loads the rules and compiles regexes
func NewThreadEnricher(configPath string) (*ThreadEnricher, error) {
	// Read rules file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file '%s': %w", configPath, err)
	}

	// Unmarshal into structs
	var config threadPoolsConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// Compile regexes
	var compiledPools []compiledPool
	for _, poolCfg := range config.Pools {
		cp := compiledPool{Name: poolCfg.Name}
		for _, pattern := range poolCfg.Patterns {
			re, err := regexp.Compile(pattern)
			if err != nil {
				return nil, fmt.Errorf("invalid regex '%s' for pool '%s': %w", pattern, poolCfg.Name, err)
			}
			cp.RegExps = append(cp.RegExps, re)
		}
		compiledPools = append(compiledPools, cp)
	}

	return &ThreadEnricher{
		compiledPools: compiledPools,
	}, nil
}

// Enrich iterates through threads and categorizes them in-place.
func (te *ThreadEnricher) Enrich(threads []parser.Thread) {
	numWorkers := runtime.NumCPU()
	if numWorkers > len(threads) {
		numWorkers = len(threads)
	}

	if numWorkers == 0 {
		return
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
		go func(threadChunk []parser.Thread) {
			defer wg.Done()

			for j := range threadChunk {
				t := &threadChunk[j]
				matched := false

				for _, pool := range te.compiledPools {
					for _, re := range pool.RegExps {
						if re.MatchString(t.Name) {
							t.ThreadPool = pool.Name
							matched = true
							break
						}
					}
					if matched {
						break
					}
				}

				if !matched {
					t.ThreadPool = "Standalone Threads"
				}
			}
		}(threads[start:end])
	}

	wg.Wait()
}
