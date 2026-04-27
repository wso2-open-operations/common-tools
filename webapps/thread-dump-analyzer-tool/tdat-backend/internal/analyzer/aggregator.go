package analyzer

import (
	"tdat-backend/internal/parser"
)

// A thread's state at a single point in time from one dump file
type ThreadSnapshot struct {
	FileName      string   `json:"dump_name"`
	State         string   `json:"state"`
	StackTrace    []string `json:"stack_trace"`
	ElapsedTime   float64  `json:"elapsed_time_s"`
	CPUTime       float64  `json:"cpu_time_ms"`
	CPUPercentage float64  `json:"cpu_percent"`
	// Include findings from the rules engine for this specific snapshot
	RiskLevel      string   `json:"risk_level,omitempty"`
	Issues         []string `json:"issues,omitempty"`
	Recommendation string   `json:"recommendation,omitempty"`
}

// A unique thread and its history across multiple thread dumps.
type AnalyzedThread struct {
	// The composite key used for matching
	ID         string `json:"id"`
	Name       string `json:"name"`
	NativeID   int64  `json:"native_id"`
	ThreadPool string `json:"thread_pool"`
	// A chronological sequence of this thread's state
	Snapshots []ThreadSnapshot `json:"snapshots"`
}

// threadKey is a private struct used as a map key for matching threads.
type threadKey struct {
	ID         string
	Name       string
	NativeID   int64
	ThreadPool string
}

// ParsedFile is a temporary container holding the results of parsing one file.
type ParsedFile struct {
	FileName string
	Threads  []parser.Thread
}

// AggregateThreads takes parsed data from multiple files and groups it by thread identity.
func AggregateThreads(parsedFiles []ParsedFile) []AnalyzedThread {
	// The Map is used for fast lookups to ensure unique threads.
	threadMap := make(map[threadKey]*AnalyzedThread)

	// A Slice records pointers to threads in the exact order they are first encountered.
	var creationOrder []*AnalyzedThread

	for _, file := range parsedFiles {
		for _, t := range file.Threads {
			// Define what makes this thread unique across files
			key := threadKey{
				ID:         t.ID,
				Name:       t.Name,
				NativeID:   t.NativeID,
				ThreadPool: t.ThreadPool,
			}

			// Check if thread already exists from a previous dump file
			if _, exists := threadMap[key]; !exists {
				// Create the new container object if seen for first time
				newThread := &AnalyzedThread{
					ID:         t.ID,
					Name:       t.Name,
					NativeID:   t.NativeID,
					ThreadPool: t.ThreadPool,
					Snapshots:  []ThreadSnapshot{},
				}

				// Add to map for future lookups
				threadMap[key] = newThread

				// Add to the ordered slice to remember sequence
				creationOrder = append(creationOrder, newThread)
			}

			// Create snapshot (data specific to just this one file)
			snapshot := ThreadSnapshot{
				FileName:       file.FileName,
				State:          t.State,
				StackTrace:     t.StackTrace,
				ElapsedTime:    t.ElapsedTime,
				CPUTime:        t.CPUTime,
				CPUPercentage:  t.CPUPercentage,
				RiskLevel:      t.RiskLevel,
				Issues:         t.Issues,
				Recommendation: t.Recommendation,
			}

			// Append snapshot to the parent thread object
			threadMap[key].Snapshots = append(threadMap[key].Snapshots, snapshot)
		}
	}

	// Final Result Building
	var result []AnalyzedThread

	// Iterate over the ordered slice to maintain thread creation order
	for _, orderedThreadPtr := range creationOrder {
		// Dereference pointer and add to final result
		result = append(result, *orderedThreadPtr)
	}

	return result
}
