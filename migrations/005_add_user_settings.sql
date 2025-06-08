-- Migration: Add user_settings table
-- Description: Create table to store user preferences and settings

-- Create user_settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Security settings
    session_timeout INTEGER DEFAULT 30 CHECK (session_timeout > 0 OR session_timeout = -1),
    require_password_confirmation BOOLEAN DEFAULT true,
    
    -- Vault settings
    auto_lock_timeout INTEGER DEFAULT 15 CHECK (auto_lock_timeout > 0 OR auto_lock_timeout = -1),
    clipboard_timeout INTEGER DEFAULT 30 CHECK (clipboard_timeout > 0 OR clipboard_timeout = -1),
    show_password_strength BOOLEAN DEFAULT true,
    auto_save BOOLEAN DEFAULT true,
    
    -- Appearance settings
    theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    compact_view BOOLEAN DEFAULT false,
    
    -- Notification settings
    security_alerts BOOLEAN DEFAULT true,
    password_expiry BOOLEAN DEFAULT true,
    breach_alerts BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on user_id (one settings record per user)
CREATE UNIQUE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at_trigger
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at(); 