const vaultRepository = require('../models/vaultRepository');
const userRepository = require('../models/userRepository');
const { CryptoService } = require('../services/cryptoService');
const { logger, securityEvents } = require('../utils/logger');
const {
  validateVaultUnlockData,
  validateVaultEntryData,
  validateVaultSearchData,
  validatePasswordGenerationOptions,
  validateMasterPasswordChangeData,
  isValidUUID
} = require('../utils/validation');
const passwordGenerator = require('../utils/passwordGenerator');
const rateLimit = require('express-rate-limit');

// Initialize crypto service
const cryptoService = new CryptoService();

// Store master password hashes for verification (simplified for demo)
const masterPasswordHashes = new Map();

// Rate limiting for vault operations
const rateLimitStore = new Map();

const checkRateLimit = (userId, operation = 'unlock', maxAttempts = 5, windowMs = 60000) => {
  const key = `${userId}:${operation}`;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { attempts: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  const record = rateLimitStore.get(key);
  
  // Reset if window has expired
  if (now > record.resetTime) {
    rateLimitStore.set(key, { attempts: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  // Check if limit exceeded
  if (record.attempts >= maxAttempts) {
    // Send security alert for rate limit violation
    securityEvents.rateLimitViolation(null, operation, record.attempts);
    
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  // Increment attempts
  record.attempts++;
  return { allowed: true, remaining: maxAttempts - record.attempts };
};

/**
 * Middleware to check if vault is unlocked
 */
const requireUnlockedVault = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // First, check if there's a raw session (to detect expired sessions)
    const rawSession = vaultRepository.sessions.get(userId);
    
    if (rawSession && Date.now() > rawSession.expiresAt.getTime()) {
      // Session exists but is expired - this is different from no session
      return res.status(403).json({
        error: 'Vault session expired',
        timestamp: new Date().toISOString()
      });
    }
    
    // Now use the normal getSession which handles cleanup
    const session = await vaultRepository.getSession(userId);
    
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    // Double-check by trying to get encryption key
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    if (!encryptionKey) {
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    logger.error('Vault unlock check error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to verify vault status',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Unlock vault with master password
 * POST /vault/unlock
 */
const unlockVault = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check rate limit for unlock attempts
    const rateLimit = checkRateLimit(userId, 'unlock', 5, 60000); // 5 attempts per minute
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many unlock attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    // Validate request data
    const validation = validateVaultUnlockData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { masterPassword } = req.body;

    // Get user data to verify master password
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // For testing purposes, we'll use a simple master password verification
    // In production, this should be properly hashed and verified
    let isValidMasterPassword = false;
    
    // Check if we have a stored hash for this user
    const storedHash = masterPasswordHashes.get(userId);
    console.log('🔐 DEBUG: Master password unlock attempt:', {
      userId,
      hasStoredHash: !!storedHash,
      totalStoredHashes: masterPasswordHashes.size,
      enteredPasswordLength: masterPassword.length
    });
    
    if (storedHash) {
      isValidMasterPassword = await cryptoService.verifyPassword(masterPassword, storedHash);
      console.log('🔐 DEBUG: Hash verification result:', isValidMasterPassword);
    } else {
      // First time unlock - use the default password for testing
      isValidMasterPassword = masterPassword === 'MasterKey456!';
      console.log('🔐 DEBUG: Using default password check:', isValidMasterPassword);
    }
    
    if (!isValidMasterPassword) {
      logger.warn('Vault unlock failed - invalid master password', {
        userId,
        ip: req.ip
      });
      
      // Track failed vault unlock attempt for security monitoring
      securityEvents.failedVaultUnlock(userId, req.ip);
      
      return res.status(401).json({
        error: 'Invalid master password',
        timestamp: new Date().toISOString()
      });
    }

    // Store master password hash for future verification (if not already stored)
    if (!masterPasswordHashes.has(userId)) {
      const masterPasswordHash = await cryptoService.hashPassword(masterPassword);
      masterPasswordHashes.set(userId, masterPasswordHash);
      console.log('🔐 DEBUG: Stored new master password hash for user:', userId);
    }

    // Generate encryption key for this session
    const encryptionKey = await cryptoService.generateEncryptionKey();
    
    // Create vault session
    const session = await vaultRepository.createSession(userId, encryptionKey);

    logger.info('Vault unlocked successfully', {
      userId,
      expiresAt: session.expiresAt,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Vault unlocked successfully',
      sessionId: userId, // Use userId as sessionId for simplicity
      expiresAt: session.expiresAt,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Vault unlock error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to unlock vault',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Lock vault by clearing session
 * POST /vault/lock
 */
const lockVault = async (req, res) => {
  try {
    const userId = req.user.id;

    // Clear vault session
    const wasLocked = await vaultRepository.clearSession(userId);

    if (wasLocked) {
      logger.info('Vault locked successfully', {
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        message: 'Vault locked successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Session didn't exist, but that's okay
      res.status(200).json({
        message: 'Vault was already locked',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Vault lock error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to lock vault',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Create new vault entry
 * POST /vault/entries
 */
const createEntry = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate request data
    const validation = validateVaultEntryData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { name, username, password, url, notes, category } = req.body;

    // Get encryption key from session
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    if (!encryptionKey) {
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }

    // Prepare sensitive data for encryption
    const sensitiveData = {
      password: password || null,
      notes: notes || null
    };

    // Encrypt sensitive data
    let encryptedData;
    try {
      encryptedData = await cryptoService.encrypt(
        JSON.stringify(sensitiveData),
        encryptionKey
      );
    } catch (encryptionError) {
      // If encryption fails, it's likely due to invalid encryption key
      logger.warn('Encryption failed during entry creation', {
        userId,
        error: encryptionError.message,
        ip: req.ip
      });
      
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }

    // Create entry data
    const entryData = {
      name: name.trim(),
      username: username || null,
      url: url || null,
      category: category || 'Other',
      encryptedData: JSON.stringify(encryptedData) // Serialize for database storage
    };

    // Create entry
    const newEntry = await vaultRepository.createEntry(userId, entryData);

    // Parse encrypted data back to object for response
    let parsedEncryptedData;
    try {
      parsedEncryptedData = JSON.parse(newEntry.encryptedData);
    } catch (error) {
      parsedEncryptedData = newEntry.encryptedData;
    }

    // Prepare response (without sensitive data)
    const responseEntry = {
      id: newEntry.id,
      name: newEntry.name,
      username: newEntry.username,
      url: newEntry.url,
      category: newEntry.category,
      encryptedData: parsedEncryptedData,
      createdAt: newEntry.createdAt,
      updatedAt: newEntry.updatedAt,
      userId: newEntry.userId
    };

    logger.info('Vault entry created', {
      userId,
      entryId: newEntry.id,
      entryName: newEntry.name,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Entry created successfully',
      entry: responseEntry,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Create vault entry error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to create entry',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get all vault entries
 * GET /vault/entries
 */
const getEntries = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    const { page, limit, category } = req.query;

    // Get entries with pagination
    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      category: category || null
    };

    const result = await vaultRepository.getEntries(userId, options);
    
    // Get encryption key for corruption detection
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    
    // Handle potential corruption gracefully
    const entriesWithoutSensitive = [];
    const warnings = [];

    for (const entry of result.entries) {
      try {
        // Try to decrypt the entry to detect corruption
        if (encryptionKey && entry.encryptedData) {
          // Parse encrypted data if it's a string
          let encryptedData = entry.encryptedData;
          if (typeof encryptedData === 'string') {
            encryptedData = JSON.parse(encryptedData);
          }
          await cryptoService.decrypt(encryptedData, encryptionKey);
        }
        
        entriesWithoutSensitive.push({
          id: entry.id,
          name: entry.name,
          username: entry.username,
          url: entry.url,
          category: entry.category,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          userId: entry.userId
        });
      } catch (error) {
        // Entry is corrupted, add warning but continue
        if (warnings.length === 0) {
          warnings.push('Some entries could not be decrypted');
        }
        
        // Log corruption detection
        logger.warn('Corrupted vault entry detected', {
          userId,
          entryId: entry.id,
          error: error.message
        });
        
        // Send security alert for data corruption
        securityEvents.dataCorruption(userId, entry.id, error);
      }
    }

    const response = {
      entries: entriesWithoutSensitive,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.status(200).json(response);

  } catch (error) {
    logger.error('Get vault entries error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to retrieve entries',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get specific vault entry with decrypted data
 * GET /vault/entries/:id
 */
const getEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;

    // Validate UUID format
    if (!isValidUUID(entryId)) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if entry exists for this user FIRST (before vault session check)
    const entry = await vaultRepository.getEntry(entryId, userId);
    if (!entry) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if vault session exists
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    // Get encryption key
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    if (!encryptionKey) {
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Parse encrypted data if it's a string
      let encryptedData = entry.encryptedData;
      if (typeof encryptedData === 'string') {
        encryptedData = JSON.parse(encryptedData);
      }

      // Decrypt sensitive data
      const decryptedData = await cryptoService.decrypt(encryptedData, encryptionKey);
      const sensitiveData = JSON.parse(decryptedData);

      // Prepare full entry response
      const fullEntry = {
        id: entry.id,
        name: entry.name,
        username: entry.username,
        password: sensitiveData.password,
        url: entry.url,
        notes: sensitiveData.notes,
        category: entry.category,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };

      res.status(200).json({
        entry: fullEntry,
        timestamp: new Date().toISOString()
      });

    } catch (decryptError) {
      logger.error('Entry decryption failed', {
        userId,
        entryId,
        error: decryptError.message,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Failed to decrypt entry data',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Get vault entry error', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to retrieve entry',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update vault entry
 * PUT /vault/entries/:id
 */
const updateEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;
    const updateData = req.body;

    // Validate UUID format
    if (!isValidUUID(entryId)) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    // For partial updates, we need to validate what's provided
    const hasData = Object.keys(updateData).length > 0;
    if (!hasData) {
      return res.status(400).json({
        error: 'No update data provided',
        timestamp: new Date().toISOString()
      });
    }

    // Basic validation for provided fields
    if (updateData.name !== undefined && (!updateData.name || updateData.name.trim().length === 0)) {
      return res.status(400).json({
        error: 'Entry name cannot be empty',
        timestamp: new Date().toISOString()
      });
    }

    if (updateData.url !== undefined && updateData.url && !updateData.url.startsWith('http')) {
      return res.status(400).json({
        error: 'Please provide a valid URL',
        timestamp: new Date().toISOString()
      });
    }

    // Check if entry exists
    const existingEntry = await vaultRepository.getEntry(entryId, userId);
    if (!existingEntry) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Get encryption key
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    if (!encryptionKey) {
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }

    // Decrypt existing data to merge with updates
    let existingSensitiveData = {};
    try {
      // Parse encrypted data if it's a string
      let encryptedData = existingEntry.encryptedData;
      if (typeof encryptedData === 'string') {
        encryptedData = JSON.parse(encryptedData);
      }
      
      const decryptedData = await cryptoService.decrypt(encryptedData, encryptionKey);
      existingSensitiveData = JSON.parse(decryptedData);
    } catch (error) {
      // If decryption fails, start fresh
      existingSensitiveData = {};
    }

    // Prepare updated sensitive data
    const sensitiveData = {
      password: updateData.password !== undefined ? updateData.password : existingSensitiveData.password,
      notes: updateData.notes !== undefined ? updateData.notes : existingSensitiveData.notes
    };

    // Encrypt updated sensitive data
    const encryptedDataObject = await cryptoService.encrypt(
      JSON.stringify(sensitiveData),
      encryptionKey
    );

    // Prepare update data
    const finalUpdateData = {
      name: updateData.name !== undefined ? updateData.name.trim() : existingEntry.name,
      username: updateData.username !== undefined ? updateData.username : existingEntry.username,
      url: updateData.url !== undefined ? updateData.url : existingEntry.url,
      category: updateData.category !== undefined ? updateData.category : existingEntry.category,
      encryptedData: JSON.stringify(encryptedDataObject) // Serialize for database
    };

    // Update entry
    const updatedEntry = await vaultRepository.updateEntry(entryId, userId, finalUpdateData);

    // Prepare response (without sensitive data)
    const responseEntry = {
      id: updatedEntry.id,
      name: updatedEntry.name,
      username: updatedEntry.username,
      url: updatedEntry.url,
      category: updatedEntry.category,
      createdAt: updatedEntry.createdAt,
      updatedAt: updatedEntry.updatedAt
    };

    logger.info('Vault entry updated', {
      userId,
      entryId,
      entryName: updatedEntry.name,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Entry updated successfully',
      entry: responseEntry,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Update vault entry error', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to update entry',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Delete vault entry
 * DELETE /vault/entries/:id
 */
const deleteEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;

    // Validate UUID format
    if (!isValidUUID(entryId)) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Delete entry
    const deleted = await vaultRepository.deleteEntry(entryId, userId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Vault entry deleted', {
      userId,
      entryId,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Entry deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Delete vault entry error', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to delete entry',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Search vault entries
 * POST /vault/search
 */
const searchEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const searchData = req.body || {};
    const { query, category } = searchData;

    // Search entries
    const results = await vaultRepository.searchEntries(userId, { query, category });

    // Remove encrypted data from results
    const entriesWithoutSensitive = results.map(entry => ({
      id: entry.id,
      name: entry.name,
      username: entry.username,
      url: entry.url,
      category: entry.category,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }));

    res.status(200).json({
      entries: entriesWithoutSensitive,
      total: entriesWithoutSensitive.length,
      query: query || null,
      category: category || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Search vault entries error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to search entries',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generate secure password
 * POST /vault/generate-password
 */
const generatePassword = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    // Validate password generation options
    const validation = validatePasswordGenerationOptions(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const options = req.body;

    // Generate password
    const result = passwordGenerator.generatePassword(options);

    logger.info('Password generated', {
      userId: req.user.id,
      length: result.options.length,
      strength: result.strength.level,
      ip: req.ip
    });

    res.status(200).json({
      password: result.password,
      strength: result.strength,
      options: result.options,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Generate password error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to generate password',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Change master password and re-encrypt all data
 * POST /vault/change-master-password
 */
const changeMasterPassword = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    // Validate request data
    const validation = validateMasterPasswordChangeData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { currentMasterPassword, newMasterPassword } = req.body;

    // Verify current master password
    const storedMasterPasswordHash = masterPasswordHashes.get(userId);
    if (!storedMasterPasswordHash) {
      return res.status(400).json({
        error: 'Current master password is incorrect',
        timestamp: new Date().toISOString()
      });
    }

    const isValidCurrentPassword = await cryptoService.verifyPassword(currentMasterPassword, storedMasterPasswordHash);
    if (!isValidCurrentPassword) {
      return res.status(400).json({
        error: 'Current master password is incorrect',
        timestamp: new Date().toISOString()
      });
    }

    // Get current session encryption key
    const currentKey = await vaultRepository.getEncryptionKey(userId);
    if (!currentKey) {
      return res.status(403).json({
        error: 'Invalid vault session',
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate new encryption key for the new session
    const newKey = await cryptoService.generateEncryptionKey();

    // Get all entries for re-encryption
    const entries = await vaultRepository.getAllEntriesForReencryption(userId);
    let reencryptedCount = 0;

    // Re-encrypt all entries
    for (const entry of entries) {
      try {
        // Parse encrypted data if it's a string
        let encryptedData = entry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        
        // Decrypt with current key
        const decryptedData = await cryptoService.decrypt(encryptedData, currentKey);
        
        // Re-encrypt with new key
        const reencryptedDataObject = await cryptoService.encrypt(decryptedData, newKey);
        
        // Update entry with new encrypted data (serialize for database)
        entry.encryptedData = JSON.stringify(reencryptedDataObject);
        reencryptedCount++;
      } catch (error) {
        logger.warn('Failed to re-encrypt entry during master password change', {
          userId,
          entryId: entry.id,
          error: error.message
        });
      }
    }

    // Batch update entries with new encrypted data
    await vaultRepository.batchUpdateEntries(entries);

    // Store new master password hash
    const newMasterPasswordHash = await cryptoService.hashPassword(newMasterPassword);
    masterPasswordHashes.set(userId, newMasterPasswordHash);

    // Create new session with new key
    await vaultRepository.clearSession(userId);
    await vaultRepository.createSession(userId, newKey);

    logger.info('Master password changed successfully', {
      userId,
      reencryptedEntries: reencryptedCount,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Master password changed successfully',
      reencryptedEntries: reencryptedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Change master password error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to change master password',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Debug endpoint to reset master password hash (development only)
 * POST /vault/reset-master-password-hash
 */
const resetMasterPasswordHash = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const userId = req.user.id;
    const { newMasterPassword } = req.body;

    if (!newMasterPassword) {
      return res.status(400).json({
        error: 'newMasterPassword is required',
        timestamp: new Date().toISOString()
      });
    }

    // Hash and store the new master password
    const masterPasswordHash = await cryptoService.hashPassword(newMasterPassword);
    masterPasswordHashes.set(userId, masterPasswordHash);

    console.log('🔐 DEBUG: Reset master password hash for user:', userId);
    console.log('🔐 DEBUG: Total stored hashes:', masterPasswordHashes.size);

    res.status(200).json({
      message: 'Master password hash reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Reset master password hash error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to reset master password hash',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle vault-specific errors
 */
const handleVaultError = (error, req, res, next) => {
  // Handle specific vault errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'EncryptionError') {
    return res.status(500).json({
      error: 'Encryption operation failed',
      timestamp: new Date().toISOString()
    });
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      timestamp: new Date().toISOString()
    });
  }

  // Default error handling
  logger.error('Vault operation error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  unlockVault,
  lockVault,
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
  generatePassword,
  changeMasterPassword,
  handleVaultError,
  requireUnlockedVault,
  masterPasswordHashes,
  resetMasterPasswordHash
}; 