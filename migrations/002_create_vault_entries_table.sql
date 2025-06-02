-- Migration: 002_create_vault_entries_table.sql
-- Description: Create vault_entries table for encrypted password storage
-- Created: 2024-01-01

BEGIN;

-- Create vault_entries table
CREATE TABLE IF NOT EXISTS vault_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    url TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT vault_entries_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    CONSTRAINT vault_entries_username_length CHECK (username IS NULL OR (char_length(username) >= 1 AND char_length(username) <= 255)),
    CONSTRAINT vault_entries_category_length CHECK (char_length(category) >= 1 AND char_length(category) <= 100),
    CONSTRAINT vault_entries_encrypted_data_not_empty CHECK (char_length(encrypted_data) > 0),
    CONSTRAINT vault_entries_url_length CHECK (url IS NULL OR char_length(url) <= 2048)
);

-- Create indexes for performance and security
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id ON vault_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_category ON vault_entries(category);
CREATE INDEX IF NOT EXISTS idx_vault_entries_name ON vault_entries(name);
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_category ON vault_entries(user_id, category);
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_created ON vault_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_entries_created_at ON vault_entries(created_at DESC);

-- Create trigger for vault_entries table
CREATE TRIGGER update_vault_entries_updated_at 
    BEFORE UPDATE ON vault_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE vault_entries IS 'Encrypted password vault entries';
COMMENT ON COLUMN vault_entries.id IS 'Unique entry identifier (UUID)';
COMMENT ON COLUMN vault_entries.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN vault_entries.name IS 'Entry name/title';
COMMENT ON COLUMN vault_entries.username IS 'Username for the entry';
COMMENT ON COLUMN vault_entries.url IS 'Associated URL';
COMMENT ON COLUMN vault_entries.category IS 'Entry category for organization';
COMMENT ON COLUMN vault_entries.encrypted_data IS 'AES-256-GCM encrypted password and metadata';
COMMENT ON COLUMN vault_entries.created_at IS 'Entry creation timestamp';
COMMENT ON COLUMN vault_entries.updated_at IS 'Last modification timestamp';

COMMIT; 