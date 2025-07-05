# 🔍 Observability Hub - Infrastructure Foundation

Production-ready infrastructure for event-driven logging platform with distributed tracing, metrics collection, and real-time monitoring.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Log Services  │───▶│    RabbitMQ     │───▶│   Collector     │
│   (TypeScript)  │    │   (Message      │    │   Service (Go)  │
│                 │    │    Broker)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Grafana     │◀───│   PostgreSQL    │◀───│   Data Store    │
│   (Dashboards)  │    │   (Database)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Jaeger      │◀───│     Redis       │◀───│     Caching     │
│   (Tracing)     │    │   (Caching)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, for convenience commands)
- 8GB RAM minimum, 16GB recommended
- 10GB free disk space

### 1. Initialize Project

```bash
make init
```

This will:
- Create `.env` file from template
- Set executable permissions on scripts
- Prepare the project structure

### 2. Start All Services

```bash
make up
```

This will:
- Start all infrastructure services
- Wait for services to be ready
- Run health checks automatically

### 3. Verify Installation

```bash
make health
```

Expected output:
```
🔍 OBSERVABILITY HUB - Health Check
=================================================
✅ PostgreSQL is running on localhost:5433
✅ RabbitMQ is running on localhost:5672
✅ Jaeger is running on localhost:16686
✅ Grafana is running on localhost:3000
✅ Redis is running on localhost:6379
✅ All services are healthy! 🎉
```

## 🌐 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| RabbitMQ Management | http://localhost:15672 | `obs_user` / `obs_secure_password_2024` |
| Jaeger UI | http://localhost:16686 | No auth required |
| Grafana | http://localhost:3000 | `admin` / `admin123` |
| PostgreSQL | localhost:5433 | `obs_user` / `obs_secure_password_2024` |
| Redis | localhost:6379 | No auth required |

## 🛠️ Development Commands

### Infrastructure Management
```bash
make up          # Start all services
make down        # Stop all services
make restart     # Restart all services
make health      # Run health checks
make logs        # Show all logs
```

### Database Management
```bash
make db-connect  # Connect to PostgreSQL
make db-backup   # Create database backup
make db-reset    # Reset database (WARNING: deletes data)
```

### Monitoring & Dashboards
```bash
make dashboards     # Open all monitoring UIs
make rabbitmq-management  # Open RabbitMQ Management
make jaeger-ui      # Open Jaeger UI
make grafana-ui     # Open Grafana UI
```

### Testing & Validation
```bash
make test           # Run integration tests
make test-rabbitmq  # Test RabbitMQ messaging
make test-postgres  # Test PostgreSQL connection
make validate       # Validate configurations
```

### Maintenance
```bash
make clean          # Clean up Docker resources
make clean-all      # Clean everything (WARNING: deletes data)
make backup-all     # Create complete backup
make update         # Update all Docker images
```

## 📊 Database Schema

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `logs` | Store log entries | correlation_id, trace_id, metadata (JSONB) |
| `metrics` | Store metrics data | name, value, labels (JSONB) |
| `traces` | Store trace spans | trace_id, span_id, operation_name |
| `health_checks` | Store health status | service_name, status, response_time |
| `alerts` | Store alert events | severity, correlation_id, resolved |
| `dead_letter_queue` | Store failed messages | retry_count, error_message |

### Indexes & Performance

- Optimized indexes for correlation_id, trace_id, timestamps
- JSONB indexes for metadata queries
- Automatic updated_at triggers
- Performance-tuned PostgreSQL configuration

## 🐰 RabbitMQ Configuration

### Exchanges & Queues

| Exchange | Type | Queues | Purpose |
|----------|------|--------|---------|
| `logs.topic` | topic | logs.collector, logs.info, logs.warning, logs.error | Log routing |
| `metrics.topic` | topic | metrics.collector | Metrics collection |
| `traces.topic` | topic | traces.collector | Trace collection |
| `alerts.topic` | topic | alerts.processor | Alert processing |
| `health.topic` | topic | health.monitor | Health monitoring |

### Dead Letter Queues

- Automatic retry mechanism (3 attempts)
- Failed messages go to DLQ for manual processing
- TTL and message limits configured

## 🔧 Configuration

### Environment Variables

Key variables in `.env`:

```bash
# Database
POSTGRES_DB=observability_db
POSTGRES_USER=obs_user
POSTGRES_PASSWORD=obs_secure_password_2024

# RabbitMQ
RABBITMQ_USER=obs_user
RABBITMQ_PASSWORD=obs_secure_password_2024
RABBITMQ_VHOST=/observability

# Monitoring
JAEGER_UI_PORT=16686
GRAFANA_PORT=3000
```

### Performance Tuning

**PostgreSQL:**
- Shared buffers: 128MB
- Work memory: 4MB
- Max connections: 200
- Optimized checkpoint settings

**RabbitMQ:**
- Memory high watermark: 60%
- Max connections: 1000
- Queue TTL and limits configured
- HA policies for all queues

**Resource Limits:**
- PostgreSQL: 512MB RAM limit
- RabbitMQ: 512MB RAM limit
- Jaeger: 512MB RAM limit
- Grafana: 256MB RAM limit
- Redis: 128MB RAM limit

## 🚨 Health Monitoring

### Automated Health Checks

The system includes comprehensive health monitoring:

1. **Port Availability:** All services listening on expected ports
2. **Database Connectivity:** PostgreSQL connection and query tests
3. **Message Broker:** RabbitMQ API and vhost validation
4. **Tracing System:** Jaeger UI and API responsiveness
5. **Dashboards:** Grafana health endpoint checks
6. **Caching:** Redis ping and info commands

### Health Check Script

```bash
./scripts/health-check.sh
```

Features:
- Colored output for easy reading
- Detailed error reporting
- Service-specific validation
- Overall system status

## 🔒 Security Features

### Network Security
- Isolated Docker network (172.20.0.0/16)
- No external exposure of internal services
- Configurable port mappings

### Authentication
- Default credentials for development
- Environment-based configuration
- Production override examples

### Data Protection
- Persistent volumes for data safety
- Backup and restore capabilities
- Graceful shutdown procedures

## 📈 Monitoring & Observability

### Metrics Collection
- PostgreSQL performance metrics
- RabbitMQ queue statistics
- Container resource usage
- Custom application metrics

### Distributed Tracing
- Jaeger integration ready
- Correlation ID tracking
- Span and trace visualization
- Service dependency mapping

### Log Aggregation
- Structured log storage
- Metadata and context preservation
- Query optimization
- Real-time log streaming

## 🚀 Production Deployment

### Prerequisites
- Docker Swarm or Kubernetes
- Load balancer for high availability
- Persistent storage backend
- Monitoring and alerting system

### Security Hardening
1. Change default passwords
2. Enable TLS/SSL encryption
3. Configure firewall rules
4. Set up authentication systems
5. Enable audit logging

### Scaling Considerations
- Database connection pooling
- RabbitMQ cluster setup
- Horizontal service scaling
- Load balancing configuration

## 🐛 Troubleshooting

### Common Issues

**Services not starting:**
```bash
make logs           # Check service logs
make health-quick   # Quick port check
docker-compose ps   # Container status
```

**Database connection failed:**
```bash
make db-connect     # Test connection
make logs-postgres  # Check PostgreSQL logs
```

**RabbitMQ not accessible:**
```bash
make logs-rabbitmq  # Check RabbitMQ logs
make test-rabbitmq  # Test messaging
```

### Recovery Procedures

**Reset single service:**
```bash
docker-compose restart [service-name]
```

**Complete system reset:**
```bash
make clean-all      # WARNING: Deletes all data
make up             # Restart from clean state
```

## 📝 Development Notes

### Adding New Services
1. Add service to `docker-compose.yml`
2. Update health check script
3. Add Makefile commands
4. Update documentation

### Database Migrations
- Add new migration files to `infrastructure/postgres/init/`
- Files are executed in alphabetical order
- Use `02-`, `03-` prefixes for ordering

### Custom Dashboards
- Add dashboard JSON files to `infrastructure/grafana/dashboards/`
- Use provisioning for automatic dashboard loading
- Configure data sources in `infrastructure/grafana/provisioning/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `make test`
4. Validate configuration with `make validate`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Next Steps

This infrastructure foundation is ready for:
1. **Log Service Development** (TypeScript microservices)
2. **Collector Service Implementation** (Go-based message processor)
3. **Custom Dashboard Creation** (Grafana visualizations)
4. **Alert Rule Configuration** (Monitoring and alerting)
5. **Performance Optimization** (Production tuning)

Ready to build your observability platform! 🚀 