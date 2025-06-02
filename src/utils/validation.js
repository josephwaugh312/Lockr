/**
 * Email validation using regex
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL validation using regex
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Password strength validation
 * Requires: 8+ chars, uppercase, lowercase, number, special char
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with success and errors
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required']
    };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user registration data
 * @param {object} userData - User data to validate
 * @returns {object} - Validation result
 */
function validateRegistrationData(userData) {
  const errors = [];

  if (!userData || typeof userData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Email validation
  if (!userData.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(userData.email)) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!userData.password) {
    errors.push('Password is required');
  } else {
    const passwordValidation = validatePasswordStrength(userData.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }

  // Master password validation
  if (!userData.masterPassword) {
    errors.push('Master password is required');
  } else {
    const masterPasswordValidation = validatePasswordStrength(userData.masterPassword);
    if (!masterPasswordValidation.isValid) {
      errors.push(...masterPasswordValidation.errors.map(err => 
        err.replace('Password', 'Master password')
      ));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user login data
 * @param {object} loginData - Login data to validate
 * @returns {object} - Validation result
 */
function validateLoginData(loginData) {
  const errors = [];

  if (!loginData || typeof loginData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Email validation
  if (!loginData.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(loginData.email)) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!loginData.password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate password change data
 * @param {object} changeData - Password change data to validate
 * @returns {object} - Validation result
 */
function validatePasswordChangeData(changeData) {
  const errors = [];

  if (!changeData || typeof changeData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Current password validation
  if (!changeData.currentPassword) {
    errors.push('Current password is required');
  }

  // New password validation
  if (!changeData.newPassword) {
    errors.push('New password is required');
  } else {
    const passwordValidation = validatePasswordStrength(changeData.newPassword);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors.map(err => 
        err.replace('Password', 'New password')
      ));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate account deletion data
 * @param {object} deleteData - Account deletion data to validate
 * @returns {object} - Validation result
 */
function validateAccountDeletionData(deleteData) {
  const errors = [];

  if (!deleteData || typeof deleteData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Password validation
  if (!deleteData.password) {
    errors.push('Password confirmation is required');
  }

  // Confirmation validation
  if (!deleteData.confirmDelete) {
    errors.push('Delete confirmation is required');
  } else if (deleteData.confirmDelete !== 'DELETE') {
    errors.push('Please type "DELETE" to confirm account deletion');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate refresh token data
 * @param {object} refreshData - Refresh token data to validate
 * @returns {object} - Validation result
 */
function validateRefreshTokenData(refreshData) {
  const errors = [];

  if (!refreshData || typeof refreshData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  if (!refreshData.refreshToken) {
    errors.push('Refresh token is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate vault unlock data
 * @param {object} unlockData - Vault unlock data to validate
 * @returns {object} - Validation result
 */
function validateVaultUnlockData(unlockData) {
  const errors = [];

  if (!unlockData || typeof unlockData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  if (!unlockData.masterPassword) {
    errors.push('Master password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate vault entry data
 * @param {object} entryData - Entry data to validate
 * @returns {object} - Validation result
 */
function validateVaultEntryData(entryData) {
  const errors = [];

  if (!entryData || typeof entryData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Entry name is required
  if (!entryData.name || typeof entryData.name !== 'string' || entryData.name.trim().length === 0) {
    errors.push('Entry name is required');
  } else if (entryData.name.length > 255) {
    errors.push('Entry name must be less than 255 characters');
  }

  // Must have either username or password
  if (!entryData.username && !entryData.password) {
    errors.push('Entry must have either username or password');
  }

  // URL validation if provided
  if (entryData.url && !isValidUrl(entryData.url)) {
    errors.push('Please provide a valid URL');
  }

  // Category validation
  if (entryData.category && typeof entryData.category !== 'string') {
    errors.push('Category must be a string');
  }

  // Notes length validation
  if (entryData.notes && entryData.notes.length > 1000) {
    errors.push('Notes must be less than 1000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate password generation options
 * @param {object} options - Password generation options
 * @returns {object} - Validation result
 */
function validatePasswordGenerationOptions(options = {}) {
  const errors = [];

  // Length validation
  if (options.length !== undefined) {
    if (typeof options.length !== 'number' || !Number.isInteger(options.length)) {
      errors.push('Password length must be a number');
    } else if (options.length < 8) {
      errors.push('Password length must be at least 8 characters');
    } else if (options.length > 128) {
      errors.push('Password length must be less than 128 characters');
    }
  }

  // Boolean option validation
  const booleanOptions = [
    'includeUppercase',
    'includeLowercase', 
    'includeNumbers',
    'includeSymbols',
    'excludeSimilar',
    'excludeAmbiguous'
  ];

  for (const option of booleanOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'boolean') {
      errors.push(`${option} must be a boolean value`);
    }
  }

  // Must include at least one character type
  const hasUppercase = options.includeUppercase !== false;
  const hasLowercase = options.includeLowercase !== false;
  const hasNumbers = options.includeNumbers !== false;
  const hasSymbols = options.includeSymbols !== false;

  if (!hasUppercase && !hasLowercase && !hasNumbers && !hasSymbols) {
    errors.push('At least one character type must be included');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate master password change data
 * @param {object} changeData - Master password change data
 * @returns {object} - Validation result
 */
function validateMasterPasswordChangeData(changeData) {
  const errors = [];

  if (!changeData || typeof changeData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Current master password validation
  if (!changeData.currentMasterPassword) {
    errors.push('Current master password is required');
  }

  // New master password validation
  if (!changeData.newMasterPassword) {
    errors.push('New master password is required');
  } else {
    const passwordValidation = validatePasswordStrength(changeData.newMasterPassword);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors.map(err => 
        err.replace('Password', 'New master password')
      ));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate vault search data
 * @param {object} searchData - Search data to validate
 * @returns {object} - Validation result
 */
function validateVaultSearchData(searchData) {
  const errors = [];

  if (!searchData || typeof searchData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request data']
    };
  }

  // Query validation
  if (searchData.query && typeof searchData.query !== 'string') {
    errors.push('Search query must be a string');
  }

  // Category validation
  if (searchData.category && typeof searchData.category !== 'string') {
    errors.push('Category must be a string');
  }

  // Must have either query or category
  if (!searchData.query && !searchData.category) {
    errors.push('Search must include either query or category');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} - True if valid UUID format
 */
const isValidUUID = (uuid) => {
  if (typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

module.exports = {
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
  isValidUUID
}; 