// Package types defines the core event structures for the observability hub
// These structs are generated to match the JSON Schema contracts
package types

import (
	"encoding/json"
	"time"
)

// EventPriority represents the priority level of an event
type EventPriority string

const (
	PriorityCritical EventPriority = "critical"
	PriorityHigh     EventPriority = "high"
	PriorityNormal   EventPriority = "normal"
	PriorityLow      EventPriority = "low"
)

// Environment represents the environment where the event originated
type Environment string

const (
	EnvironmentProduction  Environment = "production"
	EnvironmentStaging     Environment = "staging"
	EnvironmentDevelopment Environment = "development"
	EnvironmentTesting     Environment = "testing"
)

// EventSource contains information about the service that generated the event
type EventSource struct {
	Service  string `json:"service" validate:"required,min=1" bson:"service"`
	Version  string `json:"version" validate:"required,semver" bson:"version"`
	Instance string `json:"instance,omitempty" validate:"omitempty" bson:"instance,omitempty"`
	Region   string `json:"region,omitempty" validate:"omitempty" bson:"region,omitempty"`
}

// TracingContext contains distributed tracing information
type TracingContext struct {
	TraceID      string            `json:"traceId" validate:"required,trace_id" bson:"traceId"`
	SpanID       string            `json:"spanId,omitempty" validate:"omitempty,span_id" bson:"spanId,omitempty"`
	ParentSpanID string            `json:"parentSpanId,omitempty" validate:"omitempty,span_id" bson:"parentSpanId,omitempty"`
	Flags        *int              `json:"flags,omitempty" validate:"omitempty,min=0,max=255" bson:"flags,omitempty"`
	Baggage      map[string]string `json:"baggage,omitempty" validate:"omitempty" bson:"baggage,omitempty"`
}

// EventMetadata contains metadata for event processing and categorization
type EventMetadata struct {
	Priority    EventPriority `json:"priority" validate:"required,oneof=critical high normal low" bson:"priority"`
	Tags        []string      `json:"tags,omitempty" validate:"omitempty,dive,min=1" bson:"tags,omitempty"`
	Environment Environment   `json:"environment,omitempty" validate:"omitempty,oneof=production staging development testing" bson:"environment,omitempty"`
	RetryCount  int           `json:"retryCount,omitempty" validate:"omitempty,min=0" bson:"retryCount,omitempty"`
	SchemaURL   string        `json:"schemaUrl,omitempty" validate:"omitempty,url" bson:"schemaUrl,omitempty"`
	// Additional metadata fields can be stored here
	Additional map[string]interface{} `json:"-" bson:"additional,omitempty"`
}

// BaseEvent defines the common structure for all observability events
type BaseEvent struct {
	EventID       string          `json:"eventId" validate:"required,uuid4" bson:"_id"`
	EventType     string          `json:"eventType" validate:"required,event_type" bson:"eventType"`
	Version       string          `json:"version" validate:"required,semver" bson:"version"`
	Timestamp     time.Time       `json:"timestamp" validate:"required" bson:"timestamp"`
	CorrelationID string          `json:"correlationId" validate:"required,uuid4" bson:"correlationId"`
	CausationID   string          `json:"causationId,omitempty" validate:"omitempty,uuid4" bson:"causationId,omitempty"`
	Source        EventSource     `json:"source" validate:"required" bson:"source"`
	Tracing       *TracingContext `json:"tracing,omitempty" validate:"omitempty" bson:"tracing,omitempty"`
	Metadata      EventMetadata   `json:"metadata" validate:"required" bson:"metadata"`
}

// EventVersion represents semantic version information
type EventVersion struct {
	Major int `json:"major" validate:"required,min=0" bson:"major"`
	Minor int `json:"minor" validate:"required,min=0" bson:"minor"`
	Patch int `json:"patch" validate:"required,min=0" bson:"patch"`
}

// ValidationError represents a field-level validation error
type ValidationError struct {
	Field   string      `json:"field" bson:"field"`
	Message string      `json:"message" bson:"message"`
	Value   interface{} `json:"value,omitempty" bson:"value,omitempty"`
	Code    string      `json:"code,omitempty" bson:"code,omitempty"`
}

// ValidationResult contains the result of event validation
type ValidationResult struct {
	Valid  bool              `json:"valid" bson:"valid"`
	Errors []ValidationError `json:"errors,omitempty" bson:"errors,omitempty"`
}

// EventTypePattern defines the regex patterns for different event types
type EventTypePattern struct {
	Log     string `json:"log"`
	Metrics string `json:"metrics"`
	Trace   string `json:"trace"`
}

// DefaultEventTypePatterns contains the standard event type patterns
var DefaultEventTypePatterns = EventTypePattern{
	Log:     `^log\.(message|error|warning|info|debug)\.(created|updated)$`,
	Metrics: `^metrics\.(counter|gauge|histogram|summary)\.(created|updated)$`,
	Trace:   `^trace\.(span)\.(started|finished|created|updated)$`,
}

// SchemaVersions contains the current schema versions
var SchemaVersions = map[string]string{
	"base-event":    "1.0.0",
	"log-event":     "1.0.0",
	"metrics-event": "1.0.0",
	"trace-event":   "1.0.0",
}

// MarshalJSON implements custom JSON marshaling for BaseEvent
func (e *BaseEvent) MarshalJSON() ([]byte, error) {
	type Alias BaseEvent
	return json.Marshal(&struct {
		Timestamp string `json:"timestamp"`
		*Alias
	}{
		Timestamp: e.Timestamp.Format(time.RFC3339Nano),
		Alias:     (*Alias)(e),
	})
}

// UnmarshalJSON implements custom JSON unmarshaling for BaseEvent
func (e *BaseEvent) UnmarshalJSON(data []byte) error {
	type Alias BaseEvent
	aux := &struct {
		Timestamp string `json:"timestamp"`
		*Alias
	}{
		Alias: (*Alias)(e),
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
		e.Timestamp = t
	}

	return nil
}

// GetSchemaVersion returns the schema version for the given event type
func GetSchemaVersion(eventType string) string {
	if version, exists := SchemaVersions[eventType]; exists {
		return version
	}
	return SchemaVersions["base-event"]
}

// IsValidEventType checks if the event type matches known patterns
func IsValidEventType(eventType string) bool {
	// Note: In a real implementation, you would use regexp package
	// For now, we'll implement a simple prefix check
	return isLogEvent(eventType) || isMetricsEvent(eventType) || isTraceEvent(eventType)
}

// Helper functions for event type detection
func isLogEvent(eventType string) bool {
	return len(eventType) > 4 && eventType[:4] == "log."
}

func isMetricsEvent(eventType string) bool {
	return len(eventType) > 8 && eventType[:8] == "metrics."
}

func isTraceEvent(eventType string) bool {
	return len(eventType) > 6 && eventType[:6] == "trace."
}

// NewBaseEvent creates a new base event with required fields
func NewBaseEvent(eventType, correlationID string, source EventSource) *BaseEvent {
	return &BaseEvent{
		EventType:     eventType,
		Version:       GetSchemaVersion("base-event"),
		Timestamp:     time.Now().UTC(),
		CorrelationID: correlationID,
		Source:        source,
		Metadata: EventMetadata{
			Priority: PriorityNormal,
		},
	}
}

// SetTracing adds tracing context to the event
func (e *BaseEvent) SetTracing(traceID, spanID string) {
	e.Tracing = &TracingContext{
		TraceID: traceID,
		SpanID:  spanID,
	}
}

// AddTag adds a tag to the event metadata
func (e *BaseEvent) AddTag(tag string) {
	if e.Metadata.Tags == nil {
		e.Metadata.Tags = make([]string, 0)
	}
	// Check for duplicates
	for _, existingTag := range e.Metadata.Tags {
		if existingTag == tag {
			return
		}
	}
	e.Metadata.Tags = append(e.Metadata.Tags, tag)
}

// SetPriority sets the event priority
func (e *BaseEvent) SetPriority(priority EventPriority) {
	e.Metadata.Priority = priority
}

// SetEnvironment sets the environment metadata
func (e *BaseEvent) SetEnvironment(env Environment) {
	e.Metadata.Environment = env
}
