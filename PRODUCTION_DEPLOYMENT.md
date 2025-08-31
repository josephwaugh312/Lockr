# Production Deployment Guide - Database Security Improvements

## Pre-Deployment Checklist

### Prerequisites ✓
- [ ] Staging deployment successful for 48+ hours
- [ ] All staging validation tests passing
- [ ] Performance metrics acceptable in staging
- [ ] Rollback plan reviewed and approved
- [ ] Team notified of deployment window
- [ ] Maintenance window scheduled
- [ ] Recent production backup taken (< 1 hour old)
- [ ] SYSTEM_ENCRYPTION_KEY generated and secured

### Environment Preparation ✓
- [ ] Production environment variables updated
- [ ] Database connection verified
- [ ] Monitoring alerts configured
- [ ] Logging increased to DEBUG level
- [ ] Support team on standby

## Deployment Steps

### Step 1: Pre-Deployment (T-30 minutes)

1. **Take fresh backup**
   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   pg_dump $PRODUCTION_DATABASE_URL > backups/prod_pre_deployment_${TIMESTAMP}.sql
   ```

2. **Verify backup integrity**
   ```bash
   # Check backup size
   ls -lh backups/prod_pre_deployment_${TIMESTAMP}.sql
   
   # Verify backup can be read
   head -100 backups/prod_pre_deployment_${TIMESTAMP}.sql
   ```

3. **Set maintenance mode**
   ```bash
   # Update your application
   heroku maintenance:on --app your-app-name
   # or
   kubectl set env deployment/lockr MAINTENANCE_MODE=true
   ```

### Step 2: Database Migrations (T-0)

1. **Run migration 024 - Security Tracking Columns**
   ```bash
   psql $PRODUCTION_DATABASE_URL -f migrations/024_add_security_tracking_columns.sql
   
   # Verify
   psql $PRODUCTION_DATABASE_URL -c "\d users" | grep -E "last_login|failed_login"
   ```

2. **Run migration 025 - Encryption Constraints**
   ```bash
   psql $PRODUCTION_DATABASE_URL -f migrations/025_add_encryption_constraints.sql
   
   # Verify constraints
   psql $PRODUCTION_DATABASE_URL -c "\d+ users" | grep -A5 "Check constraints"
   ```

3. **Run migration 026 - Security Views**
   ```bash
   psql $PRODUCTION_DATABASE_URL -f migrations/026_create_security_views.sql
   
   # Verify views
   psql $PRODUCTION_DATABASE_URL -c "\dv"
   ```

4. **Record migrations**
   ```sql
   -- Record in schema_migrations
   INSERT INTO schema_migrations (version, executed_at) VALUES 
   ('024_add_security_tracking_columns', NOW()),
   ('025_add_encryption_constraints', NOW()),
   ('026_create_security_views', NOW());
   ```

### Step 3: Data Migration (T+10 minutes)

1. **Set encryption key**
   ```bash
   # Production environment
   export SYSTEM_ENCRYPTION_KEY="your-production-key-here"
   
   # Heroku
   heroku config:set SYSTEM_ENCRYPTION_KEY="your-production-key-here"
   
   # Kubernetes
   kubectl create secret generic encryption-keys \
     --from-literal=system-key="your-production-key-here"
   ```

2. **Run data encryption migration**
   ```bash
   # Check how much data needs migration
   psql $PRODUCTION_DATABASE_URL -c "
     SELECT COUNT(*) as records_to_migrate 
     FROM users 
     WHERE (two_factor_secret IS NOT NULL OR phone_number IS NOT NULL)
       AND (encrypted_two_factor_secret IS NULL OR encrypted_phone_number IS NULL)
   "
   
   # Run migration
   NODE_ENV=production node scripts/migrate-to-encrypted-columns.js
   ```

3. **Verify migration success**
   ```sql
   -- Check migration status
   SELECT * FROM check_encryption_migration_status();
   
   -- Verify no plain text remains unmigrated
   SELECT COUNT(*) FROM users 
   WHERE (two_factor_secret IS NOT NULL AND encrypted_two_factor_secret IS NULL)
      OR (phone_number IS NOT NULL AND encrypted_phone_number IS NULL);
   ```

### Step 4: Application Deployment (T+20 minutes)

1. **Deploy application code**
   ```bash
   # Git deployment
   git push production main
   
   # Docker deployment
   docker pull your-registry/lockr:latest
   docker-compose up -d
   
   # Kubernetes deployment
   kubectl set image deployment/lockr lockr=your-registry/lockr:latest
   ```

2. **Verify deployment**
   ```bash
   # Check application version
   curl https://your-app.com/version
   
   # Check health endpoint
   curl https://your-app.com/health
   ```

### Step 5: Validation (T+30 minutes)

1. **Run production validation tests**
   ```bash
   NODE_ENV=production npm run test:staging-validation
   ```

2. **Test critical user flows**
   - [ ] User login (with and without 2FA)
   - [ ] 2FA enrollment
   - [ ] SMS verification
   - [ ] Password reset
   - [ ] Account creation

3. **Monitor metrics**
   ```bash
   # Database performance
   psql $PRODUCTION_DATABASE_URL -c "
     SELECT query, mean_exec_time, calls 
     FROM pg_stat_statements 
     WHERE query LIKE '%users%' 
     ORDER BY mean_exec_time DESC 
     LIMIT 10
   "
   
   # Application metrics
   curl https://your-app.com/metrics
   ```

### Step 6: Exit Maintenance Mode (T+40 minutes)

1. **Gradual rollout**
   ```bash
   # Enable for 10% of users first
   heroku config:set FEATURE_SECURITY_TRACKING_PERCENT=10
   
   # Monitor for 15 minutes
   sleep 900
   
   # If stable, increase to 50%
   heroku config:set FEATURE_SECURITY_TRACKING_PERCENT=50
   
   # Monitor for 15 minutes
   sleep 900
   
   # Full rollout
   heroku config:set FEATURE_SECURITY_TRACKING_PERCENT=100
   ```

2. **Exit maintenance mode**
   ```bash
   heroku maintenance:off --app your-app-name
   # or
   kubectl set env deployment/lockr MAINTENANCE_MODE=false
   ```

### Step 7: Post-Deployment Monitoring (T+60 minutes)

1. **Monitor error rates**
   ```bash
   # Check error logs
   grep ERROR logs/app.log | tail -100
   
   # Check specific errors
   grep -E "encryption|decrypt|security" logs/app.log | grep ERROR
   ```

2. **Monitor performance**
   ```sql
   -- Check slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY mean_exec_time DESC;
   
   -- Check table statistics
   SELECT schemaname, tablename, n_live_tup, n_dead_tup, last_vacuum
   FROM pg_stat_user_tables
   WHERE tablename = 'users';
   ```

3. **Monitor security features**
   ```sql
   -- Failed login attempts
   SELECT COUNT(*) FROM users WHERE failed_login_attempts > 0;
   
   -- Locked accounts
   SELECT COUNT(*) FROM users WHERE account_locked_until > NOW();
   
   -- Recent logins
   SELECT COUNT(*) FROM users 
   WHERE last_login_at > NOW() - INTERVAL '1 hour';
   ```

### Step 8: Final Migration (T+24 hours)

**Only after 24 hours of stable operation:**

1. **Final backup before column removal**
   ```bash
   pg_dump $PRODUCTION_DATABASE_URL > backups/prod_before_column_removal_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run migration 027 - Remove plain text columns**
   ```bash
   psql $PRODUCTION_DATABASE_URL -f migrations/027_remove_legacy_plaintext_columns.sql
   ```

3. **Verify column removal**
   ```sql
   -- Check columns are removed
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN ('two_factor_secret', 'phone_number');
   
   -- Should return 0 rows
   ```

## Monitoring Dashboard

Create monitoring for these KPIs:

```sql
-- Real-time monitoring queries
CREATE VIEW deployment_metrics AS
SELECT 
  (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '1 hour') as recent_logins,
  (SELECT COUNT(*) FROM users WHERE failed_login_attempts > 0) as users_with_failed_attempts,
  (SELECT COUNT(*) FROM users WHERE account_locked_until > NOW()) as locked_accounts,
  (SELECT COUNT(*) FROM users WHERE encrypted_two_factor_secret IS NOT NULL) as encrypted_2fa_users,
  (SELECT COUNT(*) FROM users WHERE encrypted_phone_number IS NOT NULL) as encrypted_phone_users,
  (SELECT AVG(EXTRACT(EPOCH FROM (NOW() - last_login_at))) FROM users WHERE last_login_at IS NOT NULL) as avg_seconds_since_login;
```

## Success Criteria

Deployment is successful when:
- ✅ All validation tests pass
- ✅ Error rate < 0.1%
- ✅ No performance degradation (< 10% increase in response time)
- ✅ All critical user flows working
- ✅ No security-related errors in logs
- ✅ Monitoring shows normal patterns

## Communication Plan

### Before Deployment
```
Subject: Scheduled Maintenance - Security Improvements
Time: [DATE] [TIME] UTC
Duration: 1 hour
Impact: Brief service interruption

We'll be upgrading our security infrastructure to better protect your data.
```

### After Deployment
```
Subject: Security Improvements Complete
Time: [DATE] [TIME] UTC

✅ Security upgrades successfully deployed
✅ All services operating normally
✅ Your data is now even more secure

New features:
- Enhanced login security
- Improved encryption for sensitive data
- Better account protection
```

## Rollback Trigger Points

Immediately rollback if:
- 🚨 Login success rate drops below 95%
- 🚨 2FA verification fails for > 10% of attempts
- 🚨 Database response time increases > 50%
- 🚨 Error rate exceeds 1%
- 🚨 Any data corruption detected

## Post-Deployment Tasks

- [ ] Remove backup files older than 30 days
- [ ] Update documentation
- [ ] Security audit of new features
- [ ] Performance baseline update
- [ ] Team retrospective
- [ ] Customer communication (if needed)

## Emergency Contacts

- **Deployment Lead**: [Name] - [Phone]
- **Database Admin**: [Name] - [Phone]
- **Security Team**: [Name] - [Phone]
- **On-Call Engineer**: [Name] - [Phone]

---

**Remember**: Take your time, follow the checklist, and don't hesitate to rollback if anything seems wrong.