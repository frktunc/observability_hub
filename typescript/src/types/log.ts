/**
 * Log event types for structured logging
 * Generated from JSON Schema contracts
 */

import { BaseEvent } from './base';

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogEventType = 
  | 'log.message.created'
  | 'log.message.updated'
  | 'log.error.created'
  | 'log.error.updated'
  | 'log.warning.created'
  | 'log.warning.updated'
  | 'log.info.created'
  | 'log.info.updated'
  | 'log.debug.created'
  | 'log.debug.updated';

/**
 * Logger information
 */
export interface LoggerInfo {
  /** Logger name or category */
  name: string;
  /** Logging library version */
  version?: string;
  /** Thread or process name/ID */
  thread?: string;
}

/**
 * Contextual information for the log
 */
export interface LogContext {
  /** User ID associated with this log */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Request ID */
  requestId?: string;
  /** Operation or method name */
  operation?: string;
  /** Component or module name */
  component?: string;
  /** Additional context fields */
  [key: string]: unknown;
}

/**
 * Performance metrics within log data
 */
export interface LogMetrics {
  /** Operation duration in milliseconds */
  duration?: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** CPU usage percentage (0-100) */
  cpuUsage?: number;
  /** Additional metrics */
  [key: string]: unknown;
}

/**
 * Structured log data with typed fields
 */
export interface StructuredLogData {
  /** Dynamic structured fields */
  fields?: Record<string, unknown>;
  /** Performance metrics */
  metrics?: LogMetrics;
}

/**
 * Error information for error logs
 */
export interface LogErrorInfo {
  /** Error type or class name */
  type?: string;
  /** Error code or identifier */
  code?: string;
  /** Stack trace */
  stack?: string;
  /** Root cause description */
  cause?: string;
  /** Error fingerprint for deduplication */
  fingerprint?: string;
}

/**
 * Source code location information
 */
export interface LogSourceInfo {
  /** Source file name */
  file?: string;
  /** Line number in source file */
  line?: number;
  /** Function or method name */
  function?: string;
  /** Class name */
  class?: string;
}

/**
 * Log event data payload
 */
export interface LogEventData {
  /** Log level severity */
  level: LogLevel;
  /** The actual log message */
  message: string;
  /** When the original log was generated */
  timestamp: string;
  /** Logger information */
  logger?: LoggerInfo;
  /** Contextual information */
  context?: LogContext;
  /** Structured log data */
  structured?: StructuredLogData;
  /** Error information (for error logs) */
  error?: LogErrorInfo;
  /** Source code location */
  source?: LogSourceInfo;
}

/**
 * Complete log event interface
 */
export interface LogEvent extends BaseEvent {
  eventType: LogEventType;
  data: LogEventData;
}

/**
 * Type guard to check if an event is a log event
 */
export function isLogEvent(event: BaseEvent): event is LogEvent {
  return /^log\.(message|error|warning|info|debug)\.(created|updated)$/.test(event.eventType);
}

/**
 * Type guard to check if a log event is an error event
 */
export function isErrorLogEvent(event: LogEvent): boolean {
  return event.eventType.includes('error') || event.data.level === 'ERROR' || event.data.level === 'FATAL';
}

/**
 * Helper to create a log event with required fields
 */
export function createLogEvent(
  data: LogEventData,
  baseFields: Omit<BaseEvent, 'eventType' | 'data'>
): LogEvent {
  let eventType: LogEventType;
  
  // Determine event type based on log level
  switch (data.level) {
    case 'ERROR':
    case 'FATAL':
      eventType = 'log.error.created';
      break;
    case 'WARN':
      eventType = 'log.warning.created';
      break;
    case 'INFO':
      eventType = 'log.info.created';
      break;
    case 'DEBUG':
    case 'TRACE':
      eventType = 'log.debug.created';
      break;
    default:
      eventType = 'log.message.created';
  }

  return {
    ...baseFields,
    eventType,
    data,
  };
}

/**
 * Log level hierarchy for filtering and comparison
 */
export const LOG_LEVEL_HIERARCHY: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
} as const;

/**
 * Check if a log level meets the minimum threshold
 */
export function isLogLevelEnabled(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_HIERARCHY[level] >= LOG_LEVEL_HIERARCHY[minLevel];
}

/**
 * Sanitize sensitive data from log message and structured fields
 */
export function sanitizeLogData(data: LogEventData): LogEventData {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /authorization/i,
    /credential/i,
  ];

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return sensitivePatterns.some(pattern => pattern.test(value)) ? '[REDACTED]' : value;
    }
    
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      
      for (const [key, val] of Object.entries(obj)) {
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitizeValue(val);
        }
      }
      
      return sanitized;
    }
    
    return value;
  };

  const sanitizedData: LogEventData = {
    ...data,
  };

  if (data.structured) {
    sanitizedData.structured = {
      ...data.structured,
    };
    if (data.structured.fields) {
      sanitizedData.structured.fields = sanitizeValue(data.structured.fields) as Record<string, unknown>;
    }
  }

  if (data.context) {
    sanitizedData.context = sanitizeValue(data.context) as LogContext;
  }

  return sanitizedData;
} 