# Lockr API Documentation

## Authentication

All API endpoints require authentication using JWT tokens. Send the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Most vault operations also require an encryption key in the request body for zero-knowledge encryption/decryption:

```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  ...other_fields
}
```

## Endpoints

### Vault Management

#### POST /vault/unlock
Unlocks the vault using the encryption key.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key"
}
```

**Response:**
```json
{
  "message": "Vault unlocked successfully",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

#### POST /vault/lock
Locks the vault.

**Response:**
```json
{
  "message": "Vault locked successfully",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### Entry Management

#### POST /vault/entries
Creates a new vault entry.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  "title": "Gmail Account",
  "username": "user@gmail.com",
  "password": "SecurePassword123!",
  "website": "https://gmail.com",
  "notes": "Personal email account",
  "category": "Email"
}
```

**Response:**
```json
{
  "message": "Entry created successfully",
  "entry": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "category": "Email",
    "createdAt": "2025-08-04T18:47:09.886Z",
    "updatedAt": "2025-08-04T18:47:09.886Z"
  }
}
```

#### POST /vault/entries/list
Lists all vault entries.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  "page": 1,
  "limit": 50,
  "category": "Email"
}
```

**Response:**
```json
{
  "entries": [{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Gmail Account",
    "username": "user@gmail.com",
    "website": "https://gmail.com",
    "category": "Email",
    "createdAt": "2025-08-04T18:47:09.886Z",
    "updatedAt": "2025-08-04T18:47:09.886Z"
  }],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

#### GET /vault/entries/:id
Gets a specific vault entry.

**Query Parameters:**
- `encryptionKey`: Base64 encoded encryption key

**Response:**
```json
{
  "entry": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Gmail Account",
    "title": "Gmail Account",
    "username": "user@gmail.com",
    "password": "SecurePassword123!",
    "website": "https://gmail.com",
    "notes": "Personal email account",
    "category": "Email",
    "createdAt": "2025-08-04T18:47:09.886Z",
    "updatedAt": "2025-08-04T18:47:09.886Z"
  }
}
```

#### PUT /vault/entries/:id
Updates a vault entry.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  "title": "Updated Gmail Account",
  "username": "updated@gmail.com",
  "password": "NewSecurePassword123!",
  "website": "https://gmail.com",
  "notes": "Updated notes",
  "category": "Email"
}
```

**Response:**
```json
{
  "message": "Entry updated successfully",
  "entry": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Updated Gmail Account",
    "category": "Email",
    "updatedAt": "2025-08-04T18:47:09.886Z"
  }
}
```

#### DELETE /vault/entries/:id
Deletes a vault entry.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key"
}
```

**Response:**
```json
{
  "message": "Entry deleted successfully",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### Search

#### POST /vault/search
Searches vault entries.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  "q": "gmail",
  "category": "Email"
}
```

**Response:**
```json
{
  "entries": [{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Gmail Account",
    "username": "user@gmail.com",
    "website": "https://gmail.com",
    "category": "Email",
    "createdAt": "2025-08-04T18:47:09.886Z",
    "updatedAt": "2025-08-04T18:47:09.886Z"
  }]
}
```

### Password Management

#### POST /vault/generate-password
Generates a secure password.

**Request:**
```json
{
  "length": 16,
  "includeUppercase": true,
  "includeLowercase": true,
  "includeNumbers": true,
  "includeSymbols": false,
  "excludeSimilar": true
}
```

**Response:**
```json
{
  "password": "GeneratedPassword123",
  "options": {
    "length": 16,
    "includeUppercase": true,
    "includeLowercase": true,
    "includeNumbers": true,
    "includeSymbols": false
  }
}
```

#### POST /vault/change-master-password
Changes the master password and re-encrypts all vault data.

**Request:**
```json
{
  "currentEncryptionKey": "base64_encoded_current_key",
  "newEncryptionKey": "base64_encoded_new_key"
}
```

**Response:**
```json
{
  "message": "Master password changed successfully",
  "reencryptedEntries": 1,
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### Import/Export

#### POST /vault/export
Exports vault data.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key"
}
```

**Response:**
```json
{
  "message": "Vault export completed successfully",
  "data": {
    "exportDate": "2025-08-04T18:47:09.886Z",
    "version": "1.0",
    "source": "Lockr Password Manager",
    "itemCount": 1,
    "items": [{
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Gmail Account",
      "username": "user@gmail.com",
      "website": "https://gmail.com",
      "category": "Email",
      "created": "2025-08-04T18:47:09.886Z",
      "lastUsed": "2025-08-04T18:47:09.886Z"
    }]
  }
}
```

#### POST /vault/import
Imports vault data.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key",
  "data": {
    "items": [{
      "title": "Imported Gmail",
      "username": "imported@gmail.com",
      "website": "https://gmail.com",
      "category": "Email",
      "notes": "Imported account"
    }]
  }
}
```

**Response:**
```json
{
  "message": "Vault import completed",
  "summary": {
    "totalItems": 1,
    "imported": 1,
    "errors": 0,
    "duplicates": 0
  },
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### Password Expiry

#### POST /vault/expiring-passwords
Checks for expiring passwords.

**Request:**
```json
{
  "encryptionKey": "base64_encoded_encryption_key"
}
```

**Response:**
```json
{
  "expiringPasswords": [{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Gmail Account",
    "daysUntilExpiry": 7
  }],
  "count": 1,
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid encryption key",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### 404 Not Found
```json
{
  "error": "Entry not found",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many unlock attempts. Please try again later.",
  "retryAfter": 60,
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "timestamp": "2025-08-04T18:47:09.886Z"
}
```

## Security Notes

1. All sensitive data must be encrypted before sending to the server
2. The server never sees plaintext passwords or sensitive data
3. The encryption key must be properly derived from the master password
4. All requests must use HTTPS
5. Rate limiting is enforced on sensitive operations
6. Authentication tokens expire after 15 minutes
7. Refresh tokens are required for extended sessions 