# Database Security Improvements

## Overview
This document outlines the comprehensive security improvements made to the Lockr database schema, focusing on enhanced data protection, audit capabilities, and compliance with security best practices.

## Migration Files Created

### 1. `024_add_security_tracking_columns.sql`
**Purpose**: Adds security tracking and monitoring capabilities

**New Columns Added to `users` table**:
- `last_login_at` - Tracks last successful login timestamp
- `last_login_ip` - Records IP address of last login
- `failed_login_attempts` - Counter for consecutive failed login attempts
- `account_locked_until` - Auto-unlock timestamp for locked accounts
- `password_changed_at` - Tracks password change history
- `password_expires_at` - Password expiration management
- `last_activity_at` - User activity tracking
- `session_count` - Active session monitoring

**Features**:
- Automatic password change tracking via triggers
- Auto-unlock mechanism for locked accounts
- IP address format validation (IPv4 and IPv6)
- Performance-optimized indexes for security queries

### 2. `025_add_encryption_constraints.sql`
**Purpose**: Enforces encrypted data storage and prevents plain text storage

**Constraints Added**:
- `users_2fa_requires_encryption` - 2FA must use encrypted storage
- `users_phone_requires_encryption` - Phone numbers must be encrypted when verified
- `users_2fa_encryption_complete` - Ensures all encryption fields are present together
- `users_phone_encryption_complete` - Validates phone encryption field completeness

**Features**:
- Database-level enforcement of encryption policies
- Automatic plain text clearing when encryption is enabled
- Audit logging for security events
- Migration tracking indexes

### 3. `026_create_security_views.sql`
**Purpose**: Creates secure views for data access without exposing sensitive information

**Views Created**:
1. **`users_public`** - Minimal public information
2. **`users_authenticated`** - User's own data with masked sensitive fields
3. **`users_admin`** - Administrative view without secrets
4. **`user_security_status`** - Security metrics and risk scoring
5. **`user_activity_log`** - Consolidated audit trail

**Security Functions**:
- `get_user_public_info()` - Secure public data retrieval
- `check_encryption_migration_status()` - Migration monitoring

### 4. `027_remove_legacy_plaintext_columns.sql`
**Purpose**: Removes plain text columns after successful migration

**Actions**:
- Pre-migration validation to prevent data loss
- Creates backup table `users_legacy_data_backup`
- Removes `two_factor_secret` column
- Removes `phone_number` column
- Updates trigger functions for new schema

## Data Migration Script

### `migrate-to-encrypted-columns.js`
**Purpose**: Migrates plain text sensitive data to encrypted columns

**Features**:
- System-level AES-256-GCM encryption
- Transaction-based migration for data integrity
- Verification and rollback capabilities
- Progress logging and error handling
- Migration statistics reporting

**Usage**:
```bash
# Set system encryption key
export SYSTEM_ENCRYPTION_KEY="your-secure-key-here"

# Run migration (keeps plain text for verification)
node scripts/migrate-to-encrypted-columns.js

# Run migration and clear plain text
export CLEAR_PLAINTEXT=true
node scripts/migrate-to-encrypted-columns.js
```

## Implementation Steps

### Phase 1: Preparation
1. ✅ Create security tracking columns migration (024)
2. ✅ Create encryption constraints migration (025)
3. ✅ Create security views migration (026)
4. ✅ Create data migration script
5. ✅ Test migrations in development

### Phase 2: Data Migration
1. Take database backup
2. Run migration 024 (security tracking columns)
3. Run migration 025 (encryption constraints)
4. Run migration 026 (security views)
5. Execute data migration script
6. Verify all data is encrypted
7. Update application code to use encrypted columns

### Phase 3: Cleanup
1. Confirm application works with encrypted data
2. Run migration 027 to remove plain text columns
3. Monitor for any issues
4. Drop backup table after confirmation period

## Security Benefits

### 1. Enhanced Authentication Security
- Track failed login attempts
- Automatic account locking
- IP-based monitoring
- Password age tracking
- Session management

### 2. Data Protection
- AES-256-GCM encryption for sensitive data
- Database-level encryption enforcement
- No plain text storage of secrets
- Secure key derivation with salts

### 3. Audit & Compliance
- Comprehensive activity logging
- GDPR compliance features maintained
- Security event tracking
- Risk scoring system

### 4. Access Control
- Secure views prevent direct sensitive data access
- Role-based view permissions
- Masked data in non-admin views
- SECURITY DEFINER functions for controlled access

## Risk Assessment View

The `user_security_status` view provides automatic risk scoring:
- **100**: Account currently locked
- **80**: More than 5 failed login attempts
- **60**: 3-5 failed login attempts
- **40**: 2FA not enabled
- **30**: Email not verified
- **25**: Password older than 180 days
- **20**: No login in 90+ days
- **0**: No identified risks

## Monitoring Queries

```sql
-- Check migration status
SELECT * FROM check_encryption_migration_status();

-- View high-risk users
SELECT * FROM user_security_status WHERE risk_score > 50;

-- Recent security events
SELECT * FROM user_activity_log 
WHERE event_time > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY event_time DESC;

-- Check for accounts needing unlock
SELECT email, account_locked_until 
FROM users 
WHERE account_locked_until > CURRENT_TIMESTAMP;
```

## Rollback Plan

If issues arise during migration:

1. **Before running migration 027**:
   - Application can still fall back to plain text columns
   - Re-run data migration if needed

2. **After running migration 027**:
   - Restore from `users_legacy_data_backup` table
   - Restore from database backup
   - Re-add columns via migration reversal

## Testing Checklist

- [ ] All existing tests pass
- [ ] Login/logout works correctly
- [ ] 2FA enrollment and verification works
- [ ] Phone number verification works
- [ ] Password reset flows work
- [ ] Account locking/unlocking works
- [ ] Security views return correct data
- [ ] Encryption/decryption verified
- [ ] No plain text secrets in database

## Notes

- System encryption key must be securely stored (use key management service in production)
- Regular backups are essential before running migrations
- Monitor application logs during migration
- Consider running migrations during maintenance window
- Test thoroughly in staging environment first