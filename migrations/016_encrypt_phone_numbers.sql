-- Migration: 016_encrypt_phone_numbers.sql
-- Description: Encrypt phone numbers for GDPR compliance and enhanced privacy
-- Created: 2024-01-15

BEGIN;

-- Add encrypted phone number fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS encrypted_phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone_number_iv TEXT,
ADD COLUMN IF NOT EXISTS phone_number_salt TEXT;

-- Add constraints for encrypted phone number fields
ALTER TABLE users ADD CONSTRAINT users_encrypted_phone_number_length 
    CHECK (encrypted_phone_number IS NULL OR char_length(encrypted_phone_number) > 0);

ALTER TABLE users ADD CONSTRAINT users_phone_number_iv_length 
    CHECK (phone_number_iv IS NULL OR char_length(phone_number_iv) = 24);

ALTER TABLE users ADD CONSTRAINT users_phone_number_salt_length 
    CHECK (phone_number_salt IS NULL OR char_length(phone_number_salt) = 32);

-- Create index for encrypted phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_encrypted_phone_number 
    ON users(encrypted_phone_number) 
    WHERE encrypted_phone_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.encrypted_phone_number IS 'AES-256-GCM encrypted phone number';
COMMENT ON COLUMN users.phone_number_iv IS 'Initialization vector for phone number encryption';
COMMENT ON COLUMN users.phone_number_salt IS 'Salt for deriving phone number encryption key from user password';

COMMIT; 