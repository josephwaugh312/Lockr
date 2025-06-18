-- Migration: 011_add_email_verification.sql
-- Description: Add email verification fields to users table
-- Created: 2024-12-13

BEGIN;

-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for email verification token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Add comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification (expires after 24 hours)';
COMMENT ON COLUMN users.email_verification_expires_at IS 'When the email verification token expires';
COMMENT ON COLUMN users.email_verification_sent_at IS 'When the verification email was last sent';

COMMIT; 