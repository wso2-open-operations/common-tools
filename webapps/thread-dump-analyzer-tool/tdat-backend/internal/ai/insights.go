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

package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"tdat-backend/internal/analyzer"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// AIInsights holds the three-section analysis produced by the AI model.
type AIInsights struct {
	ExecutiveSummary   string `json:"executive_summary"`
	KeyFindings        string `json:"pattern_recognition"`
	RecommendedActions string `json:"recommended_actions"`
}

// GetInsights calls the Anthropic API to produce a plain-English executive summary of the thread dumps.
// usageProvided indicates whether thread usage/CPU files were uploaded alongside the dumps.
func GetInsights(threads []analyzer.AnalyzedThread, usageProvided bool) (*AIInsights, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return &AIInsights{
			ExecutiveSummary:   "AI insights unavailable: no API key configured.",
			KeyFindings:        "Set the API Key to enable AI-powered analysis.",
			RecommendedActions: "Configure API key and re-analyze.",
		}, nil
	}

	if len(threads) == 0 {
		return nil, fmt.Errorf("no threads to summarize")
	}

	prompt := buildPrompt(threads, usageProvided)

	// Call Anthropic API
	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	// Using Claude 4.5
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeHaiku4_5_20251001,
		MaxTokens: 1024,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(prompt)),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Anthropic API error: %w", err)
	}

	if len(resp.Content) == 0 || resp.Content[0].Type != "text" {
		return nil, fmt.Errorf("empty response from Anthropic")
	}

	raw := strings.TrimSpace(resp.Content[0].Text)

	// Strip markdown code fences if present (Anthropic models sometimes wrap JSON in ```json ... ```)
	if strings.HasPrefix(raw, "```") {
		if idx := strings.Index(raw, "\n"); idx != -1 {
			raw = raw[idx+1:]
		}
		raw = strings.TrimSuffix(strings.TrimRight(raw, "\n"), "```")
		raw = strings.TrimSpace(raw)
	}

	var insights AIInsights
	if err := json.Unmarshal([]byte(raw), &insights); err != nil {
		return nil, fmt.Errorf("failed to parse JSON insights: %w (raw=%s)", err, raw)
	}

	log.Printf("AI insights generated — executive:%d patterns:%d recommendations:%d chars",
		len(insights.ExecutiveSummary), len(insights.KeyFindings), len(insights.RecommendedActions))

	return &insights, nil
}

// buildPrompt constructs the user message with a concise view of all threads.
func buildPrompt(threads []analyzer.AnalyzedThread, usageProvided bool) string {
	var sb strings.Builder

	// Count risk levels (worst per thread across snapshots).
	counts := map[string]int{"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "INFO": 0, "NORMAL": 0}
	for _, t := range threads {
		worst := "NORMAL"
		for _, s := range t.Snapshots {
			norm := normalizeRisk(s.RiskLevel)
			if riskRank(norm) < riskRank(worst) {
				worst = norm
			}
		}
		counts[worst]++
	}

	fmt.Fprintf(&sb, "Thread dump analysis summary:\n")
	fmt.Fprintf(&sb, "Total threads: %d | Critical: %d | High: %d | Medium: %d | Info: %d | Normal: %d\n",
		len(threads), counts["CRITICAL"], counts["HIGH"], counts["MEDIUM"], counts["INFO"], counts["NORMAL"])

	if usageProvided {
		fmt.Fprintf(&sb, "CPU/thread usage data: available\n")
	} else {
		fmt.Fprintf(&sb, "CPU/thread usage data: not provided\n")
	}
	fmt.Fprintf(&sb, "\n")

	// Build candidates: worst snapshot per thread, dropping low-signal levels.
	type candidate struct {
		thread   analyzer.AnalyzedThread
		snapshot analyzer.ThreadSnapshot
		rank     int
	}
	candidates := make([]candidate, 0, len(threads))
	for _, t := range threads {
		if len(t.Snapshots) == 0 {
			continue
		}
		worst := t.Snapshots[0]
		for _, s := range t.Snapshots[1:] {
			if riskRank(s.RiskLevel) < riskRank(worst.RiskLevel) {
				worst = s
			}
		}
		risk := normalizeRisk(worst.RiskLevel)
		if risk == "INFO" || risk == "NORMAL" {
			continue
		}
		candidates = append(candidates, candidate{thread: t, snapshot: worst, rank: riskRank(risk)})
	}

	// Highest severity first; stable so input order breaks ties.
	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].rank < candidates[j].rank
	})

	// Cap threads sent to avoid token limits.
	const maxThreads = 40
	if len(candidates) > maxThreads {
		candidates = candidates[:maxThreads]
	}

	for _, c := range candidates {
		t, worst := c.thread, c.snapshot
		fmt.Fprintf(&sb, "[%s] %q pool=%s state=%s", worst.RiskLevel, t.Name, t.ThreadPool, worst.State)
		if usageProvided && worst.CPUPercentage > 0 {
			fmt.Fprintf(&sb, " cpu=%.1f%%", worst.CPUPercentage)
		}
		if len(worst.Issues) > 0 {
			fmt.Fprintf(&sb, " issues=%s", strings.Join(worst.Issues, ","))
		}
		// Top 3 stack frames only
		frames := worst.StackTrace
		if len(frames) > 3 {
			frames = frames[:3]
		}
		if len(frames) > 0 {
			fmt.Fprintf(&sb, " stack=[%s]", strings.Join(frames, " | "))
		}
		fmt.Fprintf(&sb, "\n")
	}

	return sb.String()
}

func normalizeRisk(level string) string {
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "CRITICAL":
		return "CRITICAL"
	case "HIGH":
		return "HIGH"
	case "MEDIUM":
		return "MEDIUM"
	case "INFO":
		return "INFO"
	default:
		return "NORMAL"
	}
}

// Lower rank = higher severity (critical=0, normal=4)
func riskRank(level string) int {
	switch normalizeRisk(level) {
	case "CRITICAL":
		return 0
	case "HIGH":
		return 1
	case "MEDIUM":
		return 2
	case "INFO":
		return 3
	default:
		return 4
	}
}

const systemPrompt = `You are an expert WSO2 / Java Performance Engineer reviewing thread dumps for products like WSO2 IS, APIM, and ESB.

You MUST respond with a single valid JSON object and nothing else. No prose, no markdown code fences, no commentary outside the JSON. The JSON object must have EXACTLY these three string keys:

{
  "executive_summary": "...",
  "pattern_recognition": "...",
  "recommended_actions": "..."
}

Content requirements for each key (values are plain strings; use "\n" for line breaks and "-" / "1." markers inside the string for bullet/numbered lists):

executive_summary:
  3-5 concise sentences on overall JVM health. Explicitly state:
  - If a Java-level deadlock was detected.
  - If there is severe thread pool saturation (e.g., Tomcat HTTP workers or PassThrough message processors).
  - The overall severity (Critical, Warning, Normal).

pattern_recognition:
  A bulleted list (using "-" markers inside the string). For every issue found, explicitly state WHAT the issue is and WHERE. Focus on WSO2 bottlenecks:
  - WHAT: Lock contention, DB connection exhaustion, slow LDAP responses, OAuth token validation bottlenecks, idle starvation.
  - WHERE: Cite specific thread names (e.g., "http-nio-*", "PassThroughMessageProcessor-*") and specific WSO2/Java packages (e.g., "org.wso2.carbon.identity.oauth2.*", "javax.naming.*", "org.apache.tomcat.jdbc.pool.*").
  Example item: "- **Database Pool Exhaustion:** 45 HTTP worker threads are blocked waiting for connections in 'org.apache.tomcat.jdbc.pool.ConnectionPool.borrowConnection'."

recommended_actions:
  A numbered list (using "1.", "2.", ... inside the string) of 2-4 highly specific, actionable remediation steps. Tailor to WSO2 (e.g., tuning 'master-datasources.xml', increasing Tomcat 'maxThreads', enabling caching in 'identity.xml', or adding DB indexes).

Return ONLY the JSON object. Do not wrap it in markdown. Do not add any text before or after.`
