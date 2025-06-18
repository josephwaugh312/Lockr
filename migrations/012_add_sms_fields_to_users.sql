-- Migration: 012_add_sms_fields_to_users.sql
-- Description: Add SMS notification fields to users table
-- Created: 2024-12-15

BEGIN;

-- Add SMS-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_sms_opt_out ON users(sms_opt_out) WHERE sms_opt_out = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified) WHERE phone_verified = TRUE;

-- Add constraints for phone number format (basic validation)
ALTER TABLE users ADD CONSTRAINT users_phone_number_format 
    CHECK (phone_number IS NULL OR phone_number ~ '^\+?[1-9]\d{1,14}$');

-- Add constraint for verification code format
ALTER TABLE users ADD CONSTRAINT users_phone_verification_code_format 
    CHECK (phone_verification_code IS NULL OR phone_verification_code ~ '^\d{6}$');

-- Add comments for documentation
COMMENT ON COLUMN users.phone_number IS 'User phone number in E.164 format for SMS notifications';
COMMENT ON COLUMN users.sms_opt_out IS 'Whether user has opted out of SMS notifications';
COMMENT ON COLUMN users.phone_verified IS 'Whether the phone number has been verified';
COMMENT ON COLUMN users.phone_verification_code IS '6-digit verification code for phone verification';
COMMENT ON COLUMN users.phone_verification_expires_at IS 'When the phone verification code expires';

COMMIT; 