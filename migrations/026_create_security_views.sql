-- Migration: 026_create_security_views.sql
-- Description: Create security views for safe data access without exposing sensitive columns
-- Created: 2025-08-31

BEGIN;

-- Drop existing views if they exist (for re-runnability)
DROP VIEW IF EXISTS users_public CASCADE;
DROP VIEW IF EXISTS users_authenticated CASCADE;
DROP VIEW IF EXISTS users_admin CASCADE;
DROP VIEW IF EXISTS user_security_status CASCADE;
DROP VIEW IF EXISTS user_activity_log CASCADE;

-- View 1: Public user view (minimal information, no sensitive data)
CREATE VIEW users_public AS
SELECT 
    id,
    name,
    role,
    created_at,
    email_verified,
    two_factor_enabled
FROM users
WHERE email_verified = true;

COMMENT ON VIEW users_public IS 'Public-facing user information with no sensitive data';

-- View 2: Authenticated user view (for logged-in users viewing their own data)
CREATE VIEW users_authenticated AS
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at,
    two_factor_enabled,
    two_factor_enabled_at,
    email_verified,
    phone_verified,
    sms_opt_out,
    last_login_at,
    last_activity_at,
    password_changed_at,
    password_expires_at,
    data_retention_policy,
    gdpr_consent_given_at,
    gdpr_consent_version,
    -- Masked sensitive data
    CASE 
        WHEN encrypted_phone_number IS NOT NULL THEN 
            '***-***-' || RIGHT(id::text, 4)
        ELSE NULL 
    END as phone_masked,
    -- Security status indicators
    CASE 
        WHEN account_locked_until IS NOT NULL AND account_locked_until > CURRENT_TIMESTAMP THEN true
        ELSE false
    END as account_locked,
    CASE 
        WHEN password_expires_at IS NOT NULL AND password_expires_at < CURRENT_TIMESTAMP THEN true
        ELSE false
    END as password_expired
FROM users;

COMMENT ON VIEW users_authenticated IS 'User view for authenticated users with masked sensitive data';

-- View 3: Admin view (for administrators, still excludes highly sensitive data)
CREATE VIEW users_admin AS
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at,
    two_factor_enabled,
    two_factor_enabled_at,
    email_verified,
    email_verification_sent_at,
    phone_verified,
    sms_opt_out,
    last_login_at,
    last_login_ip,
    failed_login_attempts,
    account_locked_until,
    password_changed_at,
    password_expires_at,
    last_activity_at,
    session_count,
    data_retention_policy,
    data_deletion_requested_at,
    data_deletion_scheduled_at,
    gdpr_consent_given_at,
    gdpr_consent_version,
    -- Indicators for encrypted data presence
    CASE WHEN encrypted_two_factor_secret IS NOT NULL THEN true ELSE false END as has_encrypted_2fa,
    CASE WHEN encrypted_phone_number IS NOT NULL THEN true ELSE false END as has_encrypted_phone,
    -- Legacy data indicators (for migration tracking)
    CASE WHEN two_factor_secret IS NOT NULL THEN true ELSE false END as has_legacy_2fa,
    CASE WHEN phone_number IS NOT NULL THEN true ELSE false END as has_legacy_phone
FROM users;

COMMENT ON VIEW users_admin IS 'Administrative view with security metadata but no actual secrets';

-- View 4: User security status view (for security dashboards)
CREATE VIEW user_security_status AS
SELECT 
    id,
    email,
    name,
    -- Security features
    two_factor_enabled,
    email_verified,
    phone_verified,
    -- Security metrics
    failed_login_attempts,
    CASE 
        WHEN account_locked_until IS NOT NULL AND account_locked_until > CURRENT_TIMESTAMP THEN 
            EXTRACT(EPOCH FROM (account_locked_until - CURRENT_TIMESTAMP)) / 60
        ELSE 0
    END as lock_remaining_minutes,
    CASE 
        WHEN password_expires_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (password_expires_at - CURRENT_TIMESTAMP)) / 86400
        ELSE NULL
    END as password_expires_in_days,
    CASE 
        WHEN last_login_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_login_at)) / 86400
        ELSE NULL
    END as days_since_login,
    CASE 
        WHEN password_changed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - password_changed_at)) / 86400
        ELSE NULL
    END as password_age_days,
    session_count,
    -- Risk score calculation (0-100, higher = more risk)
    CASE 
        WHEN account_locked_until IS NOT NULL AND account_locked_until > CURRENT_TIMESTAMP THEN 100
        WHEN failed_login_attempts > 5 THEN 80
        WHEN failed_login_attempts > 3 THEN 60
        WHEN NOT two_factor_enabled THEN 40
        WHEN NOT email_verified THEN 30
        WHEN password_changed_at IS NULL OR password_changed_at < CURRENT_TIMESTAMP - INTERVAL '180 days' THEN 25
        WHEN last_login_at IS NULL OR last_login_at < CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 20
        ELSE 0
    END as risk_score
FROM users;

COMMENT ON VIEW user_security_status IS 'Security status and risk assessment view for monitoring';

-- View 5: User activity log view (for audit trails)
CREATE VIEW user_activity_log AS
SELECT 
    id as user_id,
    email,
    name,
    'login' as event_type,
    last_login_at as event_time,
    last_login_ip as event_metadata
FROM users
WHERE last_login_at IS NOT NULL
UNION ALL
SELECT 
    id as user_id,
    email,
    name,
    'password_change' as event_type,
    password_changed_at as event_time,
    NULL as event_metadata
FROM users
WHERE password_changed_at IS NOT NULL
UNION ALL
SELECT 
    id as user_id,
    email,
    name,
    '2fa_enabled' as event_type,
    two_factor_enabled_at as event_time,
    NULL as event_metadata
FROM users
WHERE two_factor_enabled_at IS NOT NULL
UNION ALL
SELECT 
    id as user_id,
    email,
    name,
    'email_verified' as event_type,
    email_verified_at as event_time,
    NULL as event_metadata
FROM users
WHERE email_verified_at IS NOT NULL
UNION ALL
SELECT 
    id as user_id,
    email,
    name,
    'gdpr_consent' as event_type,
    gdpr_consent_given_at as event_time,
    gdpr_consent_version as event_metadata
FROM users
WHERE gdpr_consent_given_at IS NOT NULL
ORDER BY event_time DESC;

COMMENT ON VIEW user_activity_log IS 'Consolidated view of user security-related activities';

-- Create row-level security policies for views (optional, depends on your RLS setup)
-- Example: Users can only see their own data in users_authenticated view
-- This would require enabling RLS on the base table and creating appropriate policies

-- Grant appropriate permissions (adjust based on your roles)
-- Public views
GRANT SELECT ON users_public TO PUBLIC;

-- Authenticated user views (assuming you have an 'authenticated' role)
-- GRANT SELECT ON users_authenticated TO authenticated;

-- Admin views (assuming you have an 'admin' role)
-- GRANT SELECT ON users_admin TO admin;
-- GRANT SELECT ON user_security_status TO admin;
-- GRANT SELECT ON user_activity_log TO admin;

-- Create functions for secure data access
CREATE OR REPLACE FUNCTION get_user_public_info(user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    role VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN,
    two_factor_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.role,
        u.created_at,
        u.email_verified,
        u.two_factor_enabled
    FROM users_public u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_public_info IS 'Securely retrieve public user information';

-- Create function for checking if sensitive data needs migration
CREATE OR REPLACE FUNCTION check_encryption_migration_status()
RETURNS TABLE (
    total_users BIGINT,
    users_with_legacy_2fa BIGINT,
    users_with_legacy_phone BIGINT,
    users_with_encrypted_2fa BIGINT,
    users_with_encrypted_phone BIGINT,
    migration_complete BOOLEAN
) AS $$
DECLARE
    v_total_users BIGINT;
    v_legacy_2fa BIGINT;
    v_legacy_phone BIGINT;
    v_encrypted_2fa BIGINT;
    v_encrypted_phone BIGINT;
    v_complete BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_total_users FROM users;
    
    SELECT COUNT(*) INTO v_legacy_2fa 
    FROM users 
    WHERE two_factor_secret IS NOT NULL;
    
    SELECT COUNT(*) INTO v_legacy_phone 
    FROM users 
    WHERE phone_number IS NOT NULL;
    
    SELECT COUNT(*) INTO v_encrypted_2fa 
    FROM users 
    WHERE encrypted_two_factor_secret IS NOT NULL;
    
    SELECT COUNT(*) INTO v_encrypted_phone 
    FROM users 
    WHERE encrypted_phone_number IS NOT NULL;
    
    v_complete := (v_legacy_2fa = 0 AND v_legacy_phone = 0);
    
    RETURN QUERY
    SELECT 
        v_total_users,
        v_legacy_2fa,
        v_legacy_phone,
        v_encrypted_2fa,
        v_encrypted_phone,
        v_complete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_encryption_migration_status IS 'Check the status of sensitive data encryption migration';

COMMIT;