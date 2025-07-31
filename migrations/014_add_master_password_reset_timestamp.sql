-- Migration: Add master password reset timestamp
-- This field tracks when a master password was last reset to force re-authentication

ALTER TABLE users 
ADD COLUMN master_password_reset_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient queries
CREATE INDEX idx_users_master_password_reset_at ON users(master_password_reset_at);

-- Add comment for documentation
COMMENT ON COLUMN users.master_password_reset_at IS 'Timestamp when master password was last reset - used to force re-authentication'; 