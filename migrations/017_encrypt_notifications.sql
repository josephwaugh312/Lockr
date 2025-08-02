-- Migration: 017_encrypt_notifications.sql
-- Description: Encrypt notification content to prevent sensitive information leakage
-- Created: 2024-01-15

BEGIN;

-- Add encrypted notification content fields
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS encrypted_title TEXT,
ADD COLUMN IF NOT EXISTS encrypted_message TEXT,
ADD COLUMN IF NOT EXISTS encrypted_data TEXT,
ADD COLUMN IF NOT EXISTS notification_iv TEXT,
ADD COLUMN IF NOT EXISTS notification_salt TEXT;

-- Add constraints for encrypted notification fields
ALTER TABLE notifications ADD CONSTRAINT notifications_encrypted_title_length 
    CHECK (encrypted_title IS NULL OR char_length(encrypted_title) > 0);

ALTER TABLE notifications ADD CONSTRAINT notifications_encrypted_message_length 
    CHECK (encrypted_message IS NULL OR char_length(encrypted_message) > 0);

ALTER TABLE notifications ADD CONSTRAINT notifications_encrypted_data_length 
    CHECK (encrypted_data IS NULL OR char_length(encrypted_data) > 0);

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_iv_length 
    CHECK (notification_iv IS NULL OR char_length(notification_iv) = 24);

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_salt_length 
    CHECK (notification_salt IS NULL OR char_length(notification_salt) = 32);

-- Create indexes for encrypted notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_encrypted_content 
    ON notifications(encrypted_title, encrypted_message) 
    WHERE encrypted_title IS NOT NULL OR encrypted_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_encrypted 
    ON notifications(user_id, encrypted_title) 
    WHERE encrypted_title IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN notifications.encrypted_title IS 'AES-256-GCM encrypted notification title';
COMMENT ON COLUMN notifications.encrypted_message IS 'AES-256-GCM encrypted notification message';
COMMENT ON COLUMN notifications.encrypted_data IS 'AES-256-GCM encrypted notification data (JSON)';
COMMENT ON COLUMN notifications.notification_iv IS 'Initialization vector for notification encryption';
COMMENT ON COLUMN notifications.notification_salt IS 'Salt for deriving notification encryption key from user password';

COMMIT; 