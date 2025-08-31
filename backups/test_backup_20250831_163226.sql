--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: lockr_schema; Type: SCHEMA; Schema: -; Owner: lockruser
--

CREATE SCHEMA lockr_schema;


ALTER SCHEMA lockr_schema OWNER TO lockruser;

--
-- Name: audit_sensitive_data_access(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.audit_sensitive_data_access() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION lockr_schema.audit_sensitive_data_access() OWNER TO lockruser;

--
-- Name: check_account_lock_status(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.check_account_lock_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If account lock has expired, reset failed attempts
    IF NEW.account_locked_until IS NOT NULL AND NEW.account_locked_until <= CURRENT_TIMESTAMP THEN
        NEW.account_locked_until = NULL;
        NEW.failed_login_attempts = 0;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION lockr_schema.check_account_lock_status() OWNER TO lockruser;

--
-- Name: check_encryption_migration_status(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.check_encryption_migration_status() RETURNS TABLE(total_users bigint, users_with_legacy_2fa bigint, users_with_legacy_phone bigint, users_with_encrypted_2fa bigint, users_with_encrypted_phone bigint, migration_complete boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_total_users BIGINT;
    v_legacy_2fa BIGINT;
    v_legacy_phone BIGINT;
    v_encrypted_2fa BIGINT;
    v_encrypted_phone BIGINT;
    v_complete BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_total_users FROM users;
    
    SELECT COUNT(*) INTO v_legacy_2fa 
    FROM users 
    WHERE two_factor_secret IS NOT NULL;
    
    SELECT COUNT(*) INTO v_legacy_phone 
    FROM users 
    WHERE phone_number IS NOT NULL;
    
    SELECT COUNT(*) INTO v_encrypted_2fa 
    FROM users 
    WHERE encrypted_two_factor_secret IS NOT NULL;
    
    SELECT COUNT(*) INTO v_encrypted_phone 
    FROM users 
    WHERE encrypted_phone_number IS NOT NULL;
    
    v_complete := (v_legacy_2fa = 0 AND v_legacy_phone = 0);
    
    RETURN QUERY
    SELECT 
        v_total_users,
        v_legacy_2fa,
        v_legacy_phone,
        v_encrypted_2fa,
        v_encrypted_phone,
        v_complete;
END;
$$;


ALTER FUNCTION lockr_schema.check_encryption_migration_status() OWNER TO lockruser;

--
-- Name: FUNCTION check_encryption_migration_status(); Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON FUNCTION lockr_schema.check_encryption_migration_status() IS 'Check the status of sensitive data encryption migration';


--
-- Name: enforce_encryption_policy(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.enforce_encryption_policy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION lockr_schema.enforce_encryption_policy() OWNER TO lockruser;

--
-- Name: get_user_public_info(uuid); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.get_user_public_info(user_id uuid) RETURNS TABLE(id uuid, name character varying, role character varying, created_at timestamp with time zone, email_verified boolean, two_factor_enabled boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.role,
        u.created_at,
        u.email_verified,
        u.two_factor_enabled
    FROM users_public u
    WHERE u.id = user_id;
END;
$$;


ALTER FUNCTION lockr_schema.get_user_public_info(user_id uuid) OWNER TO lockruser;

--
-- Name: FUNCTION get_user_public_info(user_id uuid); Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON FUNCTION lockr_schema.get_user_public_info(user_id uuid) IS 'Securely retrieve public user information';


--
-- Name: migrate_2fa_secrets_to_encrypted(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.migrate_2fa_secrets_to_encrypted() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    migrated_count INTEGER := 0;
BEGIN
    -- This function will be called from the application to migrate existing secrets
    -- The actual encryption will happen in the application layer
    RETURN migrated_count;
END;
$$;


ALTER FUNCTION lockr_schema.migrate_2fa_secrets_to_encrypted() OWNER TO lockruser;

--
-- Name: update_master_password_reset_tokens_updated_at(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.update_master_password_reset_tokens_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION lockr_schema.update_master_password_reset_tokens_updated_at() OWNER TO lockruser;

--
-- Name: update_password_changed_at(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.update_password_changed_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        NEW.password_changed_at = CURRENT_TIMESTAMP;
        -- Optionally set password expiry (e.g., 90 days from now)
        -- NEW.password_expires_at = CURRENT_TIMESTAMP + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION lockr_schema.update_password_changed_at() OWNER TO lockruser;

--
-- Name: update_password_reset_tokens_updated_at(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.update_password_reset_tokens_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION lockr_schema.update_password_reset_tokens_updated_at() OWNER TO lockruser;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: lockr_schema; Owner: lockruser
--

CREATE FUNCTION lockr_schema.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION lockr_schema.update_updated_at_column() OWNER TO lockruser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_verification_tokens; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.email_verification_tokens (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE lockr_schema.email_verification_tokens OWNER TO lockruser;

--
-- Name: TABLE email_verification_tokens; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON TABLE lockr_schema.email_verification_tokens IS 'Stores email verification tokens for user email verification';


--
-- Name: COLUMN email_verification_tokens.id; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.id IS 'Primary key for the email verification token';


--
-- Name: COLUMN email_verification_tokens.user_id; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.user_id IS 'Foreign key reference to the user';


--
-- Name: COLUMN email_verification_tokens.token; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.token IS 'The verification token sent to the user';


--
-- Name: COLUMN email_verification_tokens.expires_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.expires_at IS 'When the token expires';


--
-- Name: COLUMN email_verification_tokens.used; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.used IS 'Whether the token has been used';


--
-- Name: COLUMN email_verification_tokens.used_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.used_at IS 'When the token was used';


--
-- Name: COLUMN email_verification_tokens.created_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.email_verification_tokens.created_at IS 'When the token was created';


--
-- Name: email_verification_tokens_id_seq; Type: SEQUENCE; Schema: lockr_schema; Owner: lockruser
--

CREATE SEQUENCE lockr_schema.email_verification_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE lockr_schema.email_verification_tokens_id_seq OWNER TO lockruser;

--
-- Name: email_verification_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: lockr_schema; Owner: lockruser
--

ALTER SEQUENCE lockr_schema.email_verification_tokens_id_seq OWNED BY lockr_schema.email_verification_tokens.id;


--
-- Name: master_password_reset_tokens; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.master_password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    ip_address inet,
    user_agent text,
    data_wiped boolean DEFAULT false,
    wiped_at timestamp with time zone,
    entries_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE lockr_schema.master_password_reset_tokens OWNER TO lockruser;

--
-- Name: TABLE master_password_reset_tokens; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON TABLE lockr_schema.master_password_reset_tokens IS 'Tokens for master password reset with vault data wipe';


--
-- Name: COLUMN master_password_reset_tokens.data_wiped; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.master_password_reset_tokens.data_wiped IS 'Whether vault data was wiped during reset';


--
-- Name: COLUMN master_password_reset_tokens.wiped_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.master_password_reset_tokens.wiped_at IS 'Timestamp when vault data was wiped';


--
-- Name: COLUMN master_password_reset_tokens.entries_count; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.master_password_reset_tokens.entries_count IS 'Number of vault entries wiped for audit logging';


--
-- Name: notifications; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    subtype character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    priority character varying(20) DEFAULT 'medium'::character varying,
    read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE lockr_schema.notifications OWNER TO lockruser;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE lockr_schema.password_reset_tokens OWNER TO lockruser;

--
-- Name: schema_migrations; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.schema_migrations (
    version character varying(255) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE lockr_schema.schema_migrations OWNER TO lockruser;

--
-- Name: users; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret text,
    two_factor_backup_codes text[],
    two_factor_enabled_at timestamp with time zone,
    name character varying(255),
    phone_number character varying(20),
    sms_opt_out boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    phone_verification_code character varying(10),
    phone_verification_expires_at timestamp with time zone,
    encrypted_two_factor_secret text,
    two_factor_secret_iv text,
    two_factor_secret_salt text,
    encrypted_phone_number text,
    phone_number_iv text,
    phone_number_salt text,
    email_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    email_verification_expires_at timestamp with time zone,
    email_verification_sent_at timestamp with time zone,
    last_login_at timestamp with time zone,
    last_login_ip character varying(45),
    failed_login_attempts integer DEFAULT 0,
    account_locked_until timestamp with time zone,
    password_changed_at timestamp with time zone,
    password_expires_at timestamp with time zone,
    last_activity_at timestamp with time zone,
    session_count integer DEFAULT 0,
    email_verified_at timestamp with time zone,
    data_retention_policy jsonb DEFAULT '{"vaultItems": 365, "activityLogs": 90}'::jsonb,
    gdpr_consent_given_at timestamp with time zone,
    gdpr_data_exported_at timestamp with time zone,
    gdpr_consent_version character varying(10),
    data_deletion_requested_at timestamp with time zone,
    data_deletion_scheduled_at timestamp with time zone,
    CONSTRAINT users_2fa_encryption_complete CHECK ((((encrypted_two_factor_secret IS NULL) AND (two_factor_secret_iv IS NULL) AND (two_factor_secret_salt IS NULL)) OR ((encrypted_two_factor_secret IS NOT NULL) AND (two_factor_secret_iv IS NOT NULL) AND (two_factor_secret_salt IS NOT NULL)))),
    CONSTRAINT users_2fa_requires_encryption CHECK (((NOT two_factor_enabled) OR ((encrypted_two_factor_secret IS NOT NULL) AND (two_factor_secret_iv IS NOT NULL) AND (two_factor_secret_salt IS NOT NULL)))),
    CONSTRAINT users_2fa_secret_iv_length CHECK (((two_factor_secret_iv IS NULL) OR (char_length(two_factor_secret_iv) = 24))),
    CONSTRAINT users_2fa_secret_length CHECK (((two_factor_secret IS NULL) OR (char_length(two_factor_secret) >= 16))),
    CONSTRAINT users_2fa_secret_salt_length CHECK (((two_factor_secret_salt IS NULL) OR (char_length(two_factor_secret_salt) = 32))),
    CONSTRAINT users_email_format CHECK (((email)::text ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT users_email_length CHECK (((char_length((email)::text) >= 5) AND (char_length((email)::text) <= 255))),
    CONSTRAINT users_encrypted_2fa_secret_length CHECK (((encrypted_two_factor_secret IS NULL) OR (char_length(encrypted_two_factor_secret) > 0))),
    CONSTRAINT users_encrypted_phone_number_length CHECK (((encrypted_phone_number IS NULL) OR (char_length(encrypted_phone_number) > 0))),
    CONSTRAINT users_failed_login_attempts_non_negative CHECK ((failed_login_attempts >= 0)),
    CONSTRAINT users_last_login_ip_format CHECK (((last_login_ip IS NULL) OR ((last_login_ip)::text ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$'::text) OR ((last_login_ip)::text ~ '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$'::text))),
    CONSTRAINT users_name_length CHECK (((name IS NULL) OR ((char_length((name)::text) >= 1) AND (char_length((name)::text) <= 255)))),
    CONSTRAINT users_password_hash_length CHECK ((char_length(password_hash) >= 60)),
    CONSTRAINT users_phone_encryption_complete CHECK ((((encrypted_phone_number IS NULL) AND (phone_number_iv IS NULL) AND (phone_number_salt IS NULL)) OR ((encrypted_phone_number IS NOT NULL) AND (phone_number_iv IS NOT NULL) AND (phone_number_salt IS NOT NULL)))),
    CONSTRAINT users_phone_number_format CHECK (((phone_number IS NULL) OR ((phone_number)::text ~ '^\+?[1-9]\d{1,14}$'::text))),
    CONSTRAINT users_phone_number_iv_length CHECK (((phone_number_iv IS NULL) OR (char_length(phone_number_iv) = 24))),
    CONSTRAINT users_phone_number_salt_length CHECK (((phone_number_salt IS NULL) OR (char_length(phone_number_salt) = 32))),
    CONSTRAINT users_phone_requires_encryption CHECK (((NOT phone_verified) OR ((encrypted_phone_number IS NOT NULL) AND (phone_number_iv IS NOT NULL) AND (phone_number_salt IS NOT NULL)))),
    CONSTRAINT users_phone_verification_code_format CHECK (((phone_verification_code IS NULL) OR ((phone_verification_code)::text ~ '^\d{6}$'::text))),
    CONSTRAINT users_role_valid CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT users_session_count_non_negative CHECK ((session_count >= 0))
);


ALTER TABLE lockr_schema.users OWNER TO lockruser;

--
-- Name: TABLE users; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON TABLE lockr_schema.users IS 'User accounts for the Lockr password manager';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.id IS 'Unique user identifier (UUID)';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email IS 'User email address (unique)';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.password_hash IS 'Argon2id hashed password';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.role IS 'User role (user, admin)';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.created_at IS 'Account creation timestamp';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.updated_at IS 'Last modification timestamp';


--
-- Name: COLUMN users.two_factor_enabled; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_enabled IS 'Whether 2FA is enabled for this user';


--
-- Name: COLUMN users.two_factor_secret; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_secret IS 'Base32-encoded TOTP secret key';


--
-- Name: COLUMN users.two_factor_backup_codes; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_backup_codes IS 'Array of hashed backup codes for 2FA recovery';


--
-- Name: COLUMN users.two_factor_enabled_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_enabled_at IS 'Timestamp when 2FA was first enabled';


--
-- Name: COLUMN users.name; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.name IS 'User display name (optional)';


--
-- Name: COLUMN users.phone_number; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_number IS 'User phone number in E.164 format for SMS notifications';


--
-- Name: COLUMN users.sms_opt_out; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.sms_opt_out IS 'Whether user has opted out of SMS notifications';


--
-- Name: COLUMN users.phone_verified; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_verified IS 'Whether the phone number has been verified';


--
-- Name: COLUMN users.phone_verification_code; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_verification_code IS '6-digit verification code for phone verification';


--
-- Name: COLUMN users.phone_verification_expires_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_verification_expires_at IS 'When the phone verification code expires';


--
-- Name: COLUMN users.encrypted_two_factor_secret; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.encrypted_two_factor_secret IS 'AES-256-GCM encrypted TOTP secret key';


--
-- Name: COLUMN users.two_factor_secret_iv; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_secret_iv IS 'Initialization vector for 2FA secret encryption';


--
-- Name: COLUMN users.two_factor_secret_salt; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.two_factor_secret_salt IS 'Salt for deriving 2FA encryption key from user password';


--
-- Name: COLUMN users.encrypted_phone_number; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.encrypted_phone_number IS 'AES-256-GCM encrypted phone number';


--
-- Name: COLUMN users.phone_number_iv; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_number_iv IS 'Initialization vector for phone number encryption';


--
-- Name: COLUMN users.phone_number_salt; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.phone_number_salt IS 'Salt for deriving phone number encryption key from user password';


--
-- Name: COLUMN users.email_verified; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email_verified IS 'Whether the user has verified their email address';


--
-- Name: COLUMN users.email_verification_token; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email_verification_token IS 'Token for email verification (expires after 24 hours)';


--
-- Name: COLUMN users.email_verification_expires_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email_verification_expires_at IS 'When the email verification token expires';


--
-- Name: COLUMN users.email_verification_sent_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email_verification_sent_at IS 'When the verification email was last sent';


--
-- Name: COLUMN users.last_login_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.last_login_at IS 'Timestamp of the user''s last successful login';


--
-- Name: COLUMN users.last_login_ip; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.last_login_ip IS 'IP address of the user''s last successful login (IPv4 or IPv6)';


--
-- Name: COLUMN users.failed_login_attempts; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.failed_login_attempts IS 'Number of consecutive failed login attempts';


--
-- Name: COLUMN users.account_locked_until; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.account_locked_until IS 'Timestamp until which the account is locked due to too many failed attempts';


--
-- Name: COLUMN users.password_changed_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.password_changed_at IS 'Timestamp when the user last changed their password';


--
-- Name: COLUMN users.password_expires_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.password_expires_at IS 'Timestamp when the user''s password expires and must be changed';


--
-- Name: COLUMN users.last_activity_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.last_activity_at IS 'Timestamp of the user''s last activity in the application';


--
-- Name: COLUMN users.session_count; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.session_count IS 'Number of active sessions for this user';


--
-- Name: COLUMN users.email_verified_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.users.email_verified_at IS 'When the user verified their email address';


--
-- Name: CONSTRAINT users_2fa_encryption_complete ON users; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON CONSTRAINT users_2fa_encryption_complete ON lockr_schema.users IS 'Ensures that 2FA encryption fields are either all present or all null';


--
-- Name: CONSTRAINT users_2fa_requires_encryption ON users; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON CONSTRAINT users_2fa_requires_encryption ON lockr_schema.users IS 'Ensures that 2FA can only be enabled with encrypted secret storage';


--
-- Name: CONSTRAINT users_phone_encryption_complete ON users; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON CONSTRAINT users_phone_encryption_complete ON lockr_schema.users IS 'Ensures that phone encryption fields are either all present or all null';


--
-- Name: CONSTRAINT users_phone_requires_encryption ON users; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON CONSTRAINT users_phone_requires_encryption ON lockr_schema.users IS 'Ensures that phone verification requires encrypted phone storage';


--
-- Name: user_activity_log; Type: VIEW; Schema: lockr_schema; Owner: lockruser
--

CREATE VIEW lockr_schema.user_activity_log AS
 SELECT users.id AS user_id,
    users.email,
    users.name,
    'login'::text AS event_type,
    users.last_login_at AS event_time,
    users.last_login_ip AS event_metadata
   FROM lockr_schema.users
  WHERE (users.last_login_at IS NOT NULL)
UNION ALL
 SELECT users.id AS user_id,
    users.email,
    users.name,
    'password_change'::text AS event_type,
    users.password_changed_at AS event_time,
    NULL::character varying AS event_metadata
   FROM lockr_schema.users
  WHERE (users.password_changed_at IS NOT NULL)
UNION ALL
 SELECT users.id AS user_id,
    users.email,
    users.name,
    '2fa_enabled'::text AS event_type,
    users.two_factor_enabled_at AS event_time,
    NULL::character varying AS event_metadata
   FROM lockr_schema.users
  WHERE (users.two_factor_enabled_at IS NOT NULL)
UNION ALL
 SELECT users.id AS user_id,
    users.email,
    users.name,
    'email_verified'::text AS event_type,
    users.email_verified_at AS event_time,
    NULL::character varying AS event_metadata
   FROM lockr_schema.users
  WHERE (users.email_verified_at IS NOT NULL)
UNION ALL
 SELECT users.id AS user_id,
    users.email,
    users.name,
    'gdpr_consent'::text AS event_type,
    users.gdpr_consent_given_at AS event_time,
    users.gdpr_consent_version AS event_metadata
   FROM lockr_schema.users
  WHERE (users.gdpr_consent_given_at IS NOT NULL)
  ORDER BY 5 DESC;


ALTER TABLE lockr_schema.user_activity_log OWNER TO lockruser;

--
-- Name: VIEW user_activity_log; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON VIEW lockr_schema.user_activity_log IS 'Consolidated view of user security-related activities';


--
-- Name: user_security_status; Type: VIEW; Schema: lockr_schema; Owner: lockruser
--

CREATE VIEW lockr_schema.user_security_status AS
 SELECT users.id,
    users.email,
    users.name,
    users.two_factor_enabled,
    users.email_verified,
    users.phone_verified,
    users.failed_login_attempts,
        CASE
            WHEN ((users.account_locked_until IS NOT NULL) AND (users.account_locked_until > CURRENT_TIMESTAMP)) THEN (EXTRACT(epoch FROM (users.account_locked_until - CURRENT_TIMESTAMP)) / (60)::numeric)
            ELSE (0)::numeric
        END AS lock_remaining_minutes,
        CASE
            WHEN (users.password_expires_at IS NOT NULL) THEN (EXTRACT(epoch FROM (users.password_expires_at - CURRENT_TIMESTAMP)) / (86400)::numeric)
            ELSE NULL::numeric
        END AS password_expires_in_days,
        CASE
            WHEN (users.last_login_at IS NOT NULL) THEN (EXTRACT(epoch FROM (CURRENT_TIMESTAMP - users.last_login_at)) / (86400)::numeric)
            ELSE NULL::numeric
        END AS days_since_login,
        CASE
            WHEN (users.password_changed_at IS NOT NULL) THEN (EXTRACT(epoch FROM (CURRENT_TIMESTAMP - users.password_changed_at)) / (86400)::numeric)
            ELSE NULL::numeric
        END AS password_age_days,
    users.session_count,
        CASE
            WHEN ((users.account_locked_until IS NOT NULL) AND (users.account_locked_until > CURRENT_TIMESTAMP)) THEN 100
            WHEN (users.failed_login_attempts > 5) THEN 80
            WHEN (users.failed_login_attempts > 3) THEN 60
            WHEN (NOT users.two_factor_enabled) THEN 40
            WHEN (NOT users.email_verified) THEN 30
            WHEN ((users.password_changed_at IS NULL) OR (users.password_changed_at < (CURRENT_TIMESTAMP - '180 days'::interval))) THEN 25
            WHEN ((users.last_login_at IS NULL) OR (users.last_login_at < (CURRENT_TIMESTAMP - '90 days'::interval))) THEN 20
            ELSE 0
        END AS risk_score
   FROM lockr_schema.users;


ALTER TABLE lockr_schema.user_security_status OWNER TO lockruser;

--
-- Name: VIEW user_security_status; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON VIEW lockr_schema.user_security_status IS 'Security status and risk assessment view for monitoring';


--
-- Name: users_admin; Type: VIEW; Schema: lockr_schema; Owner: lockruser
--

CREATE VIEW lockr_schema.users_admin AS
 SELECT users.id,
    users.email,
    users.name,
    users.role,
    users.created_at,
    users.updated_at,
    users.two_factor_enabled,
    users.two_factor_enabled_at,
    users.email_verified,
    users.email_verification_sent_at,
    users.phone_verified,
    users.sms_opt_out,
    users.last_login_at,
    users.last_login_ip,
    users.failed_login_attempts,
    users.account_locked_until,
    users.password_changed_at,
    users.password_expires_at,
    users.last_activity_at,
    users.session_count,
    users.data_retention_policy,
    users.data_deletion_requested_at,
    users.data_deletion_scheduled_at,
    users.gdpr_consent_given_at,
    users.gdpr_consent_version,
        CASE
            WHEN (users.encrypted_two_factor_secret IS NOT NULL) THEN true
            ELSE false
        END AS has_encrypted_2fa,
        CASE
            WHEN (users.encrypted_phone_number IS NOT NULL) THEN true
            ELSE false
        END AS has_encrypted_phone,
        CASE
            WHEN (users.two_factor_secret IS NOT NULL) THEN true
            ELSE false
        END AS has_legacy_2fa,
        CASE
            WHEN (users.phone_number IS NOT NULL) THEN true
            ELSE false
        END AS has_legacy_phone
   FROM lockr_schema.users;


ALTER TABLE lockr_schema.users_admin OWNER TO lockruser;

--
-- Name: VIEW users_admin; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON VIEW lockr_schema.users_admin IS 'Administrative view with security metadata but no actual secrets';


--
-- Name: users_authenticated; Type: VIEW; Schema: lockr_schema; Owner: lockruser
--

CREATE VIEW lockr_schema.users_authenticated AS
 SELECT users.id,
    users.email,
    users.name,
    users.role,
    users.created_at,
    users.updated_at,
    users.two_factor_enabled,
    users.two_factor_enabled_at,
    users.email_verified,
    users.phone_verified,
    users.sms_opt_out,
    users.last_login_at,
    users.last_activity_at,
    users.password_changed_at,
    users.password_expires_at,
    users.data_retention_policy,
    users.gdpr_consent_given_at,
    users.gdpr_consent_version,
        CASE
            WHEN (users.encrypted_phone_number IS NOT NULL) THEN ('***-***-'::text || "right"((users.id)::text, 4))
            ELSE NULL::text
        END AS phone_masked,
        CASE
            WHEN ((users.account_locked_until IS NOT NULL) AND (users.account_locked_until > CURRENT_TIMESTAMP)) THEN true
            ELSE false
        END AS account_locked,
        CASE
            WHEN ((users.password_expires_at IS NOT NULL) AND (users.password_expires_at < CURRENT_TIMESTAMP)) THEN true
            ELSE false
        END AS password_expired
   FROM lockr_schema.users;


ALTER TABLE lockr_schema.users_authenticated OWNER TO lockruser;

--
-- Name: VIEW users_authenticated; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON VIEW lockr_schema.users_authenticated IS 'User view for authenticated users with masked sensitive data';


--
-- Name: users_public; Type: VIEW; Schema: lockr_schema; Owner: lockruser
--

CREATE VIEW lockr_schema.users_public AS
 SELECT users.id,
    users.name,
    users.role,
    users.created_at,
    users.email_verified,
    users.two_factor_enabled
   FROM lockr_schema.users
  WHERE (users.email_verified = true);


ALTER TABLE lockr_schema.users_public OWNER TO lockruser;

--
-- Name: VIEW users_public; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON VIEW lockr_schema.users_public IS 'Public-facing user information with no sensitive data';


--
-- Name: vault_entries; Type: TABLE; Schema: lockr_schema; Owner: lockruser
--

CREATE TABLE lockr_schema.vault_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    username character varying(255),
    url text,
    category character varying(100) DEFAULT 'general'::character varying NOT NULL,
    encrypted_data text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vault_entries_category_length CHECK (((char_length((category)::text) >= 1) AND (char_length((category)::text) <= 100))),
    CONSTRAINT vault_entries_encrypted_data_not_empty CHECK ((char_length(encrypted_data) > 0)),
    CONSTRAINT vault_entries_name_length CHECK (((char_length((name)::text) >= 1) AND (char_length((name)::text) <= 255))),
    CONSTRAINT vault_entries_url_length CHECK (((url IS NULL) OR (char_length(url) <= 2048))),
    CONSTRAINT vault_entries_username_length CHECK (((username IS NULL) OR ((char_length((username)::text) >= 1) AND (char_length((username)::text) <= 255))))
);


ALTER TABLE lockr_schema.vault_entries OWNER TO lockruser;

--
-- Name: TABLE vault_entries; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON TABLE lockr_schema.vault_entries IS 'Encrypted password vault entries';


--
-- Name: COLUMN vault_entries.id; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.id IS 'Unique entry identifier (UUID)';


--
-- Name: COLUMN vault_entries.user_id; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.user_id IS 'Foreign key to users table';


--
-- Name: COLUMN vault_entries.name; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.name IS 'Entry name/title';


--
-- Name: COLUMN vault_entries.username; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.username IS 'Username for the entry';


--
-- Name: COLUMN vault_entries.url; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.url IS 'Associated URL';


--
-- Name: COLUMN vault_entries.category; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.category IS 'Entry category for organization';


--
-- Name: COLUMN vault_entries.encrypted_data; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.encrypted_data IS 'AES-256-GCM encrypted password and metadata';


--
-- Name: COLUMN vault_entries.created_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.created_at IS 'Entry creation timestamp';


--
-- Name: COLUMN vault_entries.updated_at; Type: COMMENT; Schema: lockr_schema; Owner: lockruser
--

COMMENT ON COLUMN lockr_schema.vault_entries.updated_at IS 'Last modification timestamp';


--
-- Name: email_verification_tokens id; Type: DEFAULT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.email_verification_tokens ALTER COLUMN id SET DEFAULT nextval('lockr_schema.email_verification_tokens_id_seq'::regclass);


--
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.email_verification_tokens (id, user_id, token, expires_at, used, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: master_password_reset_tokens; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.master_password_reset_tokens (id, user_id, token_hash, expires_at, used, used_at, ip_address, user_agent, data_wiped, wiped_at, entries_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.notifications (id, user_id, type, subtype, title, message, data, priority, read, read_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.password_reset_tokens (id, user_id, token_hash, expires_at, used, used_at, ip_address, user_agent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.schema_migrations (version, executed_at) FROM stdin;
025_add_encryption_constraints	2025-08-31 08:14:17.362804
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.users (id, email, password_hash, role, created_at, updated_at, two_factor_enabled, two_factor_secret, two_factor_backup_codes, two_factor_enabled_at, name, phone_number, sms_opt_out, phone_verified, phone_verification_code, phone_verification_expires_at, encrypted_two_factor_secret, two_factor_secret_iv, two_factor_secret_salt, encrypted_phone_number, phone_number_iv, phone_number_salt, email_verified, email_verification_token, email_verification_expires_at, email_verification_sent_at, last_login_at, last_login_ip, failed_login_attempts, account_locked_until, password_changed_at, password_expires_at, last_activity_at, session_count, email_verified_at, data_retention_policy, gdpr_consent_given_at, gdpr_data_exported_at, gdpr_consent_version, data_deletion_requested_at, data_deletion_scheduled_at) FROM stdin;
\.


--
-- Data for Name: vault_entries; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.vault_entries (id, user_id, name, username, url, category, encrypted_data, created_at, updated_at) FROM stdin;
\.


--
-- Name: email_verification_tokens_id_seq; Type: SEQUENCE SET; Schema: lockr_schema; Owner: lockruser
--

SELECT pg_catalog.setval('lockr_schema.email_verification_tokens_id_seq', 1, false);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_token_key; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);


--
-- Name: master_password_reset_tokens master_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.master_password_reset_tokens
    ADD CONSTRAINT master_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vault_entries vault_entries_pkey; Type: CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.vault_entries
    ADD CONSTRAINT vault_entries_pkey PRIMARY KEY (id);


--
-- Name: idx_email_verification_tokens_expires_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_email_verification_tokens_expires_at ON lockr_schema.email_verification_tokens USING btree (expires_at);


--
-- Name: idx_email_verification_tokens_token; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_email_verification_tokens_token ON lockr_schema.email_verification_tokens USING btree (token);


--
-- Name: idx_email_verification_tokens_used; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_email_verification_tokens_used ON lockr_schema.email_verification_tokens USING btree (used);


--
-- Name: idx_email_verification_tokens_user_id; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_email_verification_tokens_user_id ON lockr_schema.email_verification_tokens USING btree (user_id);


--
-- Name: idx_master_password_reset_tokens_expires_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_master_password_reset_tokens_expires_at ON lockr_schema.master_password_reset_tokens USING btree (expires_at);


--
-- Name: idx_master_password_reset_tokens_token_hash; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_master_password_reset_tokens_token_hash ON lockr_schema.master_password_reset_tokens USING btree (token_hash);


--
-- Name: idx_master_password_reset_tokens_used; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_master_password_reset_tokens_used ON lockr_schema.master_password_reset_tokens USING btree (used);


--
-- Name: idx_master_password_reset_tokens_user_id; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_master_password_reset_tokens_user_id ON lockr_schema.master_password_reset_tokens USING btree (user_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_notifications_user_id ON lockr_schema.notifications USING btree (user_id);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_password_reset_tokens_expires_at ON lockr_schema.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token_hash; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_password_reset_tokens_token_hash ON lockr_schema.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_used; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_password_reset_tokens_used ON lockr_schema.password_reset_tokens USING btree (used);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_password_reset_tokens_user_id ON lockr_schema.password_reset_tokens USING btree (user_id);


--
-- Name: idx_users_2fa_enabled; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_2fa_enabled ON lockr_schema.users USING btree (two_factor_enabled) WHERE (two_factor_enabled = true);


--
-- Name: idx_users_account_locked; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_account_locked ON lockr_schema.users USING btree (account_locked_until) WHERE (account_locked_until IS NOT NULL);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_created_at ON lockr_schema.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_email ON lockr_schema.users USING btree (email);


--
-- Name: idx_users_email_verification_token; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_email_verification_token ON lockr_schema.users USING btree (email_verification_token);


--
-- Name: idx_users_email_verified; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_email_verified ON lockr_schema.users USING btree (email_verified);


--
-- Name: idx_users_encrypted_2fa_enabled; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_encrypted_2fa_enabled ON lockr_schema.users USING btree (encrypted_two_factor_secret) WHERE (encrypted_two_factor_secret IS NOT NULL);


--
-- Name: idx_users_encrypted_phone_number; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_encrypted_phone_number ON lockr_schema.users USING btree (encrypted_phone_number) WHERE (encrypted_phone_number IS NOT NULL);


--
-- Name: idx_users_failed_logins; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_failed_logins ON lockr_schema.users USING btree (failed_login_attempts) WHERE (failed_login_attempts > 0);


--
-- Name: idx_users_last_activity; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_last_activity ON lockr_schema.users USING btree (last_activity_at DESC) WHERE (last_activity_at IS NOT NULL);


--
-- Name: idx_users_last_login_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_last_login_at ON lockr_schema.users USING btree (last_login_at DESC) WHERE (last_login_at IS NOT NULL);


--
-- Name: idx_users_legacy_plain_text_2fa; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_legacy_plain_text_2fa ON lockr_schema.users USING btree (two_factor_secret) WHERE (two_factor_secret IS NOT NULL);


--
-- Name: idx_users_legacy_plain_text_phone; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_legacy_plain_text_phone ON lockr_schema.users USING btree (phone_number) WHERE (phone_number IS NOT NULL);


--
-- Name: idx_users_name; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_name ON lockr_schema.users USING btree (name) WHERE (name IS NOT NULL);


--
-- Name: idx_users_password_expires; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_password_expires ON lockr_schema.users USING btree (password_expires_at) WHERE (password_expires_at IS NOT NULL);


--
-- Name: idx_users_phone_number; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_phone_number ON lockr_schema.users USING btree (phone_number) WHERE (phone_number IS NOT NULL);


--
-- Name: idx_users_phone_verified; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_phone_verified ON lockr_schema.users USING btree (phone_verified) WHERE (phone_verified = true);


--
-- Name: idx_users_role; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_role ON lockr_schema.users USING btree (role);


--
-- Name: idx_users_sms_opt_out; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_sms_opt_out ON lockr_schema.users USING btree (sms_opt_out) WHERE (sms_opt_out = true);


--
-- Name: idx_vault_entries_category; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_category ON lockr_schema.vault_entries USING btree (category);


--
-- Name: idx_vault_entries_created_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_created_at ON lockr_schema.vault_entries USING btree (created_at DESC);


--
-- Name: idx_vault_entries_name; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_name ON lockr_schema.vault_entries USING btree (name);


--
-- Name: idx_vault_entries_user_category; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_user_category ON lockr_schema.vault_entries USING btree (user_id, category);


--
-- Name: idx_vault_entries_user_created; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_user_created ON lockr_schema.vault_entries USING btree (user_id, created_at DESC);


--
-- Name: idx_vault_entries_user_id; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_vault_entries_user_id ON lockr_schema.vault_entries USING btree (user_id);


--
-- Name: users auto_unlock_accounts; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER auto_unlock_accounts BEFORE UPDATE ON lockr_schema.users FOR EACH ROW EXECUTE FUNCTION lockr_schema.check_account_lock_status();


--
-- Name: users enforce_encryption_on_update; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER enforce_encryption_on_update BEFORE UPDATE ON lockr_schema.users FOR EACH ROW EXECUTE FUNCTION lockr_schema.enforce_encryption_policy();


--
-- Name: users track_password_changes; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER track_password_changes BEFORE UPDATE ON lockr_schema.users FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_password_changed_at();


--
-- Name: master_password_reset_tokens update_master_password_reset_tokens_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_master_password_reset_tokens_updated_at BEFORE UPDATE ON lockr_schema.master_password_reset_tokens FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_master_password_reset_tokens_updated_at();


--
-- Name: password_reset_tokens update_password_reset_tokens_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_password_reset_tokens_updated_at BEFORE UPDATE ON lockr_schema.password_reset_tokens FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_password_reset_tokens_updated_at();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON lockr_schema.users FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_updated_at_column();


--
-- Name: vault_entries update_vault_entries_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_vault_entries_updated_at BEFORE UPDATE ON lockr_schema.vault_entries FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_updated_at_column();


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: email_verification_tokens fk_email_verification_user; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.email_verification_tokens
    ADD CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: master_password_reset_tokens master_password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.master_password_reset_tokens
    ADD CONSTRAINT master_password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: vault_entries vault_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.vault_entries
    ADD CONSTRAINT vault_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- Name: TABLE users_public; Type: ACL; Schema: lockr_schema; Owner: lockruser
--

GRANT SELECT ON TABLE lockr_schema.users_public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

