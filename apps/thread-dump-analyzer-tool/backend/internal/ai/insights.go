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

package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// maxInsightTokens caps the model's reply; sized so the three-section JSON for up to 40 threads is not truncated.
const maxInsightTokens = 4096

// AIInsights holds the three-section analysis produced by the AI model.
type AIInsights struct {
	ExecutiveSummary   string `json:"executive_summary"`
	KeyFindings        string `json:"pattern_recognition"`
	RecommendedActions string `json:"recommended_actions"`
}

// GetInsights calls the Anthropic API to produce a plain-English executive summary of the thread dumps.
// parentCtx caps the call (capped further to 30s); usageProvided indicates whether CPU files were uploaded.
func GetInsights(parentCtx context.Context, threads []analyzer.AnalyzedThread, usageProvided bool) (*AIInsights, error) {
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

	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Second)
	defer cancel()

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeHaiku4_5_20251001,
		MaxTokens: maxInsightTokens,
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

	// A max_tokens stop means the JSON was cut off mid-string; fail cleanly instead of emitting a misleading parse error.
	if resp.StopReason == anthropic.StopReasonMaxTokens {
		slog.Warn("AI insights truncated at max tokens", "max_tokens", maxInsightTokens, "threads", len(threads))
		return nil, fmt.Errorf("AI summary exceeded the response budget")
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
		// Log a bounded preview, not the full payload: raw can carry thread-derived content.
		preview := raw
		if len(preview) > 256 {
			preview = preview[:256]
		}
		slog.Warn("AI insights JSON parse failed", "error", err, "preview", preview, "raw_len", len(raw))
		return nil, fmt.Errorf("AI summary was not valid JSON")
	}

	slog.Info("AI insights generated",
		"executive_chars", len(insights.ExecutiveSummary),
		"patterns_chars", len(insights.KeyFindings),
		"recommendations_chars", len(insights.RecommendedActions))

	return &insights, nil
}

// buildPrompt constructs the user message with a concise view of all threads.
func buildPrompt(threads []analyzer.AnalyzedThread, usageProvided bool) string {
	var sb strings.Builder

	// Count risk levels (worst per thread across snapshots).
	counts := map[string]int{parser.RiskCritical: 0, parser.RiskHigh: 0, parser.RiskMedium: 0, parser.RiskInfo: 0, parser.RiskNormal: 0}
	for _, t := range threads {
		worst := parser.RiskNormal
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
		len(threads), counts[parser.RiskCritical], counts[parser.RiskHigh], counts[parser.RiskMedium], counts[parser.RiskInfo], counts[parser.RiskNormal])

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
		if risk == parser.RiskInfo || risk == parser.RiskNormal {
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
			fmt.Fprintf(&sb, " issues=[%s]", strings.Join(quoteAll(worst.Issues), ","))
		}
		// Top 3 stack frames only
		frames := worst.StackTrace
		if len(frames) > 3 {
			frames = frames[:3]
		}
		if len(frames) > 0 {
			fmt.Fprintf(&sb, " stack=[%s]", strings.Join(quoteAll(frames), " | "))
		}
		fmt.Fprintf(&sb, "\n")
	}

	return sb.String()
}

// quoteAll applies %q to each string so user-controlled fields (issues, stack frames)
// can't break out of the prompt context with quotes, newlines, or instruction-like text.
func quoteAll(ss []string) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = fmt.Sprintf("%q", s)
	}
	return out
}

func normalizeRisk(level string) string {
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case parser.RiskCritical:
		return parser.RiskCritical
	case parser.RiskHigh:
		return parser.RiskHigh
	case parser.RiskMedium:
		return parser.RiskMedium
	case parser.RiskInfo:
		return parser.RiskInfo
	default:
		return parser.RiskNormal
	}
}

// Lower rank = higher severity (critical=0, normal=4)
func riskRank(level string) int {
	switch normalizeRisk(level) {
	case parser.RiskCritical:
		return 0
	case parser.RiskHigh:
		return 1
	case parser.RiskMedium:
		return 2
	case parser.RiskInfo:
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
