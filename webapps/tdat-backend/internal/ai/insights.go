package ai

import (
	"context"
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
	})
	if err != nil {
		return nil, fmt.Errorf("Groq API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from Groq")
	}

	raw := strings.TrimSpace(resp.Choices[0].Message.Content)
	executive, patterns, recommendations := parseThreeSections(raw)
	log.Printf("AI insights generated — executive:%d patterns:%d recommendations:%d chars",
		len(executive), len(patterns), len(recommendations))

	return &AIInsights{
		ExecutiveSummary:   executive,
		KeyFindings:        patterns,
		RecommendedActions: recommendations,
	}, nil
}

// parseThreeSections splits the model response on the three expected section headers.
func parseThreeSections(text string) (executive, patterns, recommendations string) {
	const (
		hExec    = "Executive Summary:"
		hPattern = "Key Findings:"
		hRec     = "Recommended Actions:"
	)
	execIdx := strings.Index(text, hExec)
	patIdx := strings.Index(text, hPattern)
	recIdx := strings.Index(text, hRec)

	extract := func(start, labelLen, end int) string {
		if start < 0 {
			return ""
		}
		s := start + labelLen
		if end > s {
			return strings.TrimSpace(text[s:end])
		}
		return strings.TrimSpace(text[s:])
	}

	executive = extract(execIdx, len(hExec), patIdx)
	patterns = extract(patIdx, len(hPattern), recIdx)
	recommendations = extract(recIdx, len(hRec), len(text))

	// Fallback: if parsing failed (model ignored format), use the full text as executive summary
	if executive == "" && patterns == "" && recommendations == "" {
		executive = text
	}
	return
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

		// Only include threads with something noteworthy
		if worst.RiskLevel == "normal" && len(worst.Issues) == 0 {
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
You must respond with EXACTLY three sections. Each section must start with its exact label on its own line followed by a colon. 

CRITICAL RULE: Use highly structured, easy-to-read formatting. Use bullet points and bold text for scannability. Do not write giant walls of text.

Executive Summary:
Provide 3-5 concise sentences on the overall JVM health. Explicitly state:
- If a Java-level deadlock was detected.
- If there is severe thread pool saturation (e.g., Tomcat HTTP workers or PassThrough message processors).
- The overall severity of the issue (Critical, Warning, Normal).

Key Findings:
Use a bulleted list. For every issue found, you MUST explicitly state WHAT the issue is and WHERE it is happening. Focus specifically on WSO2 bottlenecks:
- WHAT: Lock contention, DB connection exhaustion, slow LDAP responses, OAuth token validation bottlenecks, or idle starvation.
- WHERE: Cite specific thread names (e.g., 'http-nio-*', 'PassThroughMessageProcessor-*') and specific WSO2/Java packages (e.g., 'org.wso2.carbon.identity.oauth2.*', 'javax.naming.*', 'org.apache.tomcat.jdbc.pool.*').
Example format: "- **Database Pool Exhaustion:** 45 HTTP worker threads are blocked waiting for connections in 'org.apache.tomcat.jdbc.pool.ConnectionPool.borrowConnection'."

Recommended Actions:
Use a numbered list of 2-4 highly specific, actionable remediation steps. Tailor these to WSO2 (e.g., tuning 'master-datasources.xml', increasing Tomcat 'maxThreads', enabling caching in 'identity.xml', or adding DB indexes).`
