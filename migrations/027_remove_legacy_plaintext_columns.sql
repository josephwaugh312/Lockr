-- Migration: 027_remove_legacy_plaintext_columns.sql
-- Description: Remove legacy plain text columns after successful data migration
-- Created: 2025-08-31
-- 
-- WARNING: This migration should ONLY be run after:
-- 1. All data has been successfully migrated to encrypted columns
-- 2. Application code has been updated to use encrypted columns only
-- 3. Full testing has been completed
-- 4. A database backup has been taken
--
-- This migration is IRREVERSIBLE without a backup!

BEGIN;

-- First, verify that no critical data will be lost
DO $$
DECLARE
    unmigrated_2fa_count INTEGER;
    unmigrated_phone_count INTEGER;
BEGIN
    -- Check for any unmigrated 2FA secrets
    SELECT COUNT(*) INTO unmigrated_2fa_count
    FROM users
    WHERE two_factor_secret IS NOT NULL 
      AND two_factor_secret != ''
      AND encrypted_two_factor_secret IS NULL;
    
    -- Check for any unmigrated phone numbers
    SELECT COUNT(*) INTO unmigrated_phone_count
    FROM users
    WHERE phone_number IS NOT NULL 
      AND phone_number != ''
      AND encrypted_phone_number IS NULL;
    
    -- Abort if there's unmigrated data
    IF unmigrated_2fa_count > 0 THEN
        RAISE EXCEPTION 'Cannot remove two_factor_secret column: % users have unmigrated 2FA secrets', unmigrated_2fa_count;
    END IF;
    
    IF unmigrated_phone_count > 0 THEN
        RAISE EXCEPTION 'Cannot remove phone_number column: % users have unmigrated phone numbers', unmigrated_phone_count;
    END IF;
    
    RAISE NOTICE 'Pre-migration checks passed. All sensitive data has been migrated to encrypted columns.';
END $$;

-- Drop constraints that reference the columns to be removed
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_2fa_secret_length;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_number_format;

-- Drop indexes on the columns to be removed
DROP INDEX IF EXISTS idx_users_phone_number;
DROP INDEX IF EXISTS idx_users_legacy_plain_text_2fa;
DROP INDEX IF EXISTS idx_users_legacy_plain_text_phone;

-- Archive the data before deletion (optional - creates a backup table)
-- This table should be dropped after confirming everything works
CREATE TABLE IF NOT EXISTS users_legacy_data_backup AS
SELECT 
    id,
    two_factor_secret,
    phone_number,
    CURRENT_TIMESTAMP as backed_up_at
FROM users
WHERE two_factor_secret IS NOT NULL OR phone_number IS NOT NULL;

-- Add comment to backup table
COMMENT ON TABLE users_legacy_data_backup IS 'Backup of legacy plain text data before column removal. DELETE THIS TABLE after confirming migration success.';

-- Remove the legacy plain text columns
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE users DROP COLUMN IF EXISTS phone_number;

-- Update the enforce_encryption_policy function since plain text columns no longer exist
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
    END IF;
    
    -- If phone number is being verified, ensure encrypted fields are present
    IF NEW.phone_verified = TRUE THEN
        IF NEW.encrypted_phone_number IS NULL OR 
           NEW.phone_number_iv IS NULL OR 
           NEW.phone_number_salt IS NULL THEN
            RAISE EXCEPTION 'Cannot verify phone without encrypted storage';
        END IF;
    END IF;
    
    -- Log security event for audit trail
    IF NEW.two_factor_enabled != OLD.two_factor_enabled THEN
        RAISE NOTICE 'Security event: 2FA status changed for user % from % to %', 
                     NEW.id, OLD.two_factor_enabled, NEW.two_factor_enabled;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if migration is complete
CREATE OR REPLACE FUNCTION verify_legacy_columns_removed()
RETURNS TABLE (
    migration_complete BOOLEAN,
    backup_table_exists BOOLEAN,
    backup_row_count BIGINT
) AS $$
DECLARE
    v_backup_exists BOOLEAN;
    v_backup_count BIGINT;
BEGIN
    -- Check if backup table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_legacy_data_backup'
    ) INTO v_backup_exists;
    
    -- Get backup row count if table exists
    IF v_backup_exists THEN
        SELECT COUNT(*) INTO v_backup_count FROM users_legacy_data_backup;
    ELSE
        v_backup_count := 0;
    END IF;
    
    -- Check if columns have been removed
    RETURN QUERY
    SELECT 
        NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('two_factor_secret', 'phone_number')
        ) as migration_complete,
        v_backup_exists as backup_table_exists,
        v_backup_count as backup_row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_legacy_columns_removed IS 'Verify that legacy plain text columns have been removed';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Legacy plain text columns have been successfully removed.';
    RAISE NOTICE 'IMPORTANT: Remember to drop the users_legacy_data_backup table after confirming everything works correctly.';
    RAISE NOTICE 'Run: DROP TABLE users_legacy_data_backup; when ready.';
END $$;

COMMIT;