-- Migration: Add last_breach_check timestamp to users table
-- Purpose: Track when each user's email was last checked for data breaches
-- This enables rate limiting to prevent excessive HIBP API calls

-- Add last_breach_check column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_breach_check TIMESTAMP WITH TIME ZONE;

-- Add comment to document the column
COMMENT ON COLUMN users.last_breach_check IS 'Timestamp of last Have I Been Pwned breach check for this user';

-- Create index for efficient queries when filtering by last check time
CREATE INDEX IF NOT EXISTS idx_users_last_breach_check
ON users(last_breach_check)
WHERE last_breach_check IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 028: Added last_breach_check column to users table';
END $$;
