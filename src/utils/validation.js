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

module.exports = {
  isValidEmail,
  validatePasswordStrength,
  validateRegistrationData,
  validateLoginData,
  validatePasswordChangeData,
  validateAccountDeletionData,
  validateRefreshTokenData
}; 