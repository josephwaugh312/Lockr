-- Migration 008: Create master password reset tokens table
-- This is separate from regular password reset tokens due to different security implications

CREATE TABLE IF NOT EXISTS master_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    data_wiped BOOLEAN DEFAULT FALSE, -- Track if vault data was wiped
    wiped_at TIMESTAMP WITH TIME ZONE, -- When data was wiped
    entries_count INTEGER DEFAULT 0, -- Number of entries that were wiped for logging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_user_id ON master_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_token_hash ON master_password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_expires_at ON master_password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_master_password_reset_tokens_used ON master_password_reset_tokens(used);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_master_password_reset_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_master_password_reset_tokens_updated_at
    BEFORE UPDATE ON master_password_reset_tokens
    FOR EACH ROW
    EXECUTE PROCEDURE update_master_password_reset_tokens_updated_at();

-- Add comments for documentation
COMMENT ON TABLE master_password_reset_tokens IS 'Tokens for master password reset with vault data wipe';
COMMENT ON COLUMN master_password_reset_tokens.data_wiped IS 'Whether vault data was wiped during reset';
COMMENT ON COLUMN master_password_reset_tokens.wiped_at IS 'Timestamp when vault data was wiped';
COMMENT ON COLUMN master_password_reset_tokens.entries_count IS 'Number of vault entries wiped for audit logging'; 