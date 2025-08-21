-- Add missing columns to user_settings table
-- These columns are expected by the userSettingsRepository

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS account_updates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS system_maintenance BOOLEAN DEFAULT true;

-- Add indexes for new columns if needed
CREATE INDEX IF NOT EXISTS idx_user_settings_account_updates ON user_settings(account_updates) WHERE account_updates = false;
CREATE INDEX IF NOT EXISTS idx_user_settings_system_maintenance ON user_settings(system_maintenance) WHERE system_maintenance = false;