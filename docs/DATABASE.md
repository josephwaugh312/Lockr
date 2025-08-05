# Database Documentation

## Overview

Lockr uses PostgreSQL as its primary database, implementing a secure and scalable schema for password management. The database is designed with security, performance, and data integrity in mind.

## Schema

### Users Table

The `users` table stores user account information with secure password hashing.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Constraints
- Email format validation (regex pattern)
- Role validation ('user' or 'admin')
- Email length (5-255 characters)
- Password hash minimum length (60 characters for Argon2)

#### Indexes
- `idx_users_email`: Email lookup
- `idx_users_role`: Role-based queries
- `idx_users_created_at`: Timestamp ordering

### Vault Entries Table

The `vault_entries` table stores encrypted password entries with metadata.

```sql
CREATE TABLE vault_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    url TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Constraints
- Name length (1-255 characters)
- Username length (1-255 characters when present)
- Category length (1-100 characters)
- URL length (max 2048 characters)
- Non-empty encrypted data

#### Indexes
- `idx_vault_entries_user_id`: User's entries
- `idx_vault_entries_category`: Category filtering
- `idx_vault_entries_name`: Entry name search
- `idx_vault_entries_user_category`: User's category filtering
- `idx_vault_entries_user_created`: User's entry timeline
- `idx_vault_entries_created_at`: Global timeline

## Relationships

1. **User → Vault Entries (1:N)**
   - One user can have multiple vault entries
   - Vault entries are deleted when user is deleted (CASCADE)
   - Foreign key: `vault_entries.user_id → users.id`

## Automatic Updates

Both tables implement automatic `updated_at` timestamp updates via triggers:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

## Security Features

1. **UUID Primary Keys**
   - Uses `gen_random_uuid()` for unpredictable IDs
   - Prevents sequential ID enumeration attacks

2. **Cascading Deletes**
   - Ensures no orphaned entries when users are deleted
   - Maintains referential integrity

3. **Data Validation**
   - Email format validation
   - Length constraints on all string fields
   - Role validation
   - Password hash minimum length

## Performance Optimization

1. **Indexes**
   - Optimized for common queries
   - Compound indexes for filtered searches
   - Descending indexes for timeline queries

2. **Constraints**
   - Enforces data integrity
   - Prevents invalid data
   - Optimizes query planning

## Best Practices

1. **Data Access**
   - Always use parameterized queries
   - Implement proper error handling
   - Use transactions for multi-table operations

2. **Security**
   - Never store plaintext passwords
   - Use Argon2id for password hashing
   - Encrypt sensitive data before storage

3. **Performance**
   - Use appropriate indexes
   - Monitor query performance
   - Regular maintenance (VACUUM, ANALYZE)

## Migrations

Database changes are managed through numbered migration files:

1. `001_create_users_table.sql`
2. `002_create_vault_entries_table.sql`
3. Additional migrations for features and fixes

### Running Migrations

```bash
# Development
npm run migrate:dev

# Production
npm run migrate:prod
```

## Backup and Recovery

1. **Regular Backups**
   ```bash
   pg_dump -Fc lockr > backup.dump
   ```

2. **Recovery**
   ```bash
   pg_restore -d lockr backup.dump
   ```

## Monitoring

Monitor these aspects for optimal performance:

1. **Indexes**
   - Usage statistics
   - Missing indexes
   - Unused indexes

2. **Queries**
   - Slow queries
   - Query plans
   - Lock contention

3. **Storage**
   - Table sizes
   - Index sizes
   - Growth rate 