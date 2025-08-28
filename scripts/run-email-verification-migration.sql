-- Run this script on your production database to create the email_verification_tokens table
-- This fixes the "relation email_verification_tokens does not exist" error

-- First, check if the table already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'email_verification_tokens') THEN
        
        -- Create email_verification_tokens table
        CREATE TABLE email_verification_tokens (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) NOT NULL UNIQUE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
        CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
        CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
        CREATE INDEX idx_email_verification_tokens_used ON email_verification_tokens(used);

        RAISE NOTICE 'email_verification_tokens table created successfully';
    ELSE
        RAISE NOTICE 'email_verification_tokens table already exists';
    END IF;
END $$;

-- Also ensure email_verified_at column exists in users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Show the structure of the new table
\d email_verification_tokens

-- Count existing records (should be 0 for new table)
SELECT COUNT(*) as token_count FROM email_verification_tokens;

-- Show success message
SELECT 'Migration completed successfully! Email verification should now work.' as status;