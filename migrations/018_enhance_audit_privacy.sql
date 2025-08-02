-- Migration: 018_enhance_audit_privacy.sql
-- Description: Enhance audit trail privacy by hashing IP addresses and user agents
-- Created: 2024-01-15

BEGIN;

-- Add hashed IP address fields to password reset tokens
ALTER TABLE password_reset_tokens 
ADD COLUMN IF NOT EXISTS ip_hash TEXT,
ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;

-- Add hashed IP address fields to master password reset tokens
ALTER TABLE master_password_reset_tokens 
ADD COLUMN IF NOT EXISTS ip_hash TEXT,
ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;

-- Add constraints for hashed fields
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_ip_hash_length 
    CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64);

ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_agent_hash_length 
    CHECK (user_agent_hash IS NULL OR char_length(user_agent_hash) = 64);

ALTER TABLE master_password_reset_tokens ADD CONSTRAINT master_password_reset_tokens_ip_hash_length 
    CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64);

ALTER TABLE master_password_reset_tokens ADD CONSTRAINT master_password_reset_tokens_user_agent_hash_length 
    CHECK (user_agent_hash IS NULL OR char_length(user_agent_hash) = 64);

-- Create indexes for hashed fields
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_ip_hash 
    ON password_reset_tokens(ip_hash) 
    WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_ip_hash 
    ON master_password_reset_tokens(ip_hash) 
    WHERE ip_hash IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN password_reset_tokens.ip_hash IS 'SHA-256 hash of IP address for privacy';
COMMENT ON COLUMN password_reset_tokens.user_agent_hash IS 'SHA-256 hash of user agent for privacy';
COMMENT ON COLUMN master_password_reset_tokens.ip_hash IS 'SHA-256 hash of IP address for privacy';
COMMENT ON COLUMN master_password_reset_tokens.user_agent_hash IS 'SHA-256 hash of user agent for privacy';

COMMIT; 