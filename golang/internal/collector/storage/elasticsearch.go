package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"observability_hub/golang/internal/collector/config"
	"strings"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
	"go.uber.org/zap"
)

const (
	defaultIndexName = "logs-default"
)

// ESStorage handles Elasticsearch operations.
type ESStorage struct {
	client *elasticsearch.Client
	logger *zap.Logger
}

// NewESStorage creates a new ESStorage instance.
func NewESStorage(cfg *config.Config, logger *zap.Logger) (*ESStorage, error) {
	esCfg := elasticsearch.Config{
		Addresses: []string{cfg.ElasticsearchURL},
	}

	esClient, err := elasticsearch.NewClient(esCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create elasticsearch client: %w", err)
	}

	// Test the connection
	res, err := esClient.Info()
	if err != nil {
		return nil, fmt.Errorf("failed to get elasticsearch info: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("elasticsearch info response error: %s", res.String())
	}

	logger.Info("Successfully connected to Elasticsearch", zap.String("version", elasticsearch.Version))

	return &ESStorage{
		client: esClient,
		logger: logger.Named("es_storage"),
	}, nil
}

// BulkIndexLogEvents indexes a batch of log events to Elasticsearch.
func (s *ESStorage) BulkIndexLogEvents(ctx context.Context, events []*LogEvent) error {
	if len(events) == 0 {
		return nil
	}

	var buf bytes.Buffer
	for _, event := range events {
		// Meta line for bulk API
		meta := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": getIndexName(event),
				"_id":    event.EventID,
			},
		}
		metaBytes, err := json.Marshal(meta)
		if err != nil {
			s.logger.Error("Failed to marshal bulk meta", zap.Error(err))
			continue
		}
		buf.Write(metaBytes)
		buf.WriteByte('\n')

		// Event source line
		eventBytes, err := json.Marshal(event)
		if err != nil {
			s.logger.Error("Failed to marshal event source", zap.Error(err))
			continue
		}
		buf.Write(eventBytes)
		buf.WriteByte('\n')
	}

	req := esapi.BulkRequest{
		Body:    &buf,
		Refresh: "false", // for better performance
	}

	res, err := req.Do(ctx, s.client)
	if err != nil {
		return fmt.Errorf("bulk request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		bodyBytes, _ := io.ReadAll(res.Body)
		return fmt.Errorf("bulk request returned an error: %s, body: %s", res.Status(), string(bodyBytes))
	}

	// Check for errors in the response body
	var bulkResponse struct {
		Errors bool `json:"errors"`
		Items  []struct {
			Index struct {
				Status int `json:"status"`
				Error  struct {
					Type   string `json:"type"`
					Reason string `json:"reason"`
				} `json:"error"`
			} `json:"index"`
		} `json:"items"`
	}

	if err := json.NewDecoder(res.Body).Decode(&bulkResponse); err != nil {
		return fmt.Errorf("failed to decode bulk response: %w", err)
	}

	if bulkResponse.Errors {
		var errorReasons []string
		for _, item := range bulkResponse.Items {
			if item.Index.Error.Type != "" {
				errorReasons = append(errorReasons, fmt.Sprintf("type: %s, reason: %s", item.Index.Error.Type, item.Index.Error.Reason))
			}
		}
		return fmt.Errorf("bulk indexing had errors: %s", strings.Join(errorReasons, "; "))
	}

	s.logger.Info("Successfully indexed batch of logs", zap.Int("count", len(events)))
	return nil
}

// getIndexName determines the index name based on the event source.
func getIndexName(event *LogEvent) string {
	if event.Source.Service != "" {
		// e.g., logs-user-service-2024-07
		return fmt.Sprintf("logs-%s-%s",
			strings.ToLower(event.Source.Service),
			event.Timestamp.Format("2006-01"),
		)
	}
	return defaultIndexName
}

// Close is a placeholder for any cleanup logic.
func (s *ESStorage) Close() {
	// The client doesn't have an explicit close method.
	// Connections are managed by the underlying HTTP transport.
}
