-- Add missing columns for integration tests
-- These columns are referenced in the code but missing from the database

-- Add GDPR consent columns if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gdpr_consent_given_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gdpr_consent_version VARCHAR(50);

-- Add encrypted 2FA secret columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS encrypted_two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_secret_salt VARCHAR(255),
ADD COLUMN IF NOT EXISTS two_factor_secret_iv VARCHAR(255);

-- Add phone encryption columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number_salt VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_number_iv VARCHAR(255);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_gdpr_consent ON users(gdpr_consent_given_at) WHERE gdpr_consent_given_at IS NOT NULL;