-- Migration 013: Remove master password hash for zero-knowledge architecture
-- This implements true zero-knowledge security where master passwords never touch the server

-- Remove master password hash column
ALTER TABLE users DROP COLUMN IF EXISTS master_password_hash;

-- Add index for better performance on email lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add comment explaining zero-knowledge architecture
COMMENT ON TABLE users IS 'User accounts - master passwords are never stored on server (zero-knowledge architecture)';

-- Record migration
INSERT INTO schema_migrations (filename, executed_at) 
VALUES ('013_remove_master_password_hash.sql', CURRENT_TIMESTAMP)
ON CONFLICT (filename) DO NOTHING; 