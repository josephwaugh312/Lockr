-- Migration: 004_add_name_to_users.sql
-- Description: Add name field to users table for profile management
-- Created: 2024-01-01

BEGIN;

-- Add name column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add constraint for name length
ALTER TABLE users ADD CONSTRAINT users_name_length 
    CHECK (name IS NULL OR (char_length(name) >= 1 AND char_length(name) <= 255));

-- Create index for name searches (if needed in future)
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name) WHERE name IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.name IS 'User display name (optional)';

COMMIT; 