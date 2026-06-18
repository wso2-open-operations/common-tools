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

package logger

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"
)

// logLevel is a package-level LevelVar so the active log level can be adjusted at runtime.
var logLevel = new(slog.LevelVar)

const logTimeFormat = "15:04:05.000"

// Init wires a readable slog handler (colorized console plus an optional plain-text session-file copy); honors LOG_LEVEL and LOG_FILE.
func Init() {
	levelWarn := setLogLevel()

	// Colorize only when stderr is a real terminal; piped/containerized output stays plain.
	console := tint.NewHandler(os.Stderr, &tint.Options{
		Level:      logLevel,
		TimeFormat: logTimeFormat,
		NoColor:    !isatty.IsTerminal(os.Stderr.Fd()),
	})

	handlers := []slog.Handler{console}
	var fileWarn func(*slog.Logger)
	var fileInfo func(*slog.Logger)

	if path, ok := sessionLogPath(); ok {
		if f, err := openLogFile(path); err != nil {
			fileWarn = func(l *slog.Logger) { l.Warn("session log file disabled", "path", path, "error", err) }
		} else {
			// File copy stays color-free so it greps cleanly and reads well in less/cat.
			handlers = append(handlers, tint.NewHandler(f, &tint.Options{Level: logLevel, TimeFormat: logTimeFormat, NoColor: true}))
			fileInfo = func(l *slog.Logger) { l.Info("writing session logs to file", "path", path) }
		}
	}

	logger := slog.New(newFanoutHandler(handlers...))
	slog.SetDefault(logger)

	// Emit deferred notices now that the real handler is wired up.
	if levelWarn != "" {
		slog.Warn("invalid LOG_LEVEL, defaulting to INFO", "value", levelWarn)
	}
	if fileWarn != nil {
		fileWarn(logger)
	}
	if fileInfo != nil {
		fileInfo(logger)
	}
}

// setLogLevel applies LOG_LEVEL to logLevel, returning the raw value if it was malformed.
func setLogLevel() string {
	raw := strings.TrimSpace(os.Getenv("LOG_LEVEL"))
	if raw == "" {
		logLevel.Set(slog.LevelInfo)
		return ""
	}
	if err := logLevel.UnmarshalText([]byte(strings.ToUpper(raw))); err != nil {
		logLevel.Set(slog.LevelInfo)
		return raw
	}
	return ""
}

// sessionLogPath resolves the log mirror file: empty LOG_FILE yields a timestamped ./logs file; off/none/false/- disables it.
func sessionLogPath() (string, bool) {
	raw := strings.TrimSpace(os.Getenv("LOG_FILE"))
	switch strings.ToLower(raw) {
	case "off", "none", "false", "-":
		return "", false
	case "":
		return filepath.Join("logs", "tdat-session-"+time.Now().Format("20060102-150405")+".log"), true
	default:
		return raw, true
	}
}

// openLogFile creates the parent directory if needed and opens the file for appending.
func openLogFile(path string) (*os.File, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
}

// fanoutHandler dispatches each record to every wrapped handler (e.g. console + file).
type fanoutHandler struct {
	handlers []slog.Handler
}

func newFanoutHandler(handlers ...slog.Handler) *fanoutHandler {
	return &fanoutHandler{handlers: handlers}
}

func (h *fanoutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, next := range h.handlers {
		if next.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (h *fanoutHandler) Handle(ctx context.Context, r slog.Record) error {
	var errs []error
	for _, next := range h.handlers {
		if next.Enabled(ctx, r.Level) {
			// Clone so one handler's attr edits can't leak into the next.
			if err := next.Handle(ctx, r.Clone()); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errors.Join(errs...)
}

func (h *fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := make([]slog.Handler, len(h.handlers))
	for i, hh := range h.handlers {
		next[i] = hh.WithAttrs(attrs)
	}
	return &fanoutHandler{handlers: next}
}

func (h *fanoutHandler) WithGroup(name string) slog.Handler {
	next := make([]slog.Handler, len(h.handlers))
	for i, hh := range h.handlers {
		next[i] = hh.WithGroup(name)
	}
	return &fanoutHandler{handlers: next}
}
