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
	"fmt"
	"math"
	"sort"
)

// One named penalty that lowered the health score; penalties sum to (100 - score).
type HealthFactor struct {
	Label   string `json:"label"`
	Penalty int    `json:"penalty"`
}

// Penalty weights / caps: state penalties are share-based, critical-risk is count-based so one acute thread still moves the needle.
const (
	blockedWeight      = 50.0
	waitingWeight      = 15.0
	timedWaitingWeight = 5.0
	criticalPerThread  = 12
	criticalCap        = 45
	growthDivisor      = 2.0
	growthCap          = 15
)

// ComputeHealth derives a deterministic 0-100 health score from the latest dump's threads, plus the named penalties behind it.
// Latest/previous dump are chosen by natural-sorting dump file names, mirroring the frontend so the rendered score matches.
func ComputeHealth(threads []AnalyzedThread) (int, []HealthFactor) {
	names := dumpNamesSorted(threads)
	if len(names) == 0 {
		return 100, nil
	}
	latest := names[len(names)-1]

	var total, blocked, waiting, timedWaiting, critical int
	for _, t := range threads {
		for _, s := range t.Snapshots {
			if s.FileName != latest {
				continue
			}
			total++
			switch s.State {
			case "BLOCKED":
				blocked++
			case "WAITING":
				waiting++
			case "TIMED_WAITING":
				timedWaiting++
			}
			if s.RiskLevel == "CRITICAL" {
				critical++
			}
		}
	}
	if total == 0 {
		return 100, nil
	}

	growthPct := threadGrowthPct(threads, names, total)

	f := float64(total)
	blockedPen := int(math.Round(float64(blocked) / f * blockedWeight))
	waitingPen := int(math.Round(float64(waiting) / f * waitingWeight))
	timedPen := int(math.Round(float64(timedWaiting) / f * timedWaitingWeight))
	criticalPen := min(critical*criticalPerThread, criticalCap)
	growthPen := 0
	if growthPct > 0 {
		growthPen = min(int(math.Round(growthPct/growthDivisor)), growthCap)
	}

	var factors []HealthFactor
	remaining := 100
	add := func(label string, penalty int) {
		if penalty <= 0 || remaining == 0 {
			return
		}
		applied := min(penalty, remaining)
		factors = append(factors, HealthFactor{Label: label, Penalty: applied})
		remaining -= applied
	}
	add(fmt.Sprintf("%d blocked threads", blocked), blockedPen)
	add(fmt.Sprintf("%d threads waiting", waiting), waitingPen)
	add(fmt.Sprintf("%d threads timed-waiting", timedWaiting), timedPen)
	add(fmt.Sprintf("%d critical-risk threads", critical), criticalPen)
	if growthPen > 0 {
		add(fmt.Sprintf("Thread count grew %.0f%%", growthPct), growthPen)
	}

	return remaining, factors
}

// threadGrowthPct returns the percentage change in thread count from the previous dump to the latest; 0 when there is no prior dump.
func threadGrowthPct(threads []AnalyzedThread, sortedNames []string, latestCount int) float64 {
	if len(sortedNames) < 2 {
		return 0
	}
	prev := sortedNames[len(sortedNames)-2]
	prevCount := 0
	for _, t := range threads {
		for _, s := range t.Snapshots {
			if s.FileName == prev {
				prevCount++
				break
			}
		}
	}
	if prevCount == 0 {
		return 0
	}
	return float64(latestCount-prevCount) / float64(prevCount) * 100
}

// dumpNamesSorted returns the unique dump file names in natural (numeric-aware) order, so dump_2 sorts before dump_10.
func dumpNamesSorted(threads []AnalyzedThread) []string {
	seen := map[string]struct{}{}
	for _, t := range threads {
		for _, s := range t.Snapshots {
			seen[s.FileName] = struct{}{}
		}
	}
	names := make([]string, 0, len(seen))
	for n := range seen {
		names = append(names, n)
	}
	sort.Slice(names, func(i, j int) bool { return naturalLess(names[i], names[j]) })
	return names
}

// naturalLess compares two strings treating embedded digit runs as numbers, matching the frontend's localeCompare({ numeric: true }).
func naturalLess(a, b string) bool {
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		ai, bj := a[i], b[j]
		if isDigit(ai) && isDigit(bj) {
			si, sj := i, j
			for i < len(a) && isDigit(a[i]) {
				i++
			}
			for j < len(b) && isDigit(b[j]) {
				j++
			}
			na, nb := trimLeadingZeros(a[si:i]), trimLeadingZeros(b[sj:j])
			if len(na) != len(nb) {
				return len(na) < len(nb)
			}
			if na != nb {
				return na < nb
			}
			continue
		}
		if ai != bj {
			return ai < bj
		}
		i++
		j++
	}
	return len(a)-i < len(b)-j
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func trimLeadingZeros(s string) string {
	k := 0
	for k < len(s)-1 && s[k] == '0' {
		k++
	}
	return s[k:]
}
