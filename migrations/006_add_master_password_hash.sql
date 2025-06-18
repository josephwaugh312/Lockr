-- Migration: Add master_password_hash to users table
-- Description: Add persistent storage for master password hashes to fix vault unlock issues after server restart

-- Add master_password_hash column to users table
ALTER TABLE users ADD COLUMN master_password_hash TEXT;

-- Create index for performance (though not strictly necessary for security)
CREATE INDEX idx_users_master_password_hash ON users(master_password_hash) WHERE master_password_hash IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN users.master_password_hash IS 'Hashed master password for vault encryption/decryption operations'; 