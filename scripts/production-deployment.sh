#!/bin/bash

# Production Deployment Script for Database Security Improvements
# This script manages the production deployment of security enhancements

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_ROOT}/backups/production_${TIMESTAMP}"
LOG_FILE="${PROJECT_ROOT}/logs/production_deployment_${TIMESTAMP}.log"

# Deployment mode (staging|production)
DEPLOYMENT_MODE="${1:-staging}"

# Function to log messages
log() {
    echo -e "${1}" | tee -a "${LOG_FILE}"
}

# Function to log errors
log_error() {
    echo -e "${RED}ERROR: ${1}${NC}" | tee -a "${LOG_FILE}"
}

# Function to log success
log_success() {
    echo -e "${GREEN}✓ ${1}${NC}" | tee -a "${LOG_FILE}"
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}" | tee -a "${LOG_FILE}"
}

# Function to log info
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}" | tee -a "${LOG_FILE}"
}

# Function to prompt for confirmation
confirm() {
    local prompt="${1}"
    local response
    
    echo -e "${YELLOW}${prompt}${NC}"
    read -p "Type 'yes' to continue, anything else to abort: " response
    
    if [ "${response}" != "yes" ]; then
        log_error "Deployment aborted by user"
        exit 1
    fi
}

# Create necessary directories
mkdir -p "${PROJECT_ROOT}/logs"
mkdir -p "${BACKUP_DIR}"

# Header
log "========================================="
log "   PRODUCTION DEPLOYMENT - SECURITY UPDATES"
log "   Mode: ${DEPLOYMENT_MODE}"
log "   Timestamp: ${TIMESTAMP}"
log "========================================="
log ""

# Check if running in production mode
if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    log_warning "⚠️  PRODUCTION DEPLOYMENT MODE ⚠️"
    log_warning "This will modify your production database!"
    confirm "Are you sure you want to deploy to PRODUCTION?"
fi

# Step 1: Pre-deployment checks
log_info "Step 1: Pre-deployment checks..."

# Check for required environment variables
if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    REQUIRED_VARS=("PRODUCTION_DATABASE_URL" "PRODUCTION_SYSTEM_ENCRYPTION_KEY")
    DATABASE_URL="${PRODUCTION_DATABASE_URL:-}"
    SYSTEM_ENCRYPTION_KEY="${PRODUCTION_SYSTEM_ENCRYPTION_KEY:-}"
else
    REQUIRED_VARS=("DATABASE_URL" "SYSTEM_ENCRYPTION_KEY")
    DATABASE_URL="${DATABASE_URL:-}"
    SYSTEM_ENCRYPTION_KEY="${SYSTEM_ENCRYPTION_KEY:-}"
fi

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable ${var} is not set"
        log_info "Please set the following in your .env file:"
        log_info "  ${var}=your-value-here"
        exit 1
    fi
done

# Validate SYSTEM_ENCRYPTION_KEY
if [ ${#SYSTEM_ENCRYPTION_KEY} -ne 64 ]; then
    log_error "SYSTEM_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
    log_info "Generate with: openssl rand -hex 32"
    exit 1
fi

log_success "Environment variables validated"

# Step 2: Create backup
log_info "Step 2: Creating database backup..."

# Extract database info
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')

log_info "Database: ${DB_NAME} on ${DB_HOST}"

# Create backup
if command -v pg_dump &> /dev/null; then
    log_info "Creating backup to: ${BACKUP_DIR}/database_backup.sql"
    if pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/database_backup.sql" 2>> "${LOG_FILE}"; then
        BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/database_backup.sql" | awk '{print $5}')
        log_success "Database backup created (${BACKUP_SIZE})"
        
        # Verify backup
        LINE_COUNT=$(wc -l < "${BACKUP_DIR}/database_backup.sql")
        if [ ${LINE_COUNT} -lt 100 ]; then
            log_error "Backup appears to be incomplete (only ${LINE_COUNT} lines)"
            exit 1
        fi
    else
        log_error "Failed to create database backup"
        exit 1
    fi
else
    log_error "pg_dump not found. Please install PostgreSQL client tools"
    exit 1
fi

# Step 3: Run pre-deployment tests
log_info "Step 3: Running pre-deployment tests..."

cd "${PROJECT_ROOT}"

# Check migration status
log_info "Checking migration status..."
if node migrations/run.js status >> "${LOG_FILE}" 2>&1; then
    log_success "Migration status checked"
else
    log_warning "Could not check migration status"
fi

# Step 4: Set maintenance mode (if production)
if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    log_info "Step 4: Setting maintenance mode..."
    
    # Add your maintenance mode command here
    # Examples:
    # heroku maintenance:on --app your-app
    # kubectl set env deployment/lockr MAINTENANCE_MODE=true
    # touch ${PROJECT_ROOT}/maintenance.flag
    
    log_warning "Remember to set maintenance mode manually if required"
    confirm "Have you set maintenance mode?"
fi

# Step 5: Deploy application code
log_info "Step 5: Deploying application code..."

if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    log_info "Push code to production..."
    # git push production main
    # or your deployment command
    log_warning "Remember to deploy code manually"
    confirm "Has the new code been deployed?"
else
    log_info "Skipping code deployment in staging mode"
fi

# Step 6: Run database migrations
log_info "Step 6: Running database migrations..."

# Set schema environment variable
export DB_SCHEMA="${DB_SCHEMA:-lockr_schema}"

# Run specific migrations for security improvements
MIGRATIONS=(
    "024_add_security_tracking_columns.sql"
    "025_add_encryption_constraints.sql"
    "026_create_security_views.sql"
)

log_info "Running security migrations..."
for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_FILE="${PROJECT_ROOT}/migrations/${migration}"
    if [ -f "${MIGRATION_FILE}" ]; then
        log_info "Applying migration: ${migration}"
        
        # Check if migration already applied
        MIGRATION_EXISTS=$(psql "${DATABASE_URL}" -t -c "SET search_path TO ${DB_SCHEMA}; SELECT COUNT(*) FROM schema_migrations WHERE filename = '${migration}';" 2>/dev/null | tr -d ' ' || echo "0")
        
        if [ "${MIGRATION_EXISTS}" = "0" ]; then
            if psql "${DATABASE_URL}" -c "SET search_path TO ${DB_SCHEMA};" -f "${MIGRATION_FILE}" >> "${LOG_FILE}" 2>&1; then
                # Record migration
                psql "${DATABASE_URL}" -c "SET search_path TO ${DB_SCHEMA}; INSERT INTO schema_migrations (filename) VALUES ('${migration}');" >> "${LOG_FILE}" 2>&1
                log_success "Migration ${migration} completed"
            else
                log_error "Migration ${migration} failed"
                log_info "Check ${LOG_FILE} for details"
                
                if [ "${DEPLOYMENT_MODE}" = "production" ]; then
                    log_error "CRITICAL: Production migration failed!"
                    log_info "Restore from backup: psql ${DATABASE_URL} < ${BACKUP_DIR}/database_backup.sql"
                fi
                exit 1
            fi
        else
            log_info "Migration ${migration} already applied"
        fi
    else
        log_warning "Migration file not found: ${MIGRATION_FILE}"
    fi
done

# Step 7: Run data encryption migration
log_info "Step 7: Running data encryption migration..."

# Check if there's data to migrate
PLAIN_TEXT_COUNT=$(psql "${DATABASE_URL}" -t -c "SET search_path TO ${DB_SCHEMA}; SELECT COUNT(*) FROM users WHERE (two_factor_secret IS NOT NULL OR phone_number IS NOT NULL) AND (encrypted_two_factor_secret IS NULL OR encrypted_phone_number IS NULL);" 2>/dev/null | tr -d ' ')

if [ "${PLAIN_TEXT_COUNT:-0}" -gt 0 ]; then
    log_info "Found ${PLAIN_TEXT_COUNT} records with plain text data to migrate"
    
    if [ "${DEPLOYMENT_MODE}" = "production" ]; then
        confirm "Ready to encrypt ${PLAIN_TEXT_COUNT} user records?"
    fi
    
    # Run the migration script
    if SYSTEM_ENCRYPTION_KEY="${SYSTEM_ENCRYPTION_KEY}" DATABASE_URL="${DATABASE_URL}" node scripts/migrate-to-encrypted-columns.js >> "${LOG_FILE}" 2>&1; then
        log_success "Data encryption completed"
    else
        log_error "Data encryption failed"
        exit 1
    fi
else
    log_info "No plain text data to migrate"
fi

# Step 8: Verify deployment
log_info "Step 8: Verifying deployment..."

# Check encryption status
log_info "Checking encryption status..."
ENCRYPTION_STATUS=$(psql "${DATABASE_URL}" -c "SET search_path TO ${DB_SCHEMA}; SELECT * FROM check_encryption_migration_status();" 2>/dev/null)
echo "${ENCRYPTION_STATUS}" >> "${LOG_FILE}"

# Run validation tests
if [ -f "${PROJECT_ROOT}/tests/staging-validation.test.js" ]; then
    log_info "Running validation tests..."
    if SYSTEM_ENCRYPTION_KEY="${SYSTEM_ENCRYPTION_KEY}" DATABASE_URL="${DATABASE_URL}" npm test tests/staging-validation.test.js >> "${LOG_FILE}" 2>&1; then
        log_success "Validation tests passed"
    else
        log_warning "Some validation tests failed - check ${LOG_FILE}"
    fi
fi

# Step 9: Health checks
log_info "Step 9: Running health checks..."

# Test database connectivity
if psql "${DATABASE_URL}" -c "SET search_path TO ${DB_SCHEMA}; SELECT COUNT(*) FROM users;" >> "${LOG_FILE}" 2>&1; then
    log_success "Database connectivity verified"
else
    log_error "Database connectivity check failed"
fi

# Check security views
VIEWS_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = '${DB_SCHEMA}' AND table_name LIKE 'user%';" 2>/dev/null | tr -d ' ')
if [ "${VIEWS_COUNT:-0}" -ge 5 ]; then
    log_success "Security views verified (${VIEWS_COUNT} views)"
else
    log_warning "Expected 5 security views, found ${VIEWS_COUNT}"
fi

# Step 10: Remove maintenance mode (if production)
if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    log_info "Step 10: Removing maintenance mode..."
    
    # Add your maintenance mode removal command here
    # heroku maintenance:off --app your-app
    # kubectl set env deployment/lockr MAINTENANCE_MODE=false
    # rm ${PROJECT_ROOT}/maintenance.flag
    
    log_warning "Remember to remove maintenance mode manually"
    confirm "Has maintenance mode been removed?"
fi

# Generate deployment report
log_info "Generating deployment report..."

cat > "${BACKUP_DIR}/deployment_report.txt" << EOF
PRODUCTION DEPLOYMENT REPORT
===========================
Timestamp: ${TIMESTAMP}
Environment: ${DEPLOYMENT_MODE}
Database: ${DB_NAME} on ${DB_HOST}

Migrations Applied:
- 024_add_security_tracking_columns.sql
- 025_add_encryption_constraints.sql
- 026_create_security_views.sql

Data Migration:
- Plain text records migrated: ${PLAIN_TEXT_COUNT:-0}

Backup Location: ${BACKUP_DIR}/database_backup.sql
Log File: ${LOG_FILE}

IMPORTANT NEXT STEPS:
1. Monitor application logs for errors
2. Test critical user flows
3. Check performance metrics
4. After 24-48 hours of stability, run migration 027 to remove plain text columns

Rollback Command:
psql ${DATABASE_URL} < ${BACKUP_DIR}/database_backup.sql
EOF

log_success "Deployment report saved to: ${BACKUP_DIR}/deployment_report.txt"

# Summary
log ""
log "========================================="
log "   DEPLOYMENT SUMMARY"
log "========================================="

if [ "${DEPLOYMENT_MODE}" = "production" ]; then
    log_success "PRODUCTION deployment completed successfully!"
    log_warning "CRITICAL: Monitor the application closely for the next 2 hours"
    log_info "Keep the team on standby"
else
    log_success "STAGING deployment completed successfully!"
    log_info "Test thoroughly before proceeding to production"
fi

log_info "Backup: ${BACKUP_DIR}"
log_info "Logs: ${LOG_FILE}"
log ""
log_info "Next steps:"
log "1. Monitor application performance"
log "2. Test all critical user flows"
log "3. Watch error logs: tail -f logs/app.log"
log "4. After 24-48 hours, run final migration to remove plain text columns:"
log "   psql \$DATABASE_URL -f migrations/027_remove_legacy_plaintext_columns.sql"
log ""

exit 0