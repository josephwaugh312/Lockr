/**
 * @jest-environment node
 */

const {
  isValidEmail,
  isValidUrl,
  validatePasswordStrength,
  validateRegistrationData,
  validateLoginData,
  validatePasswordChangeData,
  validateAccountDeletionData,
  validateRefreshTokenData,
  validateVaultUnlockData,
  validateVaultEntryData,
  validatePasswordGenerationOptions,
  validateMasterPasswordChangeData,
  validateVaultSearchData,
  isValidUUID,
  validatePasswordResetRequest,
  validatePasswordResetCompletion,
  validateMasterPasswordResetRequest,
  validateMasterPasswordResetCompletion
} = require('../../src/utils/validation');

describe('Email Validation', () => {
  describe('isValidEmail', () => {
    test('validates correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin@subdomain.example.org',
        'user+tag@example.com',
        'name123@test123.com'
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    test('rejects invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain', // This might pass with the current regex
        'user@.com',
        '',
        'user name@domain.com'
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });
});

describe('URL Validation', () => {
  describe('isValidUrl', () => {
    test('validates correct URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'https://subdomain.example.co.uk/path',
        'https://example.com:8080',
        'https://example.com/path?param=value#hash'
      ];

      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    test('rejects invalid URL formats', () => {
      const invalidUrls = [
        'invalid-url',
        'just-text',
        'http://',
        '',
        'www.example.com' // Missing protocol
      ];

      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });
});

describe('Password Strength Validation', () => {
  describe('validatePasswordStrength', () => {
    test('validates strong passwords', () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MySecure@Pass1',
        'Complex#Password99'
      ];

      strongPasswords.forEach(password => {
        const result = validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('rejects passwords that are too short', () => {
      const result = validatePasswordStrength('short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('rejects passwords missing lowercase letters', () => {
      const result = validatePasswordStrength('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('rejects passwords missing uppercase letters', () => {
      const result = validatePasswordStrength('password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('rejects passwords missing numbers', () => {
      const result = validatePasswordStrength('PasswordOnly!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('rejects passwords missing special characters', () => {
      const result = validatePasswordStrength('Password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    test('handles null and undefined passwords', () => {
      const nullResult = validatePasswordStrength(null);
      const undefinedResult = validatePasswordStrength(undefined);
      const emptyResult = validatePasswordStrength('');

      [nullResult, undefinedResult, emptyResult].forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is required');
      });
    });

    test('handles non-string passwords', () => {
      const result = validatePasswordStrength(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });
  });
});

describe('Registration Data Validation', () => {
  describe('validateRegistrationData', () => {
    test('validates complete valid registration data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!'
      };

      const result = validateRegistrationData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('handles string input instead of object', () => {
      const result = validateRegistrationData('not an object');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid request data');
    });

    test('validates data with undefined smsNotifications', () => {
      const validData = {
        email: 'user@example.com',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!',
        smsNotifications: undefined
      };

      const result = validateRegistrationData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates registration data with optional phone number', () => {
      const validData = {
        email: 'user@example.com',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!',
        phoneNumber: '+1234567890',
        smsNotifications: true
      };

      const result = validateRegistrationData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing email', () => {
      const invalidData = {
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid email address');
    });

    test('rejects missing password', () => {
      const invalidData = {
        email: 'user@example.com',
        masterPassword: 'MasterPassword456!'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    test('rejects weak password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'weak',
        masterPassword: 'MasterPassword456!'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('rejects missing master password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'StrongPassword123!'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Master password is required');
    });

    test('rejects invalid phone number format', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!',
        phoneNumber: '1234567890' // Missing + prefix
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must be in international format (e.g., +1234567890)');
    });

    test('rejects invalid SMS notifications value', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'StrongPassword123!',
        masterPassword: 'MasterPassword456!',
        smsNotifications: 'yes'
      };

      const result = validateRegistrationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SMS notifications preference must be true or false');
    });

    test('handles null and undefined input', () => {
      const nullResult = validateRegistrationData(null);
      const undefinedResult = validateRegistrationData(undefined);

      [nullResult, undefinedResult].forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid request data');
      });
    });
  });
});

describe('Login Data Validation', () => {
  describe('validateLoginData', () => {
    test('validates complete valid login data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'password123'
      };

      const result = validateLoginData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing email', () => {
      const invalidData = {
        password: 'password123'
      };

      const result = validateLoginData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = validateLoginData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid email address');
    });

    test('rejects missing password', () => {
      const invalidData = {
        email: 'user@example.com'
      };

      const result = validateLoginData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    test('handles null and undefined input', () => {
      const nullResult = validateLoginData(null);
      const undefinedResult = validateLoginData(undefined);

      [nullResult, undefinedResult].forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid request data');
      });
    });
  });
});

describe('Password Change Data Validation', () => {
  describe('validatePasswordChangeData', () => {
    test('validates complete valid password change data', () => {
      const validData = {
        currentPassword: 'oldPassword',
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordChangeData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('handles array input', () => {
      const result = validatePasswordChangeData([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Current password is required');
    });

    test('rejects missing current password', () => {
      const invalidData = {
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Current password is required');
    });

    test('rejects missing new password', () => {
      const invalidData = {
        currentPassword: 'oldPassword'
      };

      const result = validatePasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password is required');
    });

    test('rejects weak new password', () => {
      const invalidData = {
        currentPassword: 'oldPassword',
        newPassword: 'weak'
      };

      const result = validatePasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password must be at least 8 characters long');
    });
  });
});

describe('Account Deletion Data Validation', () => {
  describe('validateAccountDeletionData', () => {
    test('validates complete valid account deletion data', () => {
      const validData = {
        password: 'password123',
        confirmDelete: 'DELETE'
      };

      const result = validateAccountDeletionData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('handles empty string input', () => {
      const result = validateAccountDeletionData('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid request data');
    });

    test('rejects missing password', () => {
      const invalidData = {
        confirmDelete: 'DELETE'
      };

      const result = validateAccountDeletionData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password confirmation is required');
    });

    test('rejects missing delete confirmation', () => {
      const invalidData = {
        password: 'password123'
      };

      const result = validateAccountDeletionData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Delete confirmation is required');
    });

    test('rejects wrong delete confirmation text', () => {
      const invalidData = {
        password: 'password123',
        confirmDelete: 'CONFIRM'
      };

      const result = validateAccountDeletionData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please type "DELETE" to confirm account deletion');
    });
  });
});

describe('Refresh Token Data Validation', () => {
  describe('validateRefreshTokenData', () => {
    test('validates valid refresh token data', () => {
      const validData = {
        refreshToken: 'valid-refresh-token'
      };

      const result = validateRefreshTokenData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing refresh token', () => {
      const invalidData = {};

      const result = validateRefreshTokenData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Refresh token is required');
    });
  });
});

describe('Vault Unlock Data Validation', () => {
  describe('validateVaultUnlockData', () => {
    test('validates valid vault unlock data', () => {
      const validData = {
        masterPassword: 'masterPassword123'
      };

      const result = validateVaultUnlockData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing master password', () => {
      const invalidData = {};

      const result = validateVaultUnlockData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Master password is required');
    });
  });
});

describe('Vault Entry Data Validation', () => {
  describe('validateVaultEntryData', () => {
    test('validates complete valid vault entry data', () => {
      const validData = {
        title: 'Test Entry',
        username: 'testuser',
        password: 'testpass',
        email: 'test@example.com',
        website: 'https://example.com',
        category: 'login',
        notes: 'Test notes'
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates card category without username or password', () => {
      const validData = {
        title: 'Credit Card',
        category: 'card'
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates note category without username or password', () => {
      const validData = {
        title: 'Secure Note',
        category: 'note',
        notes: 'Important information'
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates entry with only title and username', () => {
      const validData = {
        title: 'Test Entry',
        username: 'testuser'
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates entry with only title and password', () => {
      const validData = {
        title: 'Test Entry',
        password: 'testpass'
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects empty title', () => {
      const invalidData = {
        title: '',
        username: 'testuser'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entry title is required');
    });

    test('rejects missing title', () => {
      const invalidData = {
        username: 'testuser'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entry title is required');
    });

    test('rejects title over 255 characters', () => {
      const invalidData = {
        title: 'a'.repeat(256),
        username: 'testuser'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entry title must be less than 255 characters');
    });

    test('rejects entry without username or password', () => {
      const invalidData = {
        title: 'Test Entry'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entry must have either username or password');
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'testuser',
        email: 'invalid-email'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid email address');
    });

    test('rejects invalid username that looks like email', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'invalid@email'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username appears to be an email but is not valid');
    });

    test('rejects username with invalid characters', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'user<script>'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username contains invalid characters or patterns');
    });

    test('rejects username with invalid string in it', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'invaliduser'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username contains invalid characters or patterns');
    });

    test('accepts username without special patterns', () => {
      const validData = {
        title: 'Test Entry',
        username: 'username123',
        password: 'testpass'  // Need either username or password
      };

      const result = validateVaultEntryData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid website URL', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'testuser',
        website: 'invalid-url'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid URL');
    });

    test('rejects invalid category', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'testuser',
        category: 'invalid-category'
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid category. Must be one of: login, card, note, wifi, Email, Social, Banking, Shopping, Work, Personal');
    });

    test('rejects notes over 1000 characters', () => {
      const invalidData = {
        title: 'Test Entry',
        username: 'testuser',
        notes: 'a'.repeat(1001)
      };

      const result = validateVaultEntryData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notes must be less than 1000 characters');
    });
  });
});

describe('Password Generation Options Validation', () => {
  describe('validatePasswordGenerationOptions', () => {
    test('validates default empty options', () => {
      const result = validatePasswordGenerationOptions({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates when passed undefined', () => {
      const result = validatePasswordGenerationOptions();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates complete valid options', () => {
      const validOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };

      const result = validatePasswordGenerationOptions(validOptions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects length below minimum', () => {
      const invalidOptions = {
        length: 5
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password length must be at least 8 characters');
    });

    test('rejects length above maximum', () => {
      const invalidOptions = {
        length: 150
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password length must be less than 128 characters');
    });

    test('rejects non-integer length', () => {
      const invalidOptions = {
        length: 12.5
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password length must be a number');
    });

    test('rejects non-boolean options', () => {
      const invalidOptions = {
        includeUppercase: 'yes'
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('includeUppercase must be a boolean value');
    });

    test('rejects options with no character types', () => {
      const invalidOptions = {
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one character type must be included');
    });

    test('validates with only excludeSimilar option', () => {
      const validOptions = {
        excludeSimilar: true
      };

      const result = validatePasswordGenerationOptions(validOptions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates with only excludeAmbiguous option', () => {
      const validOptions = {
        excludeAmbiguous: true
      };

      const result = validatePasswordGenerationOptions(validOptions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects multiple non-boolean options', () => {
      const invalidOptions = {
        includeLowercase: 'yes',
        includeNumbers: 123,
        excludeSimilar: null
      };

      const result = validatePasswordGenerationOptions(invalidOptions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('includeLowercase must be a boolean value');
      expect(result.errors).toContain('includeNumbers must be a boolean value');
      expect(result.errors).toContain('excludeSimilar must be a boolean value');
    });
  });
});

describe('Master Password Change Data Validation', () => {
  describe('validateMasterPasswordChangeData', () => {
    test('validates complete valid master password change data', () => {
      const validData = {
        currentMasterPassword: 'oldMasterPassword',
        newMasterPassword: 'NewMasterPassword123!'
      };

      const result = validateMasterPasswordChangeData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing current master password', () => {
      const invalidData = {
        newMasterPassword: 'NewMasterPassword123!'
      };

      const result = validateMasterPasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Current master password is required');
    });

    test('rejects missing new master password', () => {
      const invalidData = {
        currentMasterPassword: 'oldMasterPassword'
      };

      const result = validateMasterPasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New master password is required');
    });

    test('rejects weak new master password', () => {
      const invalidData = {
        currentMasterPassword: 'oldMasterPassword',
        newMasterPassword: 'weak'
      };

      const result = validateMasterPasswordChangeData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New master password must be at least 8 characters long');
    });
  });
});

describe('Vault Search Data Validation', () => {
  describe('validateVaultSearchData', () => {
    test('validates search data with query', () => {
      const validData = {
        query: 'test search'
      };

      const result = validateVaultSearchData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates search data with category', () => {
      const validData = {
        category: 'login'
      };

      const result = validateVaultSearchData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates search data with both query and category', () => {
      const validData = {
        query: 'test search',
        category: 'login'
      };

      const result = validateVaultSearchData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects search data with neither query nor category', () => {
      const invalidData = {};

      const result = validateVaultSearchData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search must include either query or category');
    });

    test('rejects non-string query', () => {
      const invalidData = {
        query: 123
      };

      const result = validateVaultSearchData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query must be a string');
    });

    test('rejects non-string category', () => {
      const invalidData = {
        category: 123
      };

      const result = validateVaultSearchData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Category must be a string');
    });
  });
});

describe('UUID Validation', () => {
  describe('isValidUUID', () => {
    test('validates correct UUID formats', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      ];

      validUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    test('rejects invalid UUID formats', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '550e8400-e29b-41d4-a716-44665544000', // Too short
        '550e8400-e29b-41d4-a716-4466554400000', // Too long
        '550e8400-e29b-41d4-g716-446655440000', // Invalid character
        '',
        null,
        undefined,
        123
      ];

      invalidUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });
  });
});

describe('Password Reset Request Validation', () => {
  describe('validatePasswordResetRequest', () => {
    test('validates valid password reset request', () => {
      const validData = {
        email: 'user@example.com'
      };

      const result = validatePasswordResetRequest(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing email', () => {
      const invalidData = {};

      const result = validatePasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('rejects non-string email', () => {
      const invalidData = {
        email: 123
      };

      const result = validatePasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be a string');
    });

    test('rejects email over 255 characters', () => {
      const invalidData = {
        email: 'a'.repeat(250) + '@example.com' // Over 255 chars
      };

      const result = validatePasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be less than 255 characters');
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        email: 'invalid-email'
      };

      const result = validatePasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });
  });
});

describe('Password Reset Completion Validation', () => {
  describe('validatePasswordResetCompletion', () => {
    test('validates valid password reset completion', () => {
      const validData = {
        token: 'a'.repeat(64), // 64 character hex string
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordResetCompletion(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing token', () => {
      const invalidData = {
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reset token is required');
    });

    test('rejects non-string token', () => {
      const invalidData = {
        token: 123,
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reset token must be a string');
    });

    test('rejects token with wrong length', () => {
      const invalidData = {
        token: 'a'.repeat(32), // Wrong length
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid reset token format');
    });

    test('rejects token with invalid characters', () => {
      const invalidData = {
        token: 'g'.repeat(64), // Invalid hex character
        newPassword: 'NewStrongPassword123!'
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reset token contains invalid characters');
    });

    test('rejects missing new password', () => {
      const invalidData = {
        token: 'a'.repeat(64)
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password is required');
    });

    test('rejects weak new password', () => {
      const invalidData = {
        token: 'a'.repeat(64),
        newPassword: 'weak'
      };

      const result = validatePasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password must be at least 8 characters long');
    });
  });
});

describe('Master Password Reset Request Validation', () => {
  describe('validateMasterPasswordResetRequest', () => {
    test('validates valid master password reset request', () => {
      const validData = {
        email: 'user@example.com',
        confirmed: true
      };

      const result = validateMasterPasswordResetRequest(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing email', () => {
      const invalidData = {
        confirmed: true
      };

      const result = validateMasterPasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('rejects invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        confirmed: true
      };

      const result = validateMasterPasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please provide a valid email address');
    });

    test('rejects missing confirmation', () => {
      const invalidData = {
        email: 'user@example.com'
      };

      const result = validateMasterPasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('You must confirm that you understand all vault data will be permanently deleted');
    });

    test('rejects false confirmation', () => {
      const invalidData = {
        email: 'user@example.com',
        confirmed: false
      };

      const result = validateMasterPasswordResetRequest(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('You must confirm that you understand all vault data will be permanently deleted');
    });
  });
});

describe('Master Password Reset Completion Validation', () => {
  describe('validateMasterPasswordResetCompletion', () => {
    test('validates valid master password reset completion', () => {
      const validData = {
        token: 'a'.repeat(64),
        newMasterPassword: 'NewMasterPassword123!',
        confirmed: true
      };

      const result = validateMasterPasswordResetCompletion(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects missing token', () => {
      const invalidData = {
        newMasterPassword: 'NewMasterPassword123!',
        confirmed: true
      };

      const result = validateMasterPasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reset token is required');
    });

    test('rejects invalid token format', () => {
      const invalidData = {
        token: 'invalid-token',
        newMasterPassword: 'NewMasterPassword123!',
        confirmed: true
      };

      const result = validateMasterPasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid reset token format');
    });

    test('rejects missing new master password', () => {
      const invalidData = {
        token: 'a'.repeat(64),
        confirmed: true
      };

      const result = validateMasterPasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New master password is required');
    });

    test('rejects weak new master password', () => {
      const invalidData = {
        token: 'a'.repeat(64),
        newMasterPassword: 'weak',
        confirmed: true
      };

      const result = validateMasterPasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New master password must be at least 8 characters long');
    });

    test('rejects missing confirmation', () => {
      const invalidData = {
        token: 'a'.repeat(64),
        newMasterPassword: 'NewMasterPassword123!'
      };

      const result = validateMasterPasswordResetCompletion(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('You must confirm that you understand all vault data will be permanently deleted');
    });
  });
});