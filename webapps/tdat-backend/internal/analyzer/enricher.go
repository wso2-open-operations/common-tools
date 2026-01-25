package analyzer

import (
	"fmt"
	"os"
	"regexp"
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
	for i := range threads {
		// Get pointer to modify thread in-place
		t := &threads[i]
		matched := false

		// Check against compiled pools
		for _, pool := range te.compiledPools {
			for _, re := range pool.RegExps {
				if re.MatchString(t.Name) {
					t.ThreadPool = pool.Name
					matched = true
					break // Stop regex loop for this pool
				}
			}
			if matched {
				break // Stop pool loop for this thread found match
			}
		}

		// If the threads don't match any defined threadpool
		if !matched {

			t.ThreadPool = "Standalone Thread"
		}
	}
}
