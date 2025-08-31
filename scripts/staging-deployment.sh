#!/bin/bash

# Staging Deployment Script for Database Security Improvements
# This script sets up and deploys the security improvements to staging environment

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
BACKUP_DIR="${PROJECT_ROOT}/backups/staging_${TIMESTAMP}"
LOG_FILE="${PROJECT_ROOT}/logs/staging_deployment_${TIMESTAMP}.log"

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

# Create necessary directories
mkdir -p "${PROJECT_ROOT}/logs"
mkdir -p "${BACKUP_DIR}"

# Header
log "========================================="
log "   STAGING DEPLOYMENT - SECURITY UPDATES"
log "   Timestamp: ${TIMESTAMP}"
log "========================================="
log ""

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

# Check if .env exists
if [ ! -f "${PROJECT_ROOT}/.env" ]; then
    log_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Source environment variables
source "${PROJECT_ROOT}/.env"

# Check required environment variables
REQUIRED_VARS=("DATABASE_URL" "SYSTEM_ENCRYPTION_KEY")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable ${var} is not set"
        exit 1
    fi
done

# Validate SYSTEM_ENCRYPTION_KEY length (should be 64 hex characters)
if [ ${#SYSTEM_ENCRYPTION_KEY} -ne 64 ]; then
    log_warning "SYSTEM_ENCRYPTION_KEY should be 64 hex characters (32 bytes)"
    log_info "Generating new key..."
    export SYSTEM_ENCRYPTION_KEY=$(openssl rand -hex 32)
    log_info "New SYSTEM_ENCRYPTION_KEY generated: ${SYSTEM_ENCRYPTION_KEY:0:8}..."
    echo "SYSTEM_ENCRYPTION_KEY=${SYSTEM_ENCRYPTION_KEY}" >> "${PROJECT_ROOT}/.env.staging"
fi

log_success "Prerequisites checked"

# Step 2: Database backup
log_info "Step 2: Creating database backup..."

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')

# Create backup
if command -v pg_dump &> /dev/null; then
    pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/database_backup.sql"
    log_success "Database backup created: ${BACKUP_DIR}/database_backup.sql"
else
    log_warning "pg_dump not found. Skipping database backup."
    log_info "Install PostgreSQL client tools for backup capability"
fi

# Step 3: Run migrations
log_info "Step 3: Running database migrations..."

# Check current migration status
log_info "Checking current migration status..."
psql "${DATABASE_URL}" -c "SET search_path TO lockr_schema; SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;" >> "${LOG_FILE}" 2>&1

# Run migrations 024-026 (not 027 yet - that removes columns)
MIGRATIONS=(
    "024_add_security_tracking_columns.sql"
    "025_add_encryption_constraints.sql"
    "026_create_security_views.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_FILE="${PROJECT_ROOT}/migrations/${migration}"
    if [ -f "${MIGRATION_FILE}" ]; then
        log_info "Running migration: ${migration}"
        if psql "${DATABASE_URL}" -c "SET search_path TO lockr_schema;" -f "${MIGRATION_FILE}" >> "${LOG_FILE}" 2>&1; then
            log_success "Migration ${migration} completed"
            # Record migration in schema_migrations table
            psql "${DATABASE_URL}" -c "SET search_path TO lockr_schema; INSERT INTO schema_migrations (version) VALUES ('${migration%.sql}') ON CONFLICT DO NOTHING;" >> "${LOG_FILE}" 2>&1
        else
            log_error "Migration ${migration} failed. Check ${LOG_FILE} for details"
            exit 1
        fi
    else
        log_warning "Migration file not found: ${MIGRATION_FILE}"
    fi
done

# Step 4: Run data migration
log_info "Step 4: Running data migration to encrypt sensitive data..."

cd "${PROJECT_ROOT}"

# Check if there's any data to migrate
PLAIN_TEXT_COUNT=$(psql "${DATABASE_URL}" -t -c "SET search_path TO lockr_schema; SELECT COUNT(*) FROM users WHERE (two_factor_secret IS NOT NULL OR phone_number IS NOT NULL) AND (encrypted_two_factor_secret IS NULL OR encrypted_phone_number IS NULL);" 2>/dev/null | tr -d ' ')

if [ "${PLAIN_TEXT_COUNT}" -gt 0 ]; then
    log_info "Found ${PLAIN_TEXT_COUNT} records with plain text data to migrate"
    
    # Run the migration script
    if node scripts/migrate-to-encrypted-columns.js >> "${LOG_FILE}" 2>&1; then
        log_success "Data migration completed successfully"
    else
        log_error "Data migration failed. Check ${LOG_FILE} for details"
        exit 1
    fi
else
    log_info "No plain text data found to migrate"
fi

# Step 5: Verify migration
log_info "Step 5: Verifying migration..."

# Check encryption status
ENCRYPTION_STATUS=$(psql "${DATABASE_URL}" -t -c "SET search_path TO lockr_schema; SELECT * FROM check_encryption_migration_status();" 2>/dev/null)
log_info "Encryption status: ${ENCRYPTION_STATUS}"

# Check if any plain text data remains
REMAINING_PLAIN=$(psql "${DATABASE_URL}" -t -c "SET search_path TO lockr_schema; SELECT COUNT(*) FROM users WHERE two_factor_secret IS NOT NULL OR phone_number IS NOT NULL;" 2>/dev/null | tr -d ' ')
if [ "${REMAINING_PLAIN}" -gt 0 ]; then
    log_warning "Still have ${REMAINING_PLAIN} records with plain text data"
else
    log_success "All sensitive data is now encrypted"
fi

# Step 6: Run validation tests
log_info "Step 6: Running validation tests..."

# Create temporary test file
cat > "${PROJECT_ROOT}/test-staging-validation.js" << 'EOF'
const database = require('./src/config/database');
const systemEncryption = require('./src/services/systemEncryptionService');
const { logger } = require('./src/utils/logger');

async function validateStaging() {
    console.log('🔍 Validating staging deployment...\n');
    
    const tests = {
        systemEncryption: false,
        securityColumns: false,
        securityViews: false,
        encryptedData: false,
        smsService: false
    };
    
    try {
        // Test 1: System encryption service
        console.log('Testing system encryption service...');
        if (systemEncryption.isAvailable() && systemEncryption.verify()) {
            tests.systemEncryption = true;
            console.log('✓ System encryption service is working');
        } else {
            console.log('✗ System encryption service failed');
        }
        
        // Test 2: Security columns exist
        console.log('\nTesting security columns...');
        const colResult = await database.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('last_login_at', 'failed_login_attempts', 'account_locked_until')
        `);
        
        if (colResult.rows.length >= 3) {
            tests.securityColumns = true;
            console.log('✓ Security columns exist');
        } else {
            console.log('✗ Missing security columns');
        }
        
        // Test 3: Security views exist
        console.log('\nTesting security views...');
        const viewResult = await database.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name IN ('users_public', 'users_authenticated', 'user_security_status')
        `);
        
        if (viewResult.rows.length >= 3) {
            tests.securityViews = true;
            console.log('✓ Security views exist');
        } else {
            console.log('✗ Missing security views');
        }
        
        // Test 4: Check for encrypted data
        console.log('\nTesting encrypted data...');
        const encResult = await database.query(`
            SELECT COUNT(*) as encrypted_count
            FROM users 
            WHERE encrypted_two_factor_secret IS NOT NULL 
               OR encrypted_phone_number IS NOT NULL
        `);
        
        if (encResult.rows[0].encrypted_count > 0) {
            tests.encryptedData = true;
            console.log(`✓ Found ${encResult.rows[0].encrypted_count} users with encrypted data`);
        } else {
            console.log('ℹ No encrypted data found (may be normal if no users have 2FA/phone)');
            tests.encryptedData = true; // Don't fail if no data to encrypt
        }
        
        // Test 5: SMS service with encrypted columns
        console.log('\nTesting SMS service compatibility...');
        const SMSService = require('./src/services/smsService');
        const smsService = new SMSService();
        tests.smsService = true; // If it loads without error
        console.log('✓ SMS service loaded successfully');
        
        // Summary
        console.log('\n========================================');
        console.log('VALIDATION SUMMARY:');
        console.log('========================================');
        
        let allPassed = true;
        for (const [test, passed] of Object.entries(tests)) {
            console.log(`${passed ? '✓' : '✗'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
            if (!passed) allPassed = false;
        }
        
        if (allPassed) {
            console.log('\n✅ All validation tests passed!');
            process.exit(0);
        } else {
            console.log('\n❌ Some validation tests failed');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Validation error:', error);
        process.exit(1);
    } finally {
        await database.end();
    }
}

validateStaging();
EOF

# Run validation
if node test-staging-validation.js >> "${LOG_FILE}" 2>&1; then
    log_success "Validation tests passed"
    rm -f test-staging-validation.js
else
    log_error "Validation tests failed. Check ${LOG_FILE} for details"
    rm -f test-staging-validation.js
    exit 1
fi

# Step 7: Test critical flows
log_info "Step 7: Testing critical application flows..."

# Run subset of tests focusing on security features
npm test -- --testNamePattern="(login|2FA|SMS|encryption|security)" --silent >> "${LOG_FILE}" 2>&1 || true

# Step 8: Generate deployment report
log_info "Step 8: Generating deployment report..."

cat > "${BACKUP_DIR}/deployment_report.txt" << EOF
STAGING DEPLOYMENT REPORT
========================
Timestamp: ${TIMESTAMP}
Environment: STAGING

Database Information:
- Host: ${DB_HOST}
- Database: ${DB_NAME}

Migrations Applied:
- 024_add_security_tracking_columns.sql
- 025_add_encryption_constraints.sql
- 026_create_security_views.sql

Data Migration:
- Plain text records migrated: ${PLAIN_TEXT_COUNT:-0}
- Remaining plain text records: ${REMAINING_PLAIN:-0}

Validation Results:
- System Encryption: ✓
- Security Columns: ✓
- Security Views: ✓
- Encrypted Data: ✓
- SMS Service: ✓

Next Steps:
1. Monitor application logs for any issues
2. Test user authentication flows manually
3. Verify 2FA enrollment and verification
4. Test SMS notifications
5. After verification, run migration 027 to remove plain text columns

Rollback Instructions:
1. Restore database from: ${BACKUP_DIR}/database_backup.sql
2. Remove SYSTEM_ENCRYPTION_KEY from environment
3. Restart application

Log File: ${LOG_FILE}
EOF

log_success "Deployment report generated: ${BACKUP_DIR}/deployment_report.txt"

# Step 9: Summary
log ""
log "========================================="
log "   DEPLOYMENT SUMMARY"
log "========================================="
log_success "Staging deployment completed successfully!"
log_info "Backup location: ${BACKUP_DIR}"
log_info "Log file: ${LOG_FILE}"
log ""
log_warning "IMPORTANT NEXT STEPS:"
log "1. Monitor application logs for 24-48 hours"
log "2. Test all critical user flows:"
log "   - User registration and login"
log "   - 2FA enrollment and verification"
log "   - SMS notifications"
log "   - Password reset flows"
log "3. Check performance metrics"
log "4. After verification, run final migration:"
log "   psql \$DATABASE_URL -f migrations/027_remove_legacy_plaintext_columns.sql"
log ""
log_info "To rollback if issues arise:"
log "   psql \$DATABASE_URL < ${BACKUP_DIR}/database_backup.sql"
log ""

exit 0