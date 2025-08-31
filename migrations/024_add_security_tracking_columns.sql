-- Migration: 024_add_security_tracking_columns.sql
-- Description: Add security tracking columns for enhanced authentication monitoring
-- Created: 2025-08-31

BEGIN;

-- Add security tracking columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;

-- Add constraints for security fields
ALTER TABLE users ADD CONSTRAINT users_failed_login_attempts_non_negative 
    CHECK (failed_login_attempts >= 0);

ALTER TABLE users ADD CONSTRAINT users_session_count_non_negative 
    CHECK (session_count >= 0);

ALTER TABLE users ADD CONSTRAINT users_last_login_ip_format 
    CHECK (last_login_ip IS NULL OR last_login_ip ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$' OR last_login_ip ~ '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$');

-- Create indexes for security queries
CREATE INDEX IF NOT EXISTS idx_users_last_login_at 
    ON users(last_login_at DESC) 
    WHERE last_login_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_account_locked 
    ON users(account_locked_until) 
    WHERE account_locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_expires 
    ON users(password_expires_at) 
    WHERE password_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_failed_logins 
    ON users(failed_login_attempts) 
    WHERE failed_login_attempts > 0;

CREATE INDEX IF NOT EXISTS idx_users_last_activity 
    ON users(last_activity_at DESC) 
    WHERE last_activity_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the user''s last successful login';
COMMENT ON COLUMN users.last_login_ip IS 'IP address of the user''s last successful login (IPv4 or IPv6)';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked_until IS 'Timestamp until which the account is locked due to too many failed attempts';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when the user last changed their password';
COMMENT ON COLUMN users.password_expires_at IS 'Timestamp when the user''s password expires and must be changed';
COMMENT ON COLUMN users.last_activity_at IS 'Timestamp of the user''s last activity in the application';
COMMENT ON COLUMN users.session_count IS 'Number of active sessions for this user';

-- Create function to update password_changed_at when password_hash changes
CREATE OR REPLACE FUNCTION update_password_changed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        NEW.password_changed_at = CURRENT_TIMESTAMP;
        -- Optionally set password expiry (e.g., 90 days from now)
        -- NEW.password_expires_at = CURRENT_TIMESTAMP + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for password change tracking
CREATE TRIGGER track_password_changes
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_password_changed_at();

-- Create function to automatically unlock accounts after lockout period
CREATE OR REPLACE FUNCTION check_account_lock_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If account lock has expired, reset failed attempts
    IF NEW.account_locked_until IS NOT NULL AND NEW.account_locked_until <= CURRENT_TIMESTAMP THEN
        NEW.account_locked_until = NULL;
        NEW.failed_login_attempts = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check account lock status on user access
CREATE TRIGGER auto_unlock_accounts
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_account_lock_status();

COMMIT;