package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"tdat-backend/internal/analyzer"

	openai "github.com/sashabaranov/go-openai"
)

// AIInsights holds the three-section analysis produced by Groq.
type AIInsights struct {
	ExecutiveSummary   string `json:"executive_summary"`
	KeyFindings        string `json:"pattern_recognition"`
	RecommendedActions string `json:"recommended_actions"`
}

// GetInsights calls Groq to produce a plain-English executive summary of the thread dumps.
// usageProvided indicates whether thread usage/CPU files were uploaded alongside the dumps.
func GetInsights(threads []analyzer.AnalyzedThread, usageProvided bool) (*AIInsights, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GROQ_API_KEY not set")
	}

	if len(threads) == 0 {
		return nil, fmt.Errorf("no threads to summarize")
	}

	prompt := buildPrompt(threads, usageProvided)

	cfg := openai.DefaultConfig(apiKey)
	cfg.BaseURL = "https://api.groq.com/openai/v1"
	client := openai.NewClientWithConfig(cfg)

	resp, err := client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
		Model: "llama-3.3-70b-versatile",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: prompt},
		},
		MaxTokens: 1024,
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Groq API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from Groq")
	}

	raw := strings.TrimSpace(resp.Choices[0].Message.Content)

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

	// Count risk levels
	counts := map[string]int{"critical": 0, "warning": 0, "info": 0, "normal": 0}
	for _, t := range threads {
		worst := "normal"
		for _, s := range t.Snapshots {
			if riskRank(s.RiskLevel) < riskRank(worst) {
				worst = s.RiskLevel
			}
		}
		counts[worst]++
	}

	fmt.Fprintf(&sb, "Thread dump analysis summary:\n")
	fmt.Fprintf(&sb, "Total threads: %d | Critical: %d | Warning: %d | Info: %d | Normal: %d\n",
		len(threads), counts["critical"], counts["warning"], counts["info"], counts["normal"])

	if usageProvided {
		fmt.Fprintf(&sb, "CPU/thread usage data: available\n")
	} else {
		fmt.Fprintf(&sb, "CPU/thread usage data: not provided\n")
	}
	fmt.Fprintf(&sb, "\n")

	// Cap threads sent to Claude to avoid token limits
	const maxThreads = 40
	sent := threads
	if len(sent) > maxThreads {
		sent = sent[:maxThreads]
	}

	for _, t := range sent {
		// Find the worst snapshot to represent this thread
		worst := t.Snapshots[0]
		for _, s := range t.Snapshots[1:] {
			if riskRank(s.RiskLevel) < riskRank(worst.RiskLevel) {
				worst = s
			}
		}

		// Aggressively drop low-signal threads: INFO (standalone/ungrouped) and normal
		// threads carry no actionable content but consume large amounts of tokens.
		if worst.RiskLevel == "INFO" || worst.RiskLevel == "normal" {
			continue
		}

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

func riskRank(level string) int {
	switch level {
	case "critical":
		return 0
	case "warning":
		return 1
	case "info":
		return 2
	default:
		return 3
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
