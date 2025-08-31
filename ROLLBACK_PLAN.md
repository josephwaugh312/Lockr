# Database Security Improvements - Rollback Plan

## Overview
This document provides step-by-step instructions for rolling back the database security improvements if critical issues are discovered after deployment.

## Rollback Triggers
Execute rollback if any of these conditions occur:
- ❌ Users cannot log in due to encryption issues
- ❌ 2FA verification fails for all users
- ❌ SMS services completely fail
- ❌ Database performance degrades > 50%
- ❌ Data corruption is detected
- ❌ Application crashes persistently

## Rollback Phases

### Phase 1: Immediate Response (< 5 minutes)
**Goal**: Restore service availability

1. **Switch to maintenance mode**
   ```bash
   # Set maintenance mode flag
   export MAINTENANCE_MODE=true
   
   # Or update in your deployment platform
   heroku config:set MAINTENANCE_MODE=true
   ```

2. **Disable problematic features**
   ```bash
   # Disable new security features via environment variables
   export DISABLE_SECURITY_TRACKING=true
   export USE_LEGACY_ENCRYPTION=true
   ```

3. **Restart application**
   ```bash
   npm run restart
   # or
   pm2 restart lockr
   # or
   heroku restart
   ```

### Phase 2: Database Rollback (5-15 minutes)
**Goal**: Restore database to pre-migration state

1. **Stop application to prevent data conflicts**
   ```bash
   npm run stop
   # or
   pm2 stop lockr
   ```

2. **Restore database from backup**
   ```bash
   # Locate your backup file
   BACKUP_FILE="backups/staging_[TIMESTAMP]/database_backup.sql"
   
   # Restore database
   psql $DATABASE_URL < $BACKUP_FILE
   ```

3. **If no backup available, reverse migrations manually**
   ```sql
   -- Connect to database
   psql $DATABASE_URL
   
   -- Drop security views
   DROP VIEW IF EXISTS user_activity_log CASCADE;
   DROP VIEW IF EXISTS user_security_status CASCADE;
   DROP VIEW IF EXISTS users_admin CASCADE;
   DROP VIEW IF EXISTS users_authenticated CASCADE;
   DROP VIEW IF EXISTS users_public CASCADE;
   
   -- Drop security tracking columns
   ALTER TABLE users 
   DROP COLUMN IF EXISTS last_login_at,
   DROP COLUMN IF EXISTS last_login_ip,
   DROP COLUMN IF EXISTS failed_login_attempts,
   DROP COLUMN IF EXISTS account_locked_until,
   DROP COLUMN IF EXISTS password_changed_at,
   DROP COLUMN IF EXISTS password_expires_at,
   DROP COLUMN IF EXISTS last_activity_at,
   DROP COLUMN IF EXISTS session_count;
   
   -- Drop constraints
   ALTER TABLE users 
   DROP CONSTRAINT IF EXISTS users_2fa_requires_encryption,
   DROP CONSTRAINT IF EXISTS users_phone_requires_encryption,
   DROP CONSTRAINT IF EXISTS users_2fa_encryption_complete,
   DROP CONSTRAINT IF EXISTS users_phone_encryption_complete;
   
   -- Drop triggers
   DROP TRIGGER IF EXISTS track_password_changes ON users;
   DROP TRIGGER IF EXISTS auto_unlock_accounts ON users;
   DROP TRIGGER IF EXISTS enforce_encryption_on_update ON users;
   
   -- Drop functions
   DROP FUNCTION IF EXISTS update_password_changed_at();
   DROP FUNCTION IF EXISTS check_account_lock_status();
   DROP FUNCTION IF EXISTS enforce_encryption_policy();
   DROP FUNCTION IF EXISTS check_encryption_migration_status();
   
   -- Remove migration records
   DELETE FROM schema_migrations 
   WHERE version IN (
     '024_add_security_tracking_columns',
     '025_add_encryption_constraints',
     '026_create_security_views',
     '027_remove_legacy_plaintext_columns'
   );
   ```

4. **Restore encrypted data to plain text (if migration 027 was applied)**
   ```sql
   -- Only if plain text columns were removed
   ALTER TABLE users 
   ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
   ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
   
   -- Restore from backup table if it exists
   UPDATE users u
   SET 
     two_factor_secret = b.two_factor_secret,
     phone_number = b.phone_number
   FROM users_legacy_data_backup b
   WHERE u.id = b.id;
   ```

### Phase 3: Code Rollback (10-20 minutes)
**Goal**: Revert application code changes

1. **Revert to previous git commit**
   ```bash
   # Find the commit before security changes
   git log --oneline -20
   
   # Revert to specific commit
   git revert --no-commit HEAD~1..HEAD
   git commit -m "Emergency rollback: Database security improvements"
   
   # Or reset hard (destructive)
   git reset --hard [COMMIT_HASH_BEFORE_CHANGES]
   ```

2. **Remove new files**
   ```bash
   rm -f src/services/systemEncryptionService.js
   rm -f scripts/migrate-to-encrypted-columns.js
   rm -f scripts/staging-deployment.sh
   rm -f tests/staging-validation.test.js
   ```

3. **Restore original files**
   ```bash
   # Restore from git
   git checkout HEAD~1 -- src/services/smsService.js
   git checkout HEAD~1 -- src/controllers/authController.js
   git checkout HEAD~1 -- src/models/userRepository.js
   git checkout HEAD~1 -- tests/services/sms.test.js
   ```

4. **Remove environment variables**
   ```bash
   # Remove from .env
   # Remove: SYSTEM_ENCRYPTION_KEY=...
   
   # Remove from production
   heroku config:unset SYSTEM_ENCRYPTION_KEY
   ```

### Phase 4: Verification (5-10 minutes)
**Goal**: Ensure system is functioning correctly

1. **Run health checks**
   ```bash
   # Basic health check
   curl https://your-app.com/health
   
   # Test authentication
   curl -X POST https://your-app.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

2. **Run critical tests**
   ```bash
   # Run auth tests only
   npm test -- auth
   
   # Run smoke tests
   npm run test:smoke
   ```

3. **Monitor logs**
   ```bash
   # Tail application logs
   tail -f logs/app.log
   
   # Or for Heroku
   heroku logs --tail
   ```

4. **Check key metrics**
   - Login success rate
   - 2FA verification success rate
   - SMS delivery rate
   - Database query performance
   - Error rates

## Rollback Decision Tree

```
Issue Detected
    │
    ├─> Critical (Users can't login)
    │     └─> IMMEDIATE ROLLBACK (Phase 1-4)
    │
    ├─> Major (Feature broken)
    │     ├─> Can disable feature? 
    │     │     └─> YES: Disable & monitor
    │     │     └─> NO: ROLLBACK (Phase 2-4)
    │
    └─> Minor (Performance issue)
          └─> Monitor & optimize
                └─> Degrading? → ROLLBACK
```

## Post-Rollback Actions

1. **Incident Report**
   - Document what failed
   - Identify root cause
   - Plan fixes

2. **Communication**
   - Notify team
   - Update status page
   - Inform affected users if needed

3. **Recovery Planning**
   - Fix identified issues
   - Plan re-deployment
   - Enhanced testing

## Emergency Contacts

- **Database Admin**: [Contact]
- **DevOps Lead**: [Contact]
- **Security Team**: [Contact]
- **On-Call Engineer**: [Contact]

## Quick Commands Reference

```bash
# Full rollback script
./scripts/emergency-rollback.sh

# Backup current state
pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"

# Disable all new features
export DISABLE_SECURITY_FEATURES=true
export USE_LEGACY_AUTH=true
npm restart

# Monitor real-time
watch -n 1 'psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE account_locked_until > NOW();"'
```

## Prevention Measures

To avoid needing rollback:
1. ✅ Test thoroughly in staging (minimum 48 hours)
2. ✅ Deploy during low-traffic periods
3. ✅ Have monitoring alerts configured
4. ✅ Keep recent backups (< 1 hour old)
5. ✅ Use feature flags for gradual rollout
6. ✅ Have rollback plan reviewed by team

## Recovery Time Objectives

- **RTO (Recovery Time Objective)**: 20 minutes
- **RPO (Recovery Point Objective)**: 1 hour
- **Minimum viable rollback**: 5 minutes (disable features)
- **Full rollback**: 20-30 minutes

---

**Remember**: It's better to rollback quickly and diagnose offline than to leave users with a broken system.