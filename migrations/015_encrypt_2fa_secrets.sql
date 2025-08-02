-- Migration: 015_encrypt_2fa_secrets.sql
-- Description: Encrypt 2FA secrets for enhanced security
-- Created: 2024-01-15

BEGIN;

-- Add encrypted 2FA secret fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS encrypted_two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_secret_iv TEXT,
ADD COLUMN IF NOT EXISTS two_factor_secret_salt TEXT;

-- Add constraints for encrypted fields
ALTER TABLE users ADD CONSTRAINT users_encrypted_2fa_secret_length 
    CHECK (encrypted_two_factor_secret IS NULL OR char_length(encrypted_two_factor_secret) > 0);

ALTER TABLE users ADD CONSTRAINT users_2fa_secret_iv_length 
    CHECK (two_factor_secret_iv IS NULL OR char_length(two_factor_secret_iv) = 24);

ALTER TABLE users ADD CONSTRAINT users_2fa_secret_salt_length 
    CHECK (two_factor_secret_salt IS NULL OR char_length(two_factor_secret_salt) = 32);

-- Create index for encrypted 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_encrypted_2fa_enabled 
    ON users(encrypted_two_factor_secret) 
    WHERE encrypted_two_factor_secret IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.encrypted_two_factor_secret IS 'AES-256-GCM encrypted TOTP secret key';
COMMENT ON COLUMN users.two_factor_secret_iv IS 'Initialization vector for 2FA secret encryption';
COMMENT ON COLUMN users.two_factor_secret_salt IS 'Salt for deriving 2FA encryption key from user password';

-- Create function to encrypt existing 2FA secrets (will be called from application)
CREATE OR REPLACE FUNCTION migrate_2fa_secrets_to_encrypted()
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
BEGIN
    -- This function will be called from the application to migrate existing secrets
    -- The actual encryption will happen in the application layer
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

COMMIT; 