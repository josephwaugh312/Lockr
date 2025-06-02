const crypto = require('crypto');

/**
 * Password generation utility with secure randomness
 */
class PasswordGenerator {
  constructor() {
    this.characterSets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      similarChars: 'il1Lo0O',
      ambiguousChars: '{}[]()/\\\'"`~,;.<>'
    };

    this.defaultOptions = {
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: false,
      excludeAmbiguous: false
    };
  }

  /**
   * Generate a secure password
   * @param {object} options - Password generation options
   * @returns {object} - Generated password and strength info
   */
  generatePassword(options = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    // Build character set based on options
    let charset = '';
    
    if (config.includeUppercase) {
      charset += this.characterSets.uppercase;
    }
    
    if (config.includeLowercase) {
      charset += this.characterSets.lowercase;
    }
    
    if (config.includeNumbers) {
      charset += this.characterSets.numbers;
    }
    
    if (config.includeSymbols) {
      charset += this.characterSets.symbols;
    }

    // Remove similar characters if requested
    if (config.excludeSimilar) {
      charset = this.removeChars(charset, this.characterSets.similarChars);
    }

    // Remove ambiguous characters if requested
    if (config.excludeAmbiguous) {
      charset = this.removeChars(charset, this.characterSets.ambiguousChars);
    }

    if (charset.length === 0) {
      throw new Error('No character types selected for password generation');
    }

    // Generate password using cryptographically secure randomness
    let password = '';
    const charsetArray = charset.split('');
    
    for (let i = 0; i < config.length; i++) {
      const randomIndex = this.getSecureRandomIndex(charsetArray.length);
      password += charsetArray[randomIndex];
    }

    // Ensure password meets requirements
    password = this.ensureRequirements(password, config);

    // Calculate password strength
    const strength = this.calculatePasswordStrength(password);

    return {
      password,
      strength,
      options: config
    };
  }

  /**
   * Remove specified characters from a string
   * @param {string} str - Source string
   * @param {string} charsToRemove - Characters to remove
   * @returns {string} - String with characters removed
   */
  removeChars(str, charsToRemove) {
    return str.split('').filter(char => !charsToRemove.includes(char)).join('');
  }

  /**
   * Get cryptographically secure random index
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} - Random index
   */
  getSecureRandomIndex(max) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    return randomValue % max;
  }

  /**
   * Ensure password meets all requirements
   * @param {string} password - Generated password
   * @param {object} config - Generation config
   * @returns {string} - Password meeting requirements
   */
  ensureRequirements(password, config) {
    let result = password;
    const positions = [];

    // Track which positions need which character types
    if (config.includeUppercase && !/[A-Z]/.test(result)) {
      positions.push({ type: 'uppercase', char: this.getRandomChar(this.characterSets.uppercase, config) });
    }

    if (config.includeLowercase && !/[a-z]/.test(result)) {
      positions.push({ type: 'lowercase', char: this.getRandomChar(this.characterSets.lowercase, config) });
    }

    if (config.includeNumbers && !/\d/.test(result)) {
      positions.push({ type: 'numbers', char: this.getRandomChar(this.characterSets.numbers, config) });
    }

    if (config.includeSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(result)) {
      positions.push({ type: 'symbols', char: this.getRandomChar(this.characterSets.symbols, config) });
    }

    // Replace characters to meet requirements
    for (let i = 0; i < positions.length && i < result.length; i++) {
      const replaceIndex = this.getSecureRandomIndex(result.length);
      result = result.substring(0, replaceIndex) + positions[i].char + result.substring(replaceIndex + 1);
    }

    return result;
  }

  /**
   * Get random character from character set
   * @param {string} charset - Character set
   * @param {object} config - Generation config
   * @returns {string} - Random character
   */
  getRandomChar(charset, config) {
    let validChars = charset;

    if (config.excludeSimilar) {
      validChars = this.removeChars(validChars, this.characterSets.similarChars);
    }

    if (config.excludeAmbiguous) {
      validChars = this.removeChars(validChars, this.characterSets.ambiguousChars);
    }

    const randomIndex = this.getSecureRandomIndex(validChars.length);
    return validChars[randomIndex];
  }

  /**
   * Calculate password strength
   * @param {string} password - Password to analyze
   * @returns {object} - Strength analysis
   */
  calculatePasswordStrength(password) {
    let score = 0;
    const checks = {
      length: false,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
      noRepeating: false,
      noSequential: false
    };

    // Length check
    if (password.length >= 8) checks.length = true;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character type checks
    if (/[A-Z]/.test(password)) {
      checks.uppercase = true;
      score += 1;
    }

    if (/[a-z]/.test(password)) {
      checks.lowercase = true;
      score += 1;
    }

    if (/\d/.test(password)) {
      checks.numbers = true;
      score += 1;
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      checks.symbols = true;
      score += 1;
    }

    // Repeating character check
    if (!/(.)\1{2,}/.test(password)) {
      checks.noRepeating = true;
      score += 1;
    }

    // Sequential character check
    if (!this.hasSequentialChars(password)) {
      checks.noSequential = true;
      score += 1;
    }

    // Determine strength level
    let level = 'Very Weak';
    if (score >= 2) level = 'Weak';
    if (score >= 4) level = 'Fair';
    if (score >= 6) level = 'Good';
    if (score >= 8) level = 'Strong';

    return {
      score,
      level,
      checks,
      entropy: this.calculateEntropy(password)
    };
  }

  /**
   * Check for sequential characters
   * @param {string} password - Password to check
   * @returns {boolean} - True if has sequential chars
   */
  hasSequentialChars(password) {
    const sequences = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    
    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const forward = sequence.substring(i, i + 3);
        const backward = forward.split('').reverse().join('');
        
        if (password.toLowerCase().includes(forward) || password.toLowerCase().includes(backward)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate password entropy
   * @param {string} password - Password to analyze
   * @returns {number} - Entropy in bits
   */
  calculateEntropy(password) {
    let charsetSize = 0;
    
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/\d/.test(password)) charsetSize += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) charsetSize += 32;

    return Math.log2(Math.pow(charsetSize, password.length));
  }

  /**
   * Generate multiple passwords
   * @param {number} count - Number of passwords to generate
   * @param {object} options - Generation options
   * @returns {array} - Array of password objects
   */
  generateMultiple(count = 5, options = {}) {
    const passwords = [];
    
    for (let i = 0; i < count; i++) {
      passwords.push(this.generatePassword(options));
    }
    
    return passwords;
  }

  /**
   * Generate passphrase using word list
   * @param {object} options - Passphrase options
   * @returns {object} - Generated passphrase
   */
  generatePassphrase(options = {}) {
    const config = {
      wordCount: 4,
      separator: '-',
      includeNumbers: false,
      capitalize: true,
      ...options
    };

    // Simple word list for passphrase generation
    const words = [
      'correct', 'horse', 'battery', 'staple', 'apple', 'orange', 'banana', 'grape',
      'computer', 'keyboard', 'monitor', 'mouse', 'window', 'garden', 'flower', 'tree',
      'mountain', 'ocean', 'river', 'forest', 'sunset', 'rainbow', 'thunder', 'lightning',
      'music', 'guitar', 'piano', 'violin', 'book', 'pencil', 'paper', 'story'
    ];

    let passphrase = '';
    const selectedWords = [];

    for (let i = 0; i < config.wordCount; i++) {
      let word = words[this.getSecureRandomIndex(words.length)];
      
      if (config.capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }

      if (config.includeNumbers) {
        word += this.getSecureRandomIndex(100);
      }

      selectedWords.push(word);
    }

    passphrase = selectedWords.join(config.separator);

    return {
      passphrase,
      words: selectedWords,
      strength: this.calculatePasswordStrength(passphrase),
      options: config
    };
  }
}

// Export singleton instance
module.exports = new PasswordGenerator(); 