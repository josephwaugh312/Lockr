-- Migration: 025_add_encryption_constraints.sql
-- Description: Add constraints to ensure encrypted data integrity and prevent plain text storage
-- Created: 2025-08-31

BEGIN;

-- Add check constraints to ensure encrypted columns are used when sensitive data exists
-- These constraints ensure that if 2FA is enabled, the encrypted columns must be used

-- Constraint: If 2FA is enabled, encrypted_two_factor_secret must be present
ALTER TABLE users ADD CONSTRAINT users_2fa_requires_encryption
    CHECK (
        NOT two_factor_enabled OR 
        (encrypted_two_factor_secret IS NOT NULL AND 
         two_factor_secret_iv IS NOT NULL AND 
         two_factor_secret_salt IS NOT NULL)
    );

-- Constraint: If phone is verified, encrypted phone must be present
ALTER TABLE users ADD CONSTRAINT users_phone_requires_encryption
    CHECK (
        NOT phone_verified OR 
        (encrypted_phone_number IS NOT NULL AND 
         phone_number_iv IS NOT NULL AND 
         phone_number_salt IS NOT NULL)
    );

-- Constraint: Ensure encryption fields are complete (all or nothing)
ALTER TABLE users ADD CONSTRAINT users_2fa_encryption_complete
    CHECK (
        (encrypted_two_factor_secret IS NULL AND 
         two_factor_secret_iv IS NULL AND 
         two_factor_secret_salt IS NULL) OR
        (encrypted_two_factor_secret IS NOT NULL AND 
         two_factor_secret_iv IS NOT NULL AND 
         two_factor_secret_salt IS NOT NULL)
    );

ALTER TABLE users ADD CONSTRAINT users_phone_encryption_complete
    CHECK (
        (encrypted_phone_number IS NULL AND 
         phone_number_iv IS NULL AND 
         phone_number_salt IS NULL) OR
        (encrypted_phone_number IS NOT NULL AND 
         phone_number_iv IS NOT NULL AND 
         phone_number_salt IS NOT NULL)
    );

-- Create function to validate and enforce encryption on insert/update
CREATE OR REPLACE FUNCTION enforce_encryption_policy()
RETURNS TRIGGER AS $$
BEGIN
    -- If 2FA is being enabled, ensure encrypted fields are present
    IF NEW.two_factor_enabled = TRUE THEN
        IF NEW.encrypted_two_factor_secret IS NULL OR 
           NEW.two_factor_secret_iv IS NULL OR 
           NEW.two_factor_secret_salt IS NULL THEN
            RAISE EXCEPTION 'Cannot enable 2FA without encrypted secret storage';
        END IF;
        -- Clear any plain text secret if it exists
        NEW.two_factor_secret = NULL;
    END IF;
    
    -- If phone number is being verified, ensure encrypted fields are present
    IF NEW.phone_verified = TRUE THEN
        IF NEW.encrypted_phone_number IS NULL OR 
           NEW.phone_number_iv IS NULL OR 
           NEW.phone_number_salt IS NULL THEN
            RAISE EXCEPTION 'Cannot verify phone without encrypted storage';
        END IF;
        -- Clear any plain text phone if it exists
        NEW.phone_number = NULL;
    END IF;
    
    -- Log security event for audit trail
    IF NEW.two_factor_enabled != OLD.two_factor_enabled THEN
        RAISE NOTICE 'Security event: 2FA status changed for user % from % to %', 
                     NEW.id, OLD.two_factor_enabled, NEW.two_factor_enabled;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce encryption policy
CREATE TRIGGER enforce_encryption_on_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION enforce_encryption_policy();

-- Create function to audit sensitive data access
CREATE OR REPLACE FUNCTION audit_sensitive_data_access()
RETURNS TRIGGER AS $$
BEGIN
    -- This would typically log to an audit table
    -- For now, we'll use RAISE NOTICE for development
    IF TG_OP = 'SELECT' THEN
        -- Note: SELECT triggers are not supported in PostgreSQL
        -- This is here for documentation purposes
        -- Actual auditing would be done at the application level
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON CONSTRAINT users_2fa_requires_encryption ON users IS 
    'Ensures that 2FA can only be enabled with encrypted secret storage';
COMMENT ON CONSTRAINT users_phone_requires_encryption ON users IS 
    'Ensures that phone verification requires encrypted phone storage';
COMMENT ON CONSTRAINT users_2fa_encryption_complete ON users IS 
    'Ensures that 2FA encryption fields are either all present or all null';
COMMENT ON CONSTRAINT users_phone_encryption_complete ON users IS 
    'Ensures that phone encryption fields are either all present or all null';

-- Create index for finding users with legacy plain text data (for migration)
CREATE INDEX IF NOT EXISTS idx_users_legacy_plain_text_2fa
    ON users(two_factor_secret)
    WHERE two_factor_secret IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_legacy_plain_text_phone
    ON users(phone_number)
    WHERE phone_number IS NOT NULL;

COMMIT;