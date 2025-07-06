# Message Versioning Strategy

## Overview

This document defines the versioning strategy for observability events in the observability hub. The strategy ensures backward compatibility, smooth migrations, and clear evolution paths for event schemas.

## Versioning Principles

### 1. Semantic Versioning

All schemas follow semantic versioning (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes that are not backward compatible
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and clarifications that are backward compatible

### 2. Backward Compatibility Rules

#### Compatible Changes (MINOR/PATCH):
- Adding new optional fields
- Adding new enum values
- Relaxing validation constraints (e.g., increasing max length)
- Adding new event types
- Adding documentation/descriptions

#### Breaking Changes (MAJOR):
- Removing fields
- Renaming fields
- Changing field types
- Making optional fields required
- Removing enum values
- Changing validation constraints to be more restrictive

### 3. Version Evolution Matrix

| From Version | To Version | Compatibility | Migration Required |
|--------------|------------|---------------|-------------------|
| 1.0.0 → 1.0.1 | PATCH | ✅ Full | ❌ No |
| 1.0.0 → 1.1.0 | MINOR | ✅ Backward | ❌ No |
| 1.0.0 → 2.0.0 | MAJOR | ❌ Breaking | ✅ Yes |

## Schema Evolution Guidelines

### 1. Adding New Fields

```json
// v1.0.0 - Original
{
  "eventId": "string",
  "eventType": "string",
  "timestamp": "string"
}

// v1.1.0 - Added optional field (MINOR)
{
  "eventId": "string",
  "eventType": "string", 
  "timestamp": "string",
  "priority": "string"  // NEW: optional field
}
```

### 2. Deprecating Fields

```json
// v1.5.0 - Deprecation notice (MINOR)
{
  "eventId": "string",
  "eventType": "string",
  "timestamp": "string",
  "oldField": "string",  // DEPRECATED: Use newField instead
  "newField": "string"   // NEW: Replacement for oldField
}

// v2.0.0 - Removal (MAJOR)
{
  "eventId": "string", 
  "eventType": "string",
  "timestamp": "string",
  "newField": "string"   // oldField removed
}
```

### 3. Evolving Event Types

```json
// v1.0.0 - Log events
"eventType": "log.message.created"

// v1.1.0 - New log event types (MINOR)
"eventType": "log.error.created"
"eventType": "log.warning.created"

// v1.2.0 - Metrics events added (MINOR)
"eventType": "metrics.counter.created"
"eventType": "metrics.gauge.updated"
```

## Version Management Implementation

### 1. Schema Registry

```typescript
interface SchemaRegistry {
  schemas: Map<string, SchemaVersion[]>;
  getLatest(schemaType: string): SchemaVersion;
  getVersion(schemaType: string, version: string): SchemaVersion;
  isCompatible(from: string, to: string): boolean;
  migrate(event: any, fromVersion: string, toVersion: string): any;
}
```

### 2. Version Detection

```typescript
// Event includes version in metadata
{
  "version": "1.2.0",
  "eventType": "log.message.created",
  "data": { ... }
}

// Auto-detect version from event structure
function detectVersion(event: unknown): string {
  if (hasField(event, 'newField')) return '1.1.0';
  if (hasField(event, 'priority')) return '1.0.1';
  return '1.0.0';
}
```

### 3. Migration Framework

```typescript
interface VersionMigration {
  fromVersion: string;
  toVersion: string;
  migrate(event: any): any;
  reverse?(event: any): any;  // For downgrades
}

class MigrationEngine {
  migrations: VersionMigration[];
  
  migrate(event: any, targetVersion: string): any {
    const currentVersion = event.version;
    const path = this.findMigrationPath(currentVersion, targetVersion);
    
    return path.reduce((evt, migration) => {
      return migration.migrate(evt);
    }, event);
  }
}
```

## Backward Compatibility Strategies

### 1. Field Defaults

```json
// Schema with defaults for new fields
{
  "type": "object",
  "properties": {
    "priority": {
      "type": "string", 
      "enum": ["critical", "high", "normal", "low"],
      "default": "normal"  // Default for backward compatibility
    },
    "retryCount": {
      "type": "integer",
      "minimum": 0,
      "default": 0  // Default for new field
    }
  }
}
```

### 2. Progressive Enhancement

```typescript
// Consumers can handle multiple versions
interface EventProcessor {
  process(event: BaseEvent): void {
    // Handle common fields
    this.logBasic(event.eventId, event.timestamp);
    
    // Handle version-specific fields
    if (event.version >= '1.1.0' && 'priority' in event.metadata) {
      this.handlePriority(event.metadata.priority);
    }
    
    if (event.version >= '1.2.0' && 'tags' in event.metadata) {
      this.handleTags(event.metadata.tags);
    }
  }
}
```

### 3. Graceful Degradation

```typescript
// Producer sends compatible format
class EventProducer {
  send(event: BaseEvent, targetVersion?: string): void {
    const compatibleEvent = targetVersion 
      ? this.downgrade(event, targetVersion)
      : event;
      
    this.transport.send(compatibleEvent);
  }
  
  private downgrade(event: BaseEvent, targetVersion: string): BaseEvent {
    // Remove fields not supported in target version
    const downgraded = { ...event };
    
    if (targetVersion < '1.1.0') {
      delete downgraded.metadata.priority;
      delete downgraded.metadata.tags;
    }
    
    return downgraded;
  }
}
```

## Migration Scenarios

### 1. Schema Migration Examples

```typescript
// 1.0.0 → 1.1.0: Add priority field
const migration_1_0_to_1_1: VersionMigration = {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  migrate: (event) => ({
    ...event,
    version: '1.1.0',
    metadata: {
      ...event.metadata,
      priority: 'normal'  // Default priority
    }
  })
};

// 1.1.0 → 2.0.0: Restructure metadata
const migration_1_1_to_2_0: VersionMigration = {
  fromVersion: '1.1.0', 
  toVersion: '2.0.0',
  migrate: (event) => ({
    ...event,
    version: '2.0.0',
    eventMetadata: {  // Renamed from 'metadata'
      processingPriority: event.metadata.priority,  // Renamed
      environment: event.metadata.environment,
      tags: event.metadata.tags || []
    }
  })
};
```

### 2. Multi-Version Support

```typescript
// Support multiple versions simultaneously
class VersionedEventValidator {
  private validators = new Map<string, Validator>();
  
  validate(event: any): ValidationResult {
    const version = event.version || '1.0.0';
    const validator = this.validators.get(version);
    
    if (!validator) {
      // Try to migrate to supported version
      const latestSupported = this.getLatestSupportedVersion();
      const migrated = this.migrate(event, latestSupported);
      return this.validators.get(latestSupported)!.validate(migrated);
    }
    
    return validator.validate(event);
  }
}
```

## Version Lifecycle Management

### 1. Support Timeline

```markdown
Version | Release Date | Support Level | End of Life
--------|-------------|---------------|-------------
1.0.0   | 2024-01-01  | Legacy        | 2025-01-01
1.1.0   | 2024-03-01  | Maintenance   | 2025-06-01  
1.2.0   | 2024-06-01  | Current       | TBD
2.0.0   | 2024-09-01  | Preview       | TBD
```

### 2. Deprecation Process

1. **Announcement**: New version released with deprecation notice
2. **Warning Period**: 6 months minimum with warnings in logs
3. **Migration Tools**: Provide automated migration utilities
4. **Support Overlap**: Maintain 2 major versions simultaneously
5. **Sunset**: Remove support with advance notice

### 3. Emergency Patches

```typescript
// Critical security fix across all supported versions
interface EmergencyPatch {
  affectedVersions: string[];
  patchVersion: string;
  securityLevel: 'critical' | 'high' | 'medium';
  autoApply: boolean;
}

const securityPatch: EmergencyPatch = {
  affectedVersions: ['1.0.0', '1.1.0', '1.2.0'],
  patchVersion: '1.2.1',
  securityLevel: 'critical',
  autoApply: true
};
```

## Testing Strategy

### 1. Compatibility Tests

```typescript
describe('Version Compatibility', () => {
  test('1.0.0 events validate against 1.1.0 schema', () => {
    const v1_0_event = createV1Event();
    const v1_1_validator = new SchemaValidator('1.1.0');
    
    expect(v1_1_validator.validate(v1_0_event)).toEqual({
      valid: true,
      errors: []
    });
  });
  
  test('Migration preserves data integrity', () => {
    const originalEvent = createV1Event();
    const migratedEvent = migrate(originalEvent, '1.0.0', '1.1.0');
    
    expect(migratedEvent.eventId).toBe(originalEvent.eventId);
    expect(migratedEvent.version).toBe('1.1.0');
    expect(migratedEvent.metadata.priority).toBe('normal');
  });
});
```

### 2. Performance Tests

```typescript
describe('Migration Performance', () => {
  test('Migration handles 10K+ events/second', async () => {
    const events = generateTestEvents(10000);
    const startTime = Date.now();
    
    const migratedEvents = events.map(event => 
      migrate(event, '1.0.0', '1.1.0')
    );
    
    const duration = Date.now() - startTime;
    const throughput = events.length / (duration / 1000);
    
    expect(throughput).toBeGreaterThan(10000);
  });
});
```

## Implementation Guidelines

### 1. Producer Guidelines

- Always specify version in events
- Use latest stable version by default
- Support version negotiation with consumers
- Validate events against target schema version

### 2. Consumer Guidelines  

- Handle multiple versions gracefully
- Use version-aware parsing
- Implement fallback behavior for unknown fields
- Log version mismatches for monitoring

### 3. Infrastructure Guidelines

- Store schemas in version control
- Implement schema registry for runtime access
- Monitor version distribution across services
- Provide migration utilities and documentation

## Monitoring and Metrics

### 1. Version Distribution Metrics

```typescript
interface VersionMetrics {
  eventsByVersion: Map<string, number>;
  migrationErrors: number;
  unsupportedVersions: number;
  averageMigrationTime: number;
}
```

### 2. Alerting Rules

- Alert on unsupported versions > 5%
- Alert on migration errors > 1% 
- Alert on deprecated version usage > 90 days
- Alert on schema validation failures

This versioning strategy ensures smooth evolution of event schemas while maintaining system stability and backward compatibility. 