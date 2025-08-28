-- Migration: 023_create_email_verification_tokens_table.sql
-- Description: Create email_verification_tokens table for storing email verification tokens
-- Created: 2025-08-28

BEGIN;

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used ON email_verification_tokens(used);

-- Add comments for documentation
COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens for user email verification';
COMMENT ON COLUMN email_verification_tokens.id IS 'Primary key for the email verification token';
COMMENT ON COLUMN email_verification_tokens.user_id IS 'Foreign key reference to the user';
COMMENT ON COLUMN email_verification_tokens.token IS 'The verification token sent to the user';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'When the token expires';
COMMENT ON COLUMN email_verification_tokens.used IS 'Whether the token has been used';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'When the token was used';
COMMENT ON COLUMN email_verification_tokens.created_at IS 'When the token was created';

-- Also add email_verified_at column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.email_verified_at IS 'When the user verified their email address';

COMMIT;