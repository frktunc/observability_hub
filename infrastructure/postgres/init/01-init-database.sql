-- ==============================================
-- OBSERVABILITY HUB - Database Initialization
-- ==============================================

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'obs_user') THEN
      CREATE USER obs_user WITH PASSWORD 'obs_password';
   END IF;
END
$do$;

-- Grant privileges to obs_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO obs_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO obs_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO obs_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO obs_user;

-- ==============================================
-- LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    correlation_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    trace_id VARCHAR(255),
    span_id VARCHAR(255),
    parent_span_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- METRICS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TRACES TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) NOT NULL,
    span_id VARCHAR(255) NOT NULL,
    parent_span_id VARCHAR(255),
    operation_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    tags JSONB DEFAULT '{}',
    logs_data JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'OK',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- HEALTH_CHECKS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- ALERTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(255),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- DEAD_LETTER_QUEUE TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_message JSONB NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_correlation_id ON logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_logs_service_name ON logs(service_name);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_log_level ON logs(log_level);
CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_service_name ON metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);

-- Traces indexes
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_span_id ON traces(span_id);
CREATE INDEX IF NOT EXISTS idx_traces_service_name ON traces(service_name);
CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
CREATE INDEX IF NOT EXISTS idx_traces_operation_name ON traces(operation_name);

-- Health checks indexes
CREATE INDEX IF NOT EXISTS idx_health_checks_service_name ON health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_service_name ON alerts(service_name);
CREATE INDEX IF NOT EXISTS idx_alerts_correlation_id ON alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- Dead letter queue indexes
CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON dead_letter_queue(resolved);
CREATE INDEX IF NOT EXISTS idx_dlq_next_retry_at ON dead_letter_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_dlq_created_at ON dead_letter_queue(created_at);

-- ==============================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_logs_updated_at BEFORE UPDATE ON logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dlq_updated_at BEFORE UPDATE ON dead_letter_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- SAMPLE DATA FOR TESTING
-- ==============================================

-- Insert sample log entries
INSERT INTO logs (correlation_id, service_name, log_level, message, metadata, trace_id, span_id) VALUES
    ('corr-001', 'user-service', 'INFO', 'User login successful', '{"user_id": "123", "ip": "192.168.1.1"}', 'trace-001', 'span-001'),
    ('corr-002', 'order-service', 'ERROR', 'Failed to process order', '{"order_id": "456", "error": "payment_failed"}', 'trace-002', 'span-002'),
    ('corr-003', 'notification-service', 'INFO', 'Email sent successfully', '{"email": "user@example.com", "type": "welcome"}', 'trace-003', 'span-003');

-- Insert sample health check entries
INSERT INTO health_checks (service_name, status, response_time_ms, metadata) VALUES
    ('user-service', 'healthy', 45, '{"version": "1.0.0"}'),
    ('order-service', 'healthy', 78, '{"version": "1.2.0"}'),
    ('notification-service', 'healthy', 23, '{"version": "1.1.0"}');

-- Insert sample alert
INSERT INTO alerts (alert_name, severity, message, service_name, correlation_id, metadata) VALUES
    ('High Error Rate', 'critical', 'Error rate exceeded 5% threshold', 'order-service', 'corr-002', '{"threshold": 5, "current_rate": 7.2}');

-- ==============================================
-- VIEWS FOR ANALYTICS
-- ==============================================

-- View for log analytics
CREATE OR REPLACE VIEW log_analytics AS
SELECT 
    service_name,
    log_level,
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as count
FROM logs
GROUP BY service_name, log_level, DATE_TRUNC('hour', timestamp);

-- View for service health summary
CREATE OR REPLACE VIEW service_health_summary AS
SELECT 
    service_name,
    status,
    COUNT(*) as count,
    AVG(response_time_ms) as avg_response_time,
    MAX(timestamp) as last_check
FROM health_checks
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY service_name, status;

-- View for active alerts
CREATE OR REPLACE VIEW active_alerts AS
SELECT 
    alert_name,
    severity,
    service_name,
    message,
    correlation_id,
    created_at
FROM alerts
WHERE resolved = FALSE
ORDER BY created_at DESC; 