// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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
	Name             string   `yaml:"name"`
	Patterns         []string `yaml:"patterns"`
	Description      string   `yaml:"description"`
	ExpectedBehavior string   `yaml:"expected_behavior"`
}

type threadPoolsConfig struct {
	Pools []poolConfig `yaml:"pools"`
}

/* Runtime Structure Logic*/

// PoolInfo holds exported metadata for a thread pool
type PoolInfo struct {
	Description      string `json:"description"`
	ExpectedBehavior string `json:"expected_behavior"`
}

// Pre-compiled regexes for performance
type compiledPool struct {
	Name             string
	Description      string
	ExpectedBehavior string
	RegExps          []*regexp.Regexp
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
		cp := compiledPool{Name: poolCfg.Name, Description: poolCfg.Description, ExpectedBehavior: poolCfg.ExpectedBehavior}
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
					t.ThreadPool = "Standalone/ Ungrouped Threads"
				}
			}
		}(threads[start:end])
	}

	wg.Wait()
}

// PoolMetadata returns a map of pool name to its description and expected behavior.
func (te *ThreadEnricher) PoolMetadata() map[string]PoolInfo {
	result := make(map[string]PoolInfo, len(te.compiledPools))
	for _, cp := range te.compiledPools {
		result[cp.Name] = PoolInfo{
			Description:      cp.Description,
			ExpectedBehavior: cp.ExpectedBehavior,
		}
	}
	return result
}
