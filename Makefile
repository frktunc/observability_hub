# ==============================================
# OBSERVABILITY HUB - Makefile
# ==============================================

.PHONY: help up down restart health logs clean build test lint format init

# Default target
help: ## Show this help message
	@echo "🚀 Observability Hub - Development Commands"
	@echo "=============================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==============================================
# INFRASTRUCTURE MANAGEMENT
# ==============================================

init: ## Initialize project and create .env file
	@echo "🔧 Initializing Observability Hub..."
	@if [ ! -f .env ]; then \
		cp env.example .env; \
		echo "✅ .env file created from template"; \
	else \
		echo "⚠️  .env file already exists"; \
	fi
	@chmod +x scripts/health-check.sh
	@echo "✅ Project initialized successfully!"

up: ## Start all services
	@echo "🚀 Starting Observability Hub..."
	@echo ""
	@echo " _____  _____  _____ "
	@echo "|  ___|/  ___||_   _|"
	@echo "| |_   \ \`--.   | |  "
	@echo "|  _|   \`--. \  | |  "
	@echo "| |    /\__/ /  | |  "
	@echo "\_|    \____/   \_/  "
	@echo ""
	@docker-compose up -d
	@echo "⏳ Waiting for services to be ready..."
	@sleep 30
	@make health

down: ## Stop all services
	@echo "🛑 Stopping Observability Hub..."
	@docker-compose down

restart: ## Restart all services
	@echo "🔄 Restarting Observability Hub..."
	@docker-compose restart

stop: ## Stop all services (alias for down)
	@make down

# ==============================================
# HEALTH & MONITORING
# ==============================================

health: ## Run comprehensive health check
	@echo "🔍 Running health check..."
	@docker-compose run --rm health-check

health-quick: ## Quick health check (ports only)
	@echo "⚡ Quick health check..."
	@docker-compose ps

logs: ## Show logs for all services
	@docker-compose logs -f

logs-postgres: ## Show PostgreSQL logs
	@docker-compose logs -f postgres

logs-rabbitmq: ## Show RabbitMQ logs
	@docker-compose logs -f rabbitmq

logs-jaeger: ## Show Jaeger logs
	@docker-compose logs -f jaeger

logs-grafana: ## Show Grafana logs
	@docker-compose logs -f grafana

logs-redis: ## Show Redis logs
	@docker-compose logs -f redis

# ==============================================
# DATABASE MANAGEMENT
# ==============================================

db-connect: ## Connect to PostgreSQL database
	@echo "🔗 Connecting to PostgreSQL..."
	@docker-compose exec postgres psql -U obs_user -d observability_db

db-reset: ## Reset database (WARNING: This will delete all data!)
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker-compose stop postgres
	@docker volume rm observability_hub_postgres_data || true
	@docker-compose up -d postgres
	@echo "✅ Database reset completed"

db-backup: ## Create database backup
	@echo "💾 Creating database backup..."
	@mkdir -p backups
	@docker-compose exec postgres pg_dump -U obs_user -d observability_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Database backup created in backups/"

db-restore: ## Restore database from backup (set BACKUP_FILE=filename)
	@echo "🔄 Restoring database from backup..."
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "❌ Please specify BACKUP_FILE=filename"; \
		exit 1; \
	fi
	@docker-compose exec -T postgres psql -U obs_user -d observability_db < backups/$(BACKUP_FILE)
	@echo "✅ Database restored from $(BACKUP_FILE)"

# ==============================================
# MESSAGING MANAGEMENT
# ==============================================

rabbitmq-reset: ## Reset RabbitMQ (WARNING: This will delete all messages!)
	@echo "⚠️  WARNING: This will delete all messages!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker-compose stop rabbitmq
	@docker volume rm observability_hub_rabbitmq_data || true
	@docker-compose up -d rabbitmq
	@echo "✅ RabbitMQ reset completed"

rabbitmq-management: ## Open RabbitMQ Management UI
	@echo "🌐 Opening RabbitMQ Management UI..."
	@open http://localhost:15672 || echo "Please open http://localhost:15672 in your browser"

# ==============================================
# MONITORING & DASHBOARDS
# ==============================================

jaeger-ui: ## Open Jaeger UI
	@echo "🕵️  Opening Jaeger UI..."
	@open http://localhost:16686 || echo "Please open http://localhost:16686 in your browser"

grafana-ui: ## Open Grafana UI
	@echo "📊 Opening Grafana UI..."
	@open http://localhost:3000 || echo "Please open http://localhost:3000 in your browser"

dashboards: ## Open all monitoring dashboards
	@echo "🎯 Opening all dashboards..."
	@make rabbitmq-management &
	@make jaeger-ui &
	@make grafana-ui &
	@echo "✅ All dashboards should be opening in your browser"

# ==============================================
# DEVELOPMENT & TESTING
# ==============================================

test: ## Run integration tests
	@echo "🧪 Running integration tests..."
	@docker-compose run --rm health-check
	@echo "✅ Integration tests completed"

test-rabbitmq: ## Test RabbitMQ message publishing
	@echo "🐰 Testing RabbitMQ message publishing..."
	@docker-compose exec rabbitmq rabbitmqctl list_queues -p /observability

test-postgres: ## Test PostgreSQL connection and queries
	@echo "🐘 Testing PostgreSQL..."
	@docker-compose exec postgres psql -U obs_user -d observability_db -c "SELECT COUNT(*) FROM logs;"

# ==============================================
# MAINTENANCE & CLEANUP
# ==============================================

clean: ## Clean up Docker resources
	@echo "🧹 Cleaning up Docker resources..."
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@echo "✅ Cleanup completed"

clean-all: ## Clean up everything (including volumes)
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker-compose down -v --remove-orphans
	@docker volume rm observability_hub_postgres_data observability_hub_rabbitmq_data observability_hub_grafana_data observability_hub_jaeger_data || true
	@docker system prune -f
	@echo "✅ Complete cleanup finished"

update: ## Update all Docker images
	@echo "⬆️  Updating Docker images..."
	@docker-compose pull
	@docker-compose up -d
	@echo "✅ Update completed"

# ==============================================
# DEVELOPMENT UTILITIES
# ==============================================

format: ## Format configuration files
	@echo "🎨 Formatting configuration files..."
	@# Format JSON files
	@find . -name "*.json" -type f -exec python -m json.tool {} {}.tmp \; -exec mv {}.tmp {} \;
	@echo "✅ Configuration files formatted"

validate: ## Validate configuration files
	@echo "✅ Validating configuration files..."
	@docker-compose config --quiet
	@echo "✅ Docker Compose configuration is valid"

info: ## Show system information
	@echo "📋 System Information"
	@echo "===================="
	@echo "Docker version: $(shell docker --version)"
	@echo "Docker Compose version: $(shell docker-compose --version)"
	@echo "OS: $(shell uname -s)"
	@echo "Architecture: $(shell uname -m)"
	@echo ""
	@echo "📊 Container Status"
	@echo "=================="
	@docker-compose ps
	@echo ""
	@echo "💾 Volume Usage"
	@echo "=============="
	@docker volume ls | grep observability_hub || echo "No volumes found"

# ==============================================
# PRODUCTION UTILITIES
# ==============================================

backup-all: ## Create complete backup (database + configs)
	@echo "💾 Creating complete backup..."
	@mkdir -p backups
	@make db-backup
	@tar -czf backups/config_backup_$(shell date +%Y%m%d_%H%M%S).tar.gz infrastructure/ env.example docker-compose.yml
	@echo "✅ Complete backup created in backups/"

deploy-check: ## Check if system is ready for deployment
	@echo "🔍 Checking deployment readiness..."
	@make validate
	@make health
	@echo "✅ System is ready for deployment"

# ==============================================
# HELP & DOCUMENTATION
# ==============================================

urls: ## Show all service URLs
	@echo "🌐 Service URLs"
	@echo "=============="
	@echo "RabbitMQ Management: http://localhost:15672"
	@echo "Jaeger UI: http://localhost:16686"
	@echo "Grafana: http://localhost:3000"
	@echo "PostgreSQL: localhost:5433"
	@echo "Redis: localhost:6379"
	@echo ""
	@echo "🔐 Default Credentials"
	@echo "===================="
	@echo "RabbitMQ: obs_user / obs_secure_password_2024"
	@echo "Grafana: admin / admin123"
	@echo "PostgreSQL: obs_user / obs_secure_password_2024"
