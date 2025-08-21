-- Migration: Add missing columns for tests
BEGIN;

-- Add missing columns to vault_entries
ALTER TABLE vault_entries
ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;

-- Add missing columns to password_reset_tokens
ALTER TABLE password_reset_tokens
ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(255);

-- Add missing columns to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS encrypted_phone_number TEXT,
ADD COLUMN IF NOT EXISTS data_retention_policy JSONB DEFAULT '{}';

-- Add missing columns to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS vault_activity BOOLEAN DEFAULT TRUE;

COMMIT; 