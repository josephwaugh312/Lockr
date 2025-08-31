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
    CONSTRAINT users_2fa_secret_iv_length CHECK (((two_factor_secret_iv IS NULL) OR (char_length(two_factor_secret_iv) = 24))),
    CONSTRAINT users_2fa_secret_length CHECK (((two_factor_secret IS NULL) OR (char_length(two_factor_secret) >= 16))),
    CONSTRAINT users_2fa_secret_salt_length CHECK (((two_factor_secret_salt IS NULL) OR (char_length(two_factor_secret_salt) = 32))),
    CONSTRAINT users_email_format CHECK (((email)::text ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT users_email_length CHECK (((char_length((email)::text) >= 5) AND (char_length((email)::text) <= 255))),
    CONSTRAINT users_encrypted_2fa_secret_length CHECK (((encrypted_two_factor_secret IS NULL) OR (char_length(encrypted_two_factor_secret) > 0))),
    CONSTRAINT users_encrypted_phone_number_length CHECK (((encrypted_phone_number IS NULL) OR (char_length(encrypted_phone_number) > 0))),
    CONSTRAINT users_name_length CHECK (((name IS NULL) OR ((char_length((name)::text) >= 1) AND (char_length((name)::text) <= 255)))),
    CONSTRAINT users_password_hash_length CHECK ((char_length(password_hash) >= 60)),
    CONSTRAINT users_phone_number_format CHECK (((phone_number IS NULL) OR ((phone_number)::text ~ '^\+?[1-9]\d{1,14}$'::text))),
    CONSTRAINT users_phone_number_iv_length CHECK (((phone_number_iv IS NULL) OR (char_length(phone_number_iv) = 24))),
    CONSTRAINT users_phone_number_salt_length CHECK (((phone_number_salt IS NULL) OR (char_length(phone_number_salt) = 32))),
    CONSTRAINT users_phone_verification_code_format CHECK (((phone_verification_code IS NULL) OR ((phone_verification_code)::text ~ '^\d{6}$'::text))),
    CONSTRAINT users_role_valid CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
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
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.schema_migrations (version, executed_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.users (id, email, password_hash, role, created_at, updated_at, two_factor_enabled, two_factor_secret, two_factor_backup_codes, two_factor_enabled_at, name, phone_number, sms_opt_out, phone_verified, phone_verification_code, phone_verification_expires_at, encrypted_two_factor_secret, two_factor_secret_iv, two_factor_secret_salt, encrypted_phone_number, phone_number_iv, phone_number_salt) FROM stdin;
\.


--
-- Data for Name: vault_entries; Type: TABLE DATA; Schema: lockr_schema; Owner: lockruser
--

COPY lockr_schema.vault_entries (id, user_id, name, username, url, category, encrypted_data, created_at, updated_at) FROM stdin;
\.


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
-- Name: idx_users_2fa_enabled; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_2fa_enabled ON lockr_schema.users USING btree (two_factor_enabled) WHERE (two_factor_enabled = true);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_created_at ON lockr_schema.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_email ON lockr_schema.users USING btree (email);


--
-- Name: idx_users_encrypted_2fa_enabled; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_encrypted_2fa_enabled ON lockr_schema.users USING btree (encrypted_two_factor_secret) WHERE (encrypted_two_factor_secret IS NOT NULL);


--
-- Name: idx_users_encrypted_phone_number; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_encrypted_phone_number ON lockr_schema.users USING btree (encrypted_phone_number) WHERE (encrypted_phone_number IS NOT NULL);


--
-- Name: idx_users_name; Type: INDEX; Schema: lockr_schema; Owner: lockruser
--

CREATE INDEX idx_users_name ON lockr_schema.users USING btree (name) WHERE (name IS NOT NULL);


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
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON lockr_schema.users FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_updated_at_column();


--
-- Name: vault_entries update_vault_entries_updated_at; Type: TRIGGER; Schema: lockr_schema; Owner: lockruser
--

CREATE TRIGGER update_vault_entries_updated_at BEFORE UPDATE ON lockr_schema.vault_entries FOR EACH ROW EXECUTE FUNCTION lockr_schema.update_updated_at_column();


--
-- Name: vault_entries vault_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: lockr_schema; Owner: lockruser
--

ALTER TABLE ONLY lockr_schema.vault_entries
    ADD CONSTRAINT vault_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES lockr_schema.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

