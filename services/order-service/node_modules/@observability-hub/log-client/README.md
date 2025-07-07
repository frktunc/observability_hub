# @observability-hub/log-client

TypeScript client library for microservices logging.

## Installation

```bash
npm install @observability-hub/log-client
```

## Usage

```typescript
import { ObservabilityLogger } from '@observability-hub/log-client';

const logger = new ObservabilityLogger({
  serviceName: 'user-service',
  rabbitmqUrl: 'amqp://localhost:5672',
});

await logger.info('User created', { userId: '123' });
await logger.error('Failed to create user', error);
```

## Features

- Direct RabbitMQ publishing (no HTTP overhead)
- Automatic reconnection with circuit breaker
- Built-in metrics and performance tracking
- Business and security event logging
- Full TypeScript support