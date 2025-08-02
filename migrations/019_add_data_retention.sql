-- Migration: 019_add_data_retention.sql
-- Description: Add data retention policies and GDPR compliance features
-- Created: 2024-01-15

BEGIN;

-- Add data retention fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS data_retention_policy VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS data_deletion_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_deletion_scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gdpr_consent_given_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gdpr_consent_version VARCHAR(10) DEFAULT '1.0';

-- Add data retention fields to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_delete_at TIMESTAMP WITH TIME ZONE;

-- Add data retention fields to audit tables
ALTER TABLE password_reset_tokens 
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE master_password_reset_tokens 
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMP WITH TIME ZONE;

-- Add constraints for data retention fields
ALTER TABLE users ADD CONSTRAINT users_data_retention_policy_valid 
    CHECK (data_retention_policy IN ('standard', 'minimal', 'extended', 'deletion_requested'));

ALTER TABLE users ADD CONSTRAINT users_gdpr_consent_version_format 
    CHECK (gdpr_consent_version ~ '^\d+\.\d+$');

-- Create indexes for data retention queries
CREATE INDEX IF NOT EXISTS idx_users_data_deletion_scheduled 
    ON users(data_deletion_scheduled_at) 
    WHERE data_deletion_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_retention_expires 
    ON notifications(retention_expires_at) 
    WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_auto_delete 
    ON notifications(auto_delete_at) 
    WHERE auto_delete_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_retention 
    ON password_reset_tokens(retention_expires_at) 
    WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_retention 
    ON master_password_reset_tokens(retention_expires_at) 
    WHERE retention_expires_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.data_retention_policy IS 'Data retention policy for GDPR compliance';
COMMENT ON COLUMN users.data_deletion_requested_at IS 'When user requested data deletion';
COMMENT ON COLUMN users.data_deletion_scheduled_at IS 'When user data will be deleted';
COMMENT ON COLUMN users.gdpr_consent_given_at IS 'When user gave GDPR consent';
COMMENT ON COLUMN users.gdpr_consent_version IS 'Version of GDPR consent given';
COMMENT ON COLUMN notifications.retention_expires_at IS 'When notification should be retained until';
COMMENT ON COLUMN notifications.auto_delete_at IS 'When notification should be automatically deleted';
COMMENT ON COLUMN password_reset_tokens.retention_expires_at IS 'When reset token should be retained until';
COMMENT ON COLUMN master_password_reset_tokens.retention_expires_at IS 'When master reset token should be retained until';

-- Create function to set default retention dates
CREATE OR REPLACE FUNCTION set_default_retention_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Set default retention for notifications (30 days)
    IF NEW.retention_expires_at IS NULL THEN
        NEW.retention_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days';
    END IF;
    
    -- Set default auto-delete for notifications (90 days)
    IF NEW.auto_delete_at IS NULL THEN
        NEW.auto_delete_at = CURRENT_TIMESTAMP + INTERVAL '90 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to set default retention for reset tokens (24 hours)
CREATE OR REPLACE FUNCTION set_reset_token_retention()
RETURNS TRIGGER AS $$
BEGIN
    -- Set default retention for password reset tokens (24 hours)
    IF NEW.retention_expires_at IS NULL THEN
        NEW.retention_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic retention date setting
CREATE TRIGGER set_notification_retention_dates
    BEFORE INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION set_default_retention_dates();

CREATE TRIGGER set_password_reset_token_retention
    BEFORE INSERT ON password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION set_reset_token_retention();

CREATE TRIGGER set_master_password_reset_token_retention
    BEFORE INSERT ON master_password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION set_reset_token_retention();

COMMIT; 