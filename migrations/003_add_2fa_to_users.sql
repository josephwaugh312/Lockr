-- Migration: 003_add_2fa_to_users.sql
-- Description: Add Two-Factor Authentication fields to users table
-- Created: 2024-01-01

BEGIN;

-- Add 2FA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMP WITH TIME ZONE;

-- Add constraints for 2FA fields
ALTER TABLE users ADD CONSTRAINT users_2fa_secret_length 
    CHECK (two_factor_secret IS NULL OR char_length(two_factor_secret) >= 16);

-- Create index for 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Base32-encoded TOTP secret key';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of hashed backup codes for 2FA recovery';
COMMENT ON COLUMN users.two_factor_enabled_at IS 'Timestamp when 2FA was first enabled';

COMMIT; 