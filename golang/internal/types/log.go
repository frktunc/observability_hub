// Package types defines log event structures for the observability hub
package types

import (
	"encoding/json"
	"time"
)

// LogLevel represents the severity level of a log message
type LogLevel string

const (
	LogLevelTrace LogLevel = "TRACE"
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
	LogLevelFatal LogLevel = "FATAL"
)

// LogEventType represents the specific type of log event
type LogEventType string

const (
	LogEventMessageCreated LogEventType = "log.message.created"
	LogEventMessageUpdated LogEventType = "log.message.updated"
	LogEventErrorCreated   LogEventType = "log.error.created"
	LogEventErrorUpdated   LogEventType = "log.error.updated"
	LogEventWarningCreated LogEventType = "log.warning.created"
	LogEventWarningUpdated LogEventType = "log.warning.updated"
	LogEventInfoCreated    LogEventType = "log.info.created"
	LogEventInfoUpdated    LogEventType = "log.info.updated"
	LogEventDebugCreated   LogEventType = "log.debug.created"
	LogEventDebugUpdated   LogEventType = "log.debug.updated"
)

// LoggerInfo contains information about the logger that generated the log
type LoggerInfo struct {
	Name    string `json:"name" validate:"required,min=1" bson:"name"`
	Version string `json:"version,omitempty" validate:"omitempty" bson:"version,omitempty"`
	Thread  string `json:"thread,omitempty" validate:"omitempty" bson:"thread,omitempty"`
}

// LogContext contains contextual information for the log message
type LogContext struct {
	UserID     string                 `json:"userId,omitempty" validate:"omitempty,uuid4" bson:"userId,omitempty"`
	SessionID  string                 `json:"sessionId,omitempty" validate:"omitempty" bson:"sessionId,omitempty"`
	RequestID  string                 `json:"requestId,omitempty" validate:"omitempty,uuid4" bson:"requestId,omitempty"`
	Operation  string                 `json:"operation,omitempty" validate:"omitempty" bson:"operation,omitempty"`
	Component  string                 `json:"component,omitempty" validate:"omitempty" bson:"component,omitempty"`
	Additional map[string]interface{} `json:",inline" bson:",inline"`
}

// LogMetrics contains performance metrics within log data
type LogMetrics struct {
	Duration    *float64               `json:"duration,omitempty" validate:"omitempty,min=0" bson:"duration,omitempty"`
	MemoryUsage *int64                 `json:"memoryUsage,omitempty" validate:"omitempty,min=0" bson:"memoryUsage,omitempty"`
	CPUUsage    *float64               `json:"cpuUsage,omitempty" validate:"omitempty,min=0,max=100" bson:"cpuUsage,omitempty"`
	Additional  map[string]interface{} `json:",inline" bson:",inline"`
}

// StructuredLogData contains structured log data with typed fields
type StructuredLogData struct {
	Fields  map[string]interface{} `json:"fields,omitempty" validate:"omitempty" bson:"fields,omitempty"`
	Metrics *LogMetrics            `json:"metrics,omitempty" validate:"omitempty" bson:"metrics,omitempty"`
}

// LogErrorInfo contains error information for error logs
type LogErrorInfo struct {
	Type        string `json:"type,omitempty" validate:"omitempty" bson:"type,omitempty"`
	Code        string `json:"code,omitempty" validate:"omitempty" bson:"code,omitempty"`
	Stack       string `json:"stack,omitempty" validate:"omitempty" bson:"stack,omitempty"`
	Cause       string `json:"cause,omitempty" validate:"omitempty" bson:"cause,omitempty"`
	Fingerprint string `json:"fingerprint,omitempty" validate:"omitempty" bson:"fingerprint,omitempty"`
}

// LogSourceInfo contains source code location information
type LogSourceInfo struct {
	File     string `json:"file,omitempty" validate:"omitempty" bson:"file,omitempty"`
	Line     *int   `json:"line,omitempty" validate:"omitempty,min=1" bson:"line,omitempty"`
	Function string `json:"function,omitempty" validate:"omitempty" bson:"function,omitempty"`
	Class    string `json:"class,omitempty" validate:"omitempty" bson:"class,omitempty"`
}

// LogEventData contains the payload specific to log events
type LogEventData struct {
	Level      LogLevel           `json:"level" validate:"required,oneof=TRACE DEBUG INFO WARN ERROR FATAL" bson:"level"`
	Message    string             `json:"message" validate:"required,min=1,max=32768" bson:"message"`
	Timestamp  time.Time          `json:"timestamp" validate:"required" bson:"timestamp"`
	Logger     *LoggerInfo        `json:"logger,omitempty" validate:"omitempty" bson:"logger,omitempty"`
	Context    *LogContext        `json:"context,omitempty" validate:"omitempty" bson:"context,omitempty"`
	Structured *StructuredLogData `json:"structured,omitempty" validate:"omitempty" bson:"structured,omitempty"`
	Error      *LogErrorInfo      `json:"error,omitempty" validate:"omitempty" bson:"error,omitempty"`
	Source     *LogSourceInfo     `json:"source,omitempty" validate:"omitempty" bson:"source,omitempty"`
}

// LogEvent represents a complete log event
type LogEvent struct {
	BaseEvent `bson:",inline"`
	Data      LogEventData `json:"data" validate:"required" bson:"data"`
}

// MarshalJSON implements custom JSON marshaling for LogEventData
func (d *LogEventData) MarshalJSON() ([]byte, error) {
	type Alias LogEventData
	return json.Marshal(&struct {
		Timestamp string `json:"timestamp"`
		*Alias
	}{
		Timestamp: d.Timestamp.Format(time.RFC3339Nano),
		Alias:     (*Alias)(d),
	})
}

// UnmarshalJSON implements custom JSON unmarshaling for LogEventData
func (d *LogEventData) UnmarshalJSON(data []byte) error {
	type Alias LogEventData
	aux := &struct {
		Timestamp string `json:"timestamp"`
		*Alias
	}{
		Alias: (*Alias)(d),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Parse timestamp
	if aux.Timestamp != "" {
		t, err := time.Parse(time.RFC3339Nano, aux.Timestamp)
		if err != nil {
			// Try parsing without nanoseconds
			t, err = time.Parse(time.RFC3339, aux.Timestamp)
			if err != nil {
				return err
			}
		}
		d.Timestamp = t
	}

	return nil
}

// LogLevelHierarchy defines the numeric values for log level comparison
var LogLevelHierarchy = map[LogLevel]int{
	LogLevelTrace: 0,
	LogLevelDebug: 1,
	LogLevelInfo:  2,
	LogLevelWarn:  3,
	LogLevelError: 4,
	LogLevelFatal: 5,
}

// IsLogEvent checks if the base event is a log event
func IsLogEvent(event *BaseEvent) bool {
	return isLogEvent(event.EventType)
}

// IsErrorLogEvent checks if the log event represents an error
func IsErrorLogEvent(event *LogEvent) bool {
	return event.Data.Level == LogLevelError || event.Data.Level == LogLevelFatal ||
		string(event.EventType) == string(LogEventErrorCreated) ||
		string(event.EventType) == string(LogEventErrorUpdated)
}

// GetLogEventType determines the appropriate event type based on log level
func GetLogEventType(level LogLevel) LogEventType {
	switch level {
	case LogLevelError, LogLevelFatal:
		return LogEventErrorCreated
	case LogLevelWarn:
		return LogEventWarningCreated
	case LogLevelInfo:
		return LogEventInfoCreated
	case LogLevelDebug, LogLevelTrace:
		return LogEventDebugCreated
	default:
		return LogEventMessageCreated
	}
}

// IsLogLevelEnabled checks if a log level meets the minimum threshold
func IsLogLevelEnabled(level, minLevel LogLevel) bool {
	levelValue, exists := LogLevelHierarchy[level]
	if !exists {
		return false
	}
	minLevelValue, exists := LogLevelHierarchy[minLevel]
	if !exists {
		return false
	}
	return levelValue >= minLevelValue
}

// NewLogEvent creates a new log event with the required fields
func NewLogEvent(level LogLevel, message string, correlationID string, source EventSource) *LogEvent {
	eventType := GetLogEventType(level)
	baseEvent := NewBaseEvent(string(eventType), correlationID, source)
	baseEvent.Version = GetSchemaVersion("log-event")

	return &LogEvent{
		BaseEvent: *baseEvent,
		Data: LogEventData{
			Level:     level,
			Message:   message,
			Timestamp: time.Now().UTC(),
		},
	}
}

// SetLogger sets the logger information for the log event
func (e *LogEvent) SetLogger(name, version, thread string) {
	e.Data.Logger = &LoggerInfo{
		Name:    name,
		Version: version,
		Thread:  thread,
	}
}

// SetContext sets the context information for the log event
func (e *LogEvent) SetContext(ctx *LogContext) {
	e.Data.Context = ctx
}

// SetError sets error information for the log event
func (e *LogEvent) SetError(errorType, code, stack, cause, fingerprint string) {
	e.Data.Error = &LogErrorInfo{
		Type:        errorType,
		Code:        code,
		Stack:       stack,
		Cause:       cause,
		Fingerprint: fingerprint,
	}
}

// SetSource sets the source code location for the log event
func (e *LogEvent) SetSource(file string, line int, function, class string) {
	e.Data.Source = &LogSourceInfo{
		File:     file,
		Line:     &line,
		Function: function,
		Class:    class,
	}
}

// AddStructuredField adds a structured field to the log event
func (e *LogEvent) AddStructuredField(key string, value interface{}) {
	if e.Data.Structured == nil {
		e.Data.Structured = &StructuredLogData{
			Fields: make(map[string]interface{}),
		}
	}
	if e.Data.Structured.Fields == nil {
		e.Data.Structured.Fields = make(map[string]interface{})
	}
	e.Data.Structured.Fields[key] = value
}

// SetMetrics sets performance metrics for the log event
func (e *LogEvent) SetMetrics(duration *float64, memoryUsage *int64, cpuUsage *float64) {
	if e.Data.Structured == nil {
		e.Data.Structured = &StructuredLogData{}
	}
	e.Data.Structured.Metrics = &LogMetrics{
		Duration:    duration,
		MemoryUsage: memoryUsage,
		CPUUsage:    cpuUsage,
		Additional:  make(map[string]interface{}),
	}
}

// SanitizeLogData removes sensitive information from log data
func (e *LogEvent) SanitizeLogData() {
	// Define sensitive patterns
	sensitivePatterns := []string{
		"password", "token", "key", "secret", "authorization", "credential",
	}

	// Sanitize structured fields
	if e.Data.Structured != nil && e.Data.Structured.Fields != nil {
		e.Data.Structured.Fields = sanitizeMap(e.Data.Structured.Fields, sensitivePatterns)
	}

	// Sanitize context
	if e.Data.Context != nil && e.Data.Context.Additional != nil {
		e.Data.Context.Additional = sanitizeMap(e.Data.Context.Additional, sensitivePatterns)
	}
}

// Helper function to sanitize a map of values
func sanitizeMap(data map[string]interface{}, sensitivePatterns []string) map[string]interface{} {
	sanitized := make(map[string]interface{})

	for key, value := range data {
		// Check if key contains sensitive information
		isSensitive := false
		for _, pattern := range sensitivePatterns {
			if contains(key, pattern) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[key] = "[REDACTED]"
		} else {
			// Recursively sanitize nested maps
			if nestedMap, ok := value.(map[string]interface{}); ok {
				sanitized[key] = sanitizeMap(nestedMap, sensitivePatterns)
			} else {
				sanitized[key] = value
			}
		}
	}

	return sanitized
}

// Helper function to check if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	// Simple case-insensitive contains check
	sLower := toLower(s)
	substrLower := toLower(substr)
	return len(sLower) >= len(substrLower) && indexOf(sLower, substrLower) >= 0
}

// Helper function to convert string to lowercase
func toLower(s string) string {
	result := make([]rune, len(s))
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			result[i] = r + 32
		} else {
			result[i] = r
		}
	}
	return string(result)
}

// Helper function to find index of substring
func indexOf(s, substr string) int {
	if len(substr) == 0 {
		return 0
	}
	if len(s) < len(substr) {
		return -1
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
