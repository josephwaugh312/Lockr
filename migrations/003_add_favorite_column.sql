-- Migration: 003_add_favorite_column.sql
-- Description: Add favorite column to vault_entries table
-- Created: 2024-01-26

BEGIN;

-- Add favorite column to vault_entries table
ALTER TABLE vault_entries 
ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for performance on favorites query
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_favorite ON vault_entries(user_id, favorite) WHERE favorite = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN vault_entries.favorite IS 'Whether the entry is marked as favorite by the user';

COMMIT; 