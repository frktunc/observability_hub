#!/bin/bash

# ==============================================
# OBSERVABILITY HUB - Health Check Script
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}
POSTGRES_DB=${POSTGRES_DB:-observability_db}
POSTGRES_USER=${POSTGRES_USER:-obs_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-obs_password}

RABBITMQ_HOST=${RABBITMQ_HOST:-localhost}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}
RABBITMQ_MANAGEMENT_PORT=${RABBITMQ_MANAGEMENT_PORT:-15672}
RABBITMQ_USER=${RABBITMQ_USER:-obs_user}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD:-obs_password}

JAEGER_HOST=${JAEGER_HOST:-localhost}
JAEGER_PORT=${JAEGER_UI_PORT:-16686}

GRAFANA_HOST=${GRAFANA_HOST:-localhost}
GRAFANA_PORT=${GRAFANA_PORT:-3000}

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

# Functions
print_status() {
    local status=$1
    local message=$2
    
    if [ "$status" == "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" == "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

check_port() {
    local host=$1
    local port=$2
    local service=$3
    
    if nc -z "$host" "$port" 2>/dev/null; then
        print_status "OK" "$service is running on $host:$port"
        return 0
    else
        print_status "ERROR" "$service is not accessible on $host:$port"
        return 1
    fi
}

check_http_endpoint() {
    local url=$1
    local service=$2
    local expected_status=${3:-200}
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status_code" == "$expected_status" ]; then
        print_status "OK" "$service HTTP endpoint is responding ($status_code)"
        return 0
    else
        print_status "ERROR" "$service HTTP endpoint failed (status: $status_code)"
        return 1
    fi
}

check_postgres() {
    echo "=== PostgreSQL Health Check ==="
    
    if check_port "$POSTGRES_HOST" "$POSTGRES_PORT" "PostgreSQL"; then
        # Test database connection
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" >/dev/null 2>&1; then
            print_status "OK" "PostgreSQL database connection successful"
            
            # Check table existence
            local tables=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
            print_status "OK" "PostgreSQL has $tables tables"
            
            return 0
        else
            print_status "ERROR" "PostgreSQL database connection failed"
            return 1
        fi
    else
        return 1
    fi
}

check_rabbitmq() {
    echo "=== RabbitMQ Health Check ==="
    
    if check_port "$RABBITMQ_HOST" "$RABBITMQ_PORT" "RabbitMQ AMQP"; then
        if check_http_endpoint "http://$RABBITMQ_HOST:$RABBITMQ_MANAGEMENT_PORT" "RabbitMQ Management"; then
            # Check RabbitMQ API
            local api_response=$(curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" "http://$RABBITMQ_HOST:$RABBITMQ_MANAGEMENT_PORT/api/overview" 2>/dev/null || echo "error")
            
            if [[ "$api_response" == *"rabbitmq_version"* ]]; then
                print_status "OK" "RabbitMQ API is responding"
                
                # Check vhost
                local vhost_response=$(curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" "http://$RABBITMQ_HOST:$RABBITMQ_MANAGEMENT_PORT/api/vhosts/%2Fobservability" 2>/dev/null || echo "error")
                
                if [[ "$vhost_response" == *"observability"* ]]; then
                    print_status "OK" "RabbitMQ vhost '/observability' exists"
                else
                    print_status "WARNING" "RabbitMQ vhost '/observability' not found"
                fi
                
                return 0
            else
                print_status "ERROR" "RabbitMQ API is not responding correctly"
                return 1
            fi
        else
            return 1
        fi
    else
        return 1
    fi
}

check_jaeger() {
    echo "=== Jaeger Health Check ==="
    
    if check_port "$JAEGER_HOST" "$JAEGER_PORT" "Jaeger UI"; then
        if check_http_endpoint "http://$JAEGER_HOST:$JAEGER_PORT/" "Jaeger UI"; then
            # Check Jaeger API
            local api_response=$(curl -s "http://$JAEGER_HOST:$JAEGER_PORT/api/services" 2>/dev/null || echo "error")
            
            if [[ "$api_response" == *"data"* ]]; then
                print_status "OK" "Jaeger API is responding"
                return 0
            else
                print_status "WARNING" "Jaeger API may not be fully ready"
                return 0
            fi
        else
            return 1
        fi
    else
        return 1
    fi
}

check_grafana() {
    echo "=== Grafana Health Check ==="
    
    if check_port "$GRAFANA_HOST" "$GRAFANA_PORT" "Grafana"; then
        if check_http_endpoint "http://$GRAFANA_HOST:$GRAFANA_PORT/api/health" "Grafana Health"; then
            # Check Grafana login
            local login_response=$(curl -s "http://$GRAFANA_HOST:$GRAFANA_PORT/login" 2>/dev/null || echo "error")
            
            if [[ "$login_response" == *"grafana"* ]]; then
                print_status "OK" "Grafana login page is accessible"
                return 0
            else
                print_status "WARNING" "Grafana login page may not be ready"
                return 0
            fi
        else
            return 1
        fi
    else
        return 1
    fi
}

check_redis() {
    echo "=== Redis Health Check ==="
    
    if check_port "$REDIS_HOST" "$REDIS_PORT" "Redis"; then
        # Test Redis connection
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
            print_status "OK" "Redis connection successful"
            
            # Check Redis info
            local redis_info=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info server 2>/dev/null | grep redis_version || echo "")
            if [[ -n "$redis_info" ]]; then
                print_status "OK" "Redis server info: $redis_info"
            fi
            
            return 0
        else
            print_status "ERROR" "Redis connection failed"
            return 1
        fi
    else
        return 1
    fi
}

# Main execution
main() {
    echo "================================================="
    echo "🔍 OBSERVABILITY HUB - Health Check"
    echo "================================================="
    echo
    
    local overall_status=0
    
    # Check all services
    check_postgres || overall_status=1
    echo
    
    check_rabbitmq || overall_status=1
    echo
    
    check_jaeger || overall_status=1
    echo
    
    check_grafana || overall_status=1
    echo
    
    check_redis || overall_status=1
    echo
    
    # Summary
    echo "================================================="
    if [ $overall_status -eq 0 ]; then
        print_status "OK" "All services are healthy! 🎉"
        echo
        echo "🌐 Access URLs:"
        echo "   • RabbitMQ Management: http://$RABBITMQ_HOST:$RABBITMQ_MANAGEMENT_PORT"
        echo "   • Jaeger UI: http://$JAEGER_HOST:$JAEGER_PORT"
        echo "   • Grafana: http://$GRAFANA_HOST:$GRAFANA_PORT"
        echo
        echo "🔐 Default Credentials:"
        echo "   • RabbitMQ: $RABBITMQ_USER / $RABBITMQ_PASSWORD"
        echo "   • Grafana: admin / admin123"
    else
        print_status "ERROR" "Some services are not healthy! Please check the logs."
    fi
    echo "================================================="
    
    exit $overall_status
}

# Execute main function
main "$@" 