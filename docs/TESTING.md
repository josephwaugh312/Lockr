# Testing Guide

## Overview

The Lockr test suite uses Jest for testing and includes:
- Unit tests for utilities and services
- Integration tests for controllers
- Security tests for authentication and encryption
- End-to-end tests for critical flows

## Test Organization

Tests are organized by component type:

```
tests/
├── controllers/        # API endpoint tests
│   ├── auth.test.js   # Authentication endpoints
│   ├── vault.test.js  # Vault operations
│   └── user.test.js   # User management
├── services/          # Business logic tests
│   ├── crypto.test.js # Encryption/decryption
│   └── email.test.js  # Email notifications
├── models/            # Database model tests
└── utils/            # Utility function tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/controllers/vault.test.js

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with detailed logging
npm test -- --verbose

# Run tests with open handle detection
npm test -- --detectOpenHandles
```

## Test Utilities

### Database Cleanup
```javascript
beforeEach(async () => {
  // Clear data with retries for deadlocks
  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await vaultRepository.clear();
      await userRepository.clear();
      break;
    } catch (error) {
      if (error.code === '40P01' && retries < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
        continue;
      }
      throw error;
    }
  }
});
```

### Test Data Generation
```javascript
const validUser = {
  email: 'test@example.com',
  password: 'SecurePassword123!'
};

const validEntry = {
  title: 'Gmail Account',
  username: 'user@gmail.com',
  password: 'SecurePassword123!',
  website: 'https://gmail.com',
  notes: 'Personal email account',
  category: 'Email'
};
```

### Authentication Helper
```javascript
const getAuthToken = async (user) => {
  const response = await request(app)
    .post('/auth/login')
    .send(user);
  return response.body.tokens.accessToken;
};
```

### Encryption Helper
```javascript
const generateEncryptionKey = () => {
  const keyBuffer = crypto.randomBytes(32);
  return keyBuffer.toString('base64');
};
```

## Writing Tests

### Controller Test Example
```javascript
describe('VaultController', () => {
  let app;
  let accessToken;
  let encryptionKey;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Setup authentication
    const user = await createTestUser();
    accessToken = await getAuthToken(user);
    
    // Generate encryption key
    encryptionKey = generateEncryptionKey();
    
    // Clear test data
    await clearTestData();
  });

  describe('POST /vault/entries', () => {
    test('should create new vault entry successfully', async () => {
      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...validEntry,
          encryptionKey
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Entry created successfully');
      expect(response.body.entry).toHaveProperty('id');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required');
    });
  });
});
```

### Service Test Example
```javascript
describe('CryptoService', () => {
  let cryptoService;
  let encryptionKey;

  beforeEach(() => {
    cryptoService = new CryptoService();
    encryptionKey = crypto.randomBytes(32);
  });

  test('should encrypt and decrypt data', async () => {
    const data = 'sensitive data';
    
    const encrypted = await cryptoService.encrypt(data, encryptionKey);
    const decrypted = await cryptoService.decrypt(encrypted, encryptionKey);
    
    expect(decrypted).toBe(data);
  });
});
```

## Test Categories

### Authentication Tests
- User registration
- Login/logout
- Password reset
- Token refresh
- Two-factor authentication
- Session management

### Vault Tests
- Entry CRUD operations
- Search functionality
- Import/export
- Password generation
- Master password change
- Encryption/decryption

### Security Tests
- Input validation
- Rate limiting
- Token validation
- Encryption key validation
- Error handling
- Data sanitization

### Database Tests
- Model operations
- Constraints
- Relationships
- Transactions
- Error handling

## Best Practices

1. **Test Setup**
   - Use `beforeEach` for test data setup
   - Clean up data after tests
   - Handle database deadlocks
   - Use proper timeouts

2. **Test Organization**
   - Group related tests with `describe`
   - Use clear test descriptions
   - Test both success and failure cases
   - Test edge cases

3. **Assertions**
   - Use specific assertions
   - Check response status codes
   - Validate response formats
   - Test error messages

4. **Security**
   - Test authentication requirements
   - Validate encryption
   - Check access control
   - Test rate limiting

5. **Performance**
   - Minimize database operations
   - Use proper cleanup
   - Handle async operations
   - Avoid test interdependence

## Common Issues

1. **Database Deadlocks**
   - Use retry logic
   - Clear data in correct order
   - Add delays between retries
   - Log deadlock details

2. **Async Operations**
   - Use proper async/await
   - Handle promises correctly
   - Set appropriate timeouts
   - Clean up resources

3. **Test Isolation**
   - Clear data between tests
   - Don't share state
   - Use unique test data
   - Handle concurrent tests

4. **Memory Leaks**
   - Clear intervals/timeouts
   - Close database connections
   - Clean up event listeners
   - Use `--detectOpenHandles`

## Coverage Requirements

- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%

Run coverage report:
```bash
npm run test:coverage
```

## Debugging Tests

1. **Verbose Output**
   ```bash
   npm test -- --verbose
   ```

2. **Open Handles**
   ```bash
   npm test -- --detectOpenHandles
   ```

3. **Single Test**
   ```bash
   npm test -- tests/controllers/vault.test.js -t "should create new vault entry"
   ```

4. **Debug Mode**
   ```bash
   npm run test:debug
   ``` 