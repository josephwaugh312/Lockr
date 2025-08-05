const userRepository = require('../models/userRepository');
const vaultRepository = require('../models/vaultRepository');
const { CryptoService } = require('../services/cryptoService');
const { logger, securityEvents } = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { NOTIFICATION_SUBTYPES } = require('../services/notificationService');
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

// Rate limiting for vault operations
const rateLimitStore = new Map();

// Track failed vault unlock attempts per user (for suspicious login detection)
const failedVaultAttempts = new Map();
// Track which users have already been notified in current failure window
const notifiedUsers = new Map();

// Clean up old failed attempts every 15 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of failedVaultAttempts.entries()) {
    const filteredAttempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000); // 15 minutes
    if (filteredAttempts.length === 0) {
      failedVaultAttempts.delete(key);
      // Also clean up notification tracking for this key
      notifiedUsers.delete(key);
    } else {
      failedVaultAttempts.set(key, filteredAttempts);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// For testing purposes
if (process.env.NODE_ENV === 'test') {
  module.exports.__cleanupInterval = cleanupInterval;
}


/**
 * Middleware to check if vault is unlocked
 */
const requireUnlockedVault = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const session = await vaultRepository.getSession(userId);
    
    if (!session) {
      return res.status(403).json({
        error: "Vault must be unlocked to perform this operation",
        timestamp: new Date().toISOString()
      });
    }
    
    // Add session data to request for use in handlers
    req.vaultSession = session;
    next();
  } catch (error) {
    logger.error("Error checking vault session", {
      error: error.message,
      userId: req.user?.id
    });
    
    res.status(500).json({
      error: "Failed to verify vault session",
      timestamp: new Date().toISOString()
    });
  }
};
const checkRateLimit = (userId, operation = 'unlock', maxAttempts = 5, windowMs = 60000) => {
  const key = `${userId}_${operation}`;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const attempts = rateLimitStore.get(key);
  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
  rateLimitStore.set(key, recentAttempts);
  
  if (recentAttempts.length >= maxAttempts) {
    return {
      allowed: false,
      resetTime: recentAttempts[0] + windowMs
    };
  }
  
  // Add current attempt
  recentAttempts.push(now);
  rateLimitStore.set(key, recentAttempts);
  
  return {
    allowed: true,
    remaining: maxAttempts - recentAttempts.length
  };
};

/**
 * ZERO-KNOWLEDGE VAULT UNLOCK
 * Client derives encryption key from master password + salt
 * Server validates key by attempting to decrypt existing data
 * POST /vault/unlock
 */
const unlockVault = async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.info('Vault unlock attempt started', {
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    const { encryptionKey } = req.body;

    if (!encryptionKey) {
      logger.warn('Vault unlock failed - no encryption key provided', {
        userId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Encryption key is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      logger.warn('Vault unlock failed - invalid encryption key format', {
        userId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn('Vault unlock failed - user not found', {
        userId,
        ip: req.ip
      });
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data
    let isValidKey = true;
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    
    // CRITICAL: Check if master password was recently reset
    // TEMPORARILY DISABLED - waiting for migration to be applied
    /*
    if (user.masterPasswordResetAt) {
      const resetTime = new Date(user.masterPasswordResetAt);
      const now = new Date();
      const hoursSinceReset = (now - resetTime) / (1000 * 60 * 60);
      
      // If master password was reset within the last 24 hours, require re-authentication
      if (hoursSinceReset < 24) {
        logger.warn('Master password recently reset - requiring re-authentication', {
          userId,
          ip: req.ip,
          hoursSinceReset: Math.round(hoursSinceReset * 100) / 100
        });
        
        return res.status(401).json({
          error: 'Master password was recently reset. Please sign in again.',
          requiresReauth: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    */
    
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      // User has existing data - validate key by decryption test
      try {
        const testEntry = entriesResult.entries[0];
        let encryptedData = testEntry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        
        await cryptoService.decrypt(encryptedData, Buffer.from(encryptionKey, 'base64'));
        
        logger.info('Vault unlock successful - valid encryption key', {
          userId,
          ip: req.ip
        });
      } catch (decryptError) {
        isValidKey = false;
        logger.warn('Vault unlock failed - invalid encryption key', {
          userId,
          ip: req.ip,
          error: decryptError.message
        });
      }
    } else {
      logger.info('Vault unlock - new user, accepting key', {
        userId,
        ip: req.ip
      });
    }
    
    // PROCESS FAILED ATTEMPTS AND SEND NOTIFICATIONS BEFORE RATE LIMITING
    if (!isValidKey) {
      logger.warn('Vault unlock failed - invalid encryption key', {
        userId,
        ip: req.ip
      });
      
      securityEvents.failedVaultUnlock(userId, req.ip);
      
      try {
        // Track failed attempts for suspicious login detection
        const attemptKey = `${userId}_${req.ip}`;
        const now = Date.now();
        
        // Initialize tracking if not exists
        if (!failedVaultAttempts.has(attemptKey)) {
          failedVaultAttempts.set(attemptKey, []);
        }
        
        const attempts = failedVaultAttempts.get(attemptKey);
        attempts.push(now);
        
        // Check threshold BEFORE cleanup (so we don't lose attempts)
        const shouldSendNotification = attempts.length >= 3;
        
        // Clean up attempts older than 15 minutes
        const recentAttempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000);
        failedVaultAttempts.set(attemptKey, recentAttempts);
        
        logger.info('Vault unlock attempt tracked', {
          userId,
          ip: req.ip,
          attemptCount: recentAttempts.length,
          threshold: 3,
          shouldSendNotification
        });
        
        // Send suspicious login notification only when threshold is first reached
        if (shouldSendNotification) {
          // Clean up old notification tracking (older than 15 minutes)
          for (const [key, timestamp] of notifiedUsers.entries()) {
            if (now - timestamp > 15 * 60 * 1000) {
              notifiedUsers.delete(key);
            }
          }
          
          // Check if we've already notified for this failure window
          const lastNotified = notifiedUsers.get(attemptKey);
          const shouldNotify = !lastNotified || (now - lastNotified > 15 * 60 * 1000); // 15 minutes for production
          
          logger.info('Suspicious login notification check', {
            userId,
            ip: req.ip,
            attemptCount: recentAttempts.length,
            shouldNotify,
            lastNotified: lastNotified ? new Date(lastNotified).toISOString() : 'none'
          });
          
          if (shouldNotify) {
            try {
              // Check if notification service is initialized
              if (!notificationService || !notificationService.initialized) {
                await notificationService.initialize();
              }
              
              const notificationResult = await notificationService.sendSecurityAlert(userId, NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN, {
                templateData: {
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  timestamp: new Date().toISOString(),
                  reason: 'Multiple failed vault unlock attempts',
                  attemptCount: recentAttempts.length
                }
              });
              
              logger.info('Suspicious login notification sent', {
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length,
                result: notificationResult
              });
              
              // Mark this user as notified
              notifiedUsers.set(attemptKey, now);
              
            } catch (notificationError) {
              logger.error('Failed to send suspicious login notification:', {
                error: notificationError.message,
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length
              });
            }
          } else {
            logger.info('Suspicious login notification skipped - already notified in current window', {
              userId,
              ip: req.ip,
              attemptCount: recentAttempts.length
            });
          }
        } else {
          logger.info('Failed vault unlock attempt tracked', {
            userId,
            ip: req.ip,
            attemptCount: recentAttempts.length,
            threshold: 3
          });
        }
      } catch (notificationError) {
        logger.error('Failed to process suspicious login notification:', notificationError);
      }
    } else {
      logger.info('Vault unlock successful - valid encryption key', {
        userId,
        ip: req.ip
      });
    }
    
    // Rate limiting check AFTER we've processed the attempt for notifications
    const rateLimit = checkRateLimit(userId, 'unlock', 5, 60000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for vault unlock', {
        userId,
        ip: req.ip,
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      });
      return res.status(429).json({
        error: 'Too many unlock attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    // If the key was invalid, return error (but notifications were already sent above)
    if (!isValidKey) {
      return res.status(401).json({
        error: 'Invalid master password',
        timestamp: new Date().toISOString()
      });
    }

    // Send vault unlock notification
    try {
      await notificationService.sendSecurityAlert(userId, NOTIFICATION_SUBTYPES.VAULT_ACCESSED, {
        templateData: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        }
      });
    } catch (notificationError) {
      logger.error('Failed to send vault unlock notification:', notificationError);
    }

    res.status(200).json({
      message: 'Vault unlocked successfully',
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
 * Lock vault (clear session)
 * POST /vault/lock
 */
const lockVault = async (req, res) => {
  try {
    const userId = req.user.id;

    // No session clearing needed since system is now stateless
    // Lock is handled client-side by removing encryption key from memory

    logger.info('Vault locked', {
      userId,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Vault locked successfully',
      timestamp: new Date().toISOString()
    });

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
 * ZERO-KNOWLEDGE MASTER PASSWORD CHANGE
 * Client provides old and new encryption keys
 * Server re-encrypts all data with new key
 * POST /vault/change-master-password
 */
const changeMasterPassword = async (req, res) => {
  try {
    const userId = req.user.id;

    const { currentEncryptionKey, newEncryptionKey } = req.body;

    if (!currentEncryptionKey) {
      return res.status(400).json({
        error: 'Current encryption key is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!newEncryptionKey) {
      return res.status(400).json({
        error: 'New encryption key is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key formats (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(currentEncryptionKey) || !/^[A-Za-z0-9+/=]+$/.test(newEncryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate current encryption key by attempting to decrypt existing data
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let encryptedData = testEntry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        await cryptoService.decrypt(encryptedData, Buffer.from(currentEncryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Current encryption key does not match existing data',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Get all vault entries for re-encryption
    const allEntriesResult = await vaultRepository.getEntries(userId);
    const entries = allEntriesResult.entries || [];
    let reencryptedCount = 0;

    // Re-encrypt all entries with new key
    for (const entry of entries) {
      try {
        // Parse encrypted data if it's a string
        let encryptedData = entry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        
        // Decrypt with current key
        const decryptedDataString = await cryptoService.decrypt(encryptedData, Buffer.from(currentEncryptionKey, 'base64'));
        
        // Re-encrypt with new key
        const reencryptedDataObject = await cryptoService.encrypt(decryptedDataString, Buffer.from(newEncryptionKey, 'base64'));
        
        // Update entry with new encrypted data
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
    if (entries.length > 0) {
      await vaultRepository.batchUpdateEntries(entries);
    }

    logger.info('Master password changed successfully (zero-knowledge)', {
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

// Other vault functions remain the same (createEntry, getEntries, etc.)
// These don't need changes as they already use encryption keys from session

/**
 * Create new vault entry
 * POST /vault/entries
 */
const createEntry = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get encryption key from request body (stateless approach)
    const { encryptionKey, ...entryData } = req.body;
    
    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data (if any exists)
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let testEncryptedData = testEntry.encryptedData;
        if (typeof testEncryptedData === 'string') {
          testEncryptedData = JSON.parse(testEncryptedData);
        }
        await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Invalid encryption key',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate entry data
    const validation = validateVaultEntryData(entryData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { title, username, email, password, website, notes, category, favorite } = entryData;

    // Prepare data for encryption
    const dataToEncrypt = {
      title: title.trim(),
      username: username?.trim() || '',
      email: email?.trim() || '',
      password: password?.trim() || '',
      website: website?.trim() || '',
      notes: notes?.trim() || '',
      category: category || 'other'
    };

    // Encrypt the entry data
    let encryptedData;
    try {
      encryptedData = await cryptoService.encrypt(JSON.stringify(dataToEncrypt), Buffer.from(encryptionKey, 'base64'));
    } catch (encryptionError) {
      return res.status(500).json({
        error: "Encryption failed: " + encryptionError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Create entry in vault
    const entry = await vaultRepository.createEntry(userId, {
      name: dataToEncrypt.title,
      username: dataToEncrypt.username || null,
      url: dataToEncrypt.website || null,
      encryptedData: JSON.stringify(encryptedData),
      category: category || 'other',
      favorite: favorite || false
    });

    logger.info('Vault entry created', {
      userId,
      entryId: entry.id,
      category: entry.category,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Entry created successfully',
      entry: {
        id: entry.id,
        title: dataToEncrypt.title,
        name: dataToEncrypt.title, // Use title as name for compatibility
        username: dataToEncrypt.username,
        email: dataToEncrypt.email,
        password: dataToEncrypt.password,
        website: dataToEncrypt.website,
        notes: dataToEncrypt.notes,
        category: entry.category,
        favorite: entry.favorite || false,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Create entry error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to create entry: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get all vault entries for user
 * GET /vault/entries
 */
const getEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get encryption key from request body (POST request)
    const { encryptionKey } = req.body;
    
    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Get pagination and filtering parameters from request body
    const page = parseInt(req.body.page) || 1;
    const limit = Math.min(parseInt(req.body.limit) || 50, 100); // Max 100 entries per page
    const category = req.body.category;
    const search = req.body.search;

    // Use searchEntries if search parameter is provided
    let result;
    if (search) {
      const searchResults = await vaultRepository.searchEntries(userId, {
        query: search,
        category
      });
      result = {
        entries: searchResults,
        pagination: {
          page: 1,
          limit: searchResults.length,
          total: searchResults.length,
          totalPages: 1
        }
      };
    } else {
      // Use regular getEntries for non-search requests
      result = await vaultRepository.getEntries(userId, {
        page,
        limit,
        category
      });
    }

    // Decrypt entries using provided encryption key
    const decryptedEntries = [];
    for (const entry of result.entries) {
      try {
        let encryptedData = entry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }

        const decryptedDataStr = await cryptoService.decrypt(encryptedData, Buffer.from(encryptionKey, 'base64'));
        const decryptedData = JSON.parse(decryptedDataStr);
        
        // SECURITY: Never log decrypted data in production
        // console.log("DEBUG: Decrypted data for entry", entry.id, ":", decryptedData);

        decryptedEntries.push({
          id: entry.id,
          userId: entry.userId, // Include userId for security validation
          name: decryptedData.title, // Use decrypted title as name
          username: decryptedData.username || '',
          email: decryptedData.email || '', // Include decrypted email
          password: decryptedData.password || '',
          website: decryptedData.website || '',
          url: decryptedData.website || '', // Also provide url field for compatibility
          notes: decryptedData.notes || '',
          category: entry.category,
          favorite: entry.favorite || false, // Include favorite status from database
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        });
        
        // SECURITY: Never log final entry data (contains passwords)
        // console.log("DEBUG: Final entry data:", decryptedEntries[decryptedEntries.length - 1]);
      } catch (decryptError) {
        // If decryption fails with provided key, the key is invalid
        return res.status(403).json({
          error: 'Invalid encryption key - cannot decrypt vault data',
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info('Vault entries retrieved', {
      userId,
      count: decryptedEntries.length,
      page,
      limit,
      search: search || null,
      ip: req.ip
    });

    res.status(200).json({
      entries: decryptedEntries,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get entries error', {
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
 * Get single vault entry by ID
 * GET /vault/entries/:id
 */
const getEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entryId = req.params.id;
    
    // Get encryption key from query parameters (GET requests don't have bodies)
    const { encryptionKey } = req.query;
    
    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Get entry from vault
    const entry = await vaultRepository.getEntry(entryId, userId);
    if (!entry) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Decrypt entry data
    let encryptedData = entry.encryptedData;
    if (typeof encryptedData === 'string') {
      encryptedData = JSON.parse(encryptedData);
    }
    
    const decryptedDataString = await cryptoService.decrypt(encryptedData, Buffer.from(encryptionKey, 'base64'));
    const decryptedData = JSON.parse(decryptedDataString);

    const decryptedEntry = {
      id: entry.id,
      name: decryptedData.title, // Use title as name for compatibility
      title: decryptedData.title,
      username: decryptedData.username || '',
      email: decryptedData.email || '',
      password: decryptedData.password || '',
      website: decryptedData.website || '',
      url: decryptedData.website || '',
      notes: decryptedData.notes || '',
      category: entry.category,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };

    logger.info('Vault entry retrieved', {
      userId,
      entryId: entry.id,
      ip: req.ip
    });

    res.status(200).json({
      entry: decryptedEntry,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get entry error', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params.id,
      ip: req.ip
    });

    if (error.message.includes('decrypt')) {
      res.status(500).json({
        error: 'Failed to decrypt entry - invalid encryption key',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Failed to retrieve entry',
        timestamp: new Date().toISOString()
      });
    }
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

    // SECURITY: Never log request body (contains encryption key and sensitive data)
    // console.log("DEBUG: UpdateEntry called for entry:", entryId);
    // console.log("DEBUG: Request body:", JSON.stringify(req.body, null, 2));

    // Get encryption key from request body (stateless approach)
    const { encryptionKey, ...entryData } = req.body;
    
    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Check if entry exists and belongs to user
    const existingEntry = await vaultRepository.getEntry(entryId, userId);
    if (!existingEntry) {
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt the existing entry and get current data
    let existingDecryptedData;
    try {
      let testEncryptedData = existingEntry.encryptedData;
      if (typeof testEncryptedData === 'string') {
        testEncryptedData = JSON.parse(testEncryptedData);
      }
      const decryptedDataStr = await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      existingDecryptedData = JSON.parse(decryptedDataStr);
    } catch (decryptError) {
      return res.status(403).json({
        error: 'Invalid encryption key',
        timestamp: new Date().toISOString()
      });
    }

    // Merge existing data with new data for partial updates
    const mergedData = {
      title: entryData.title ?? existingDecryptedData.title,
      username: entryData.username ?? existingDecryptedData.username,
      email: entryData.email ?? existingDecryptedData.email,
      password: entryData.password ?? existingDecryptedData.password,
      website: entryData.website ?? existingDecryptedData.website,
      notes: entryData.notes ?? existingDecryptedData.notes,
      category: entryData.category ?? existingEntry.category,
      favorite: entryData.favorite ?? existingEntry.favorite
    };

    // Validate merged entry data
    const validation = validateVaultEntryData(mergedData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    // Use merged data for encryption
    const dataToEncrypt = {
      title: mergedData.title.trim(),
      username: mergedData.username?.trim() || '',
      email: mergedData.email?.trim() || '',
      password: mergedData.password?.trim() || '',
      website: mergedData.website?.trim() || '',
      notes: mergedData.notes?.trim() || ''
    };

    // Encrypt the entry data
    let encryptedData;
    try {
      encryptedData = await cryptoService.encrypt(JSON.stringify(dataToEncrypt), Buffer.from(encryptionKey, 'base64'));
    } catch (encryptionError) {
      return res.status(500).json({
        error: "Encryption failed: " + encryptionError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Update entry in vault
    const updatedEntry = await vaultRepository.updateEntry(entryId, userId, {
      name: dataToEncrypt.title,
      username: dataToEncrypt.username || null, // Use null instead of empty string
      url: dataToEncrypt.website || null, // Use null instead of empty string
      encryptedData: JSON.stringify(encryptedData),
      category: mergedData.category || 'other',
      favorite: mergedData.favorite !== undefined ? mergedData.favorite : undefined
    });

    logger.info('Vault entry updated', {
      userId,
      entryId: updatedEntry.id,
      category: updatedEntry.category,
      ip: req.ip
    });

    const response = {
      message: 'Entry updated successfully',
      entry: {
        id: updatedEntry.id,
        name: dataToEncrypt.title, // Use title as name for compatibility
        title: dataToEncrypt.title,
        username: dataToEncrypt.username,
        email: dataToEncrypt.email,
        password: dataToEncrypt.password,
        website: dataToEncrypt.website,
        notes: dataToEncrypt.notes,
        category: updatedEntry.category,
        favorite: updatedEntry.favorite,
        updatedAt: updatedEntry.updatedAt
      },
      timestamp: new Date().toISOString()
    };

    // SECURITY: Never log response data (could contain sensitive information)
    // console.log("DEBUG: Sending update response:", JSON.stringify(response, null, 2));

    res.status(200).json(response);

  } catch (error) {
    console.log("ERROR: updateEntry failed:", error.message);
    logger.error('Update entry error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      entryId: req.params?.id,
      ip: req.ip,
      requestBody: {
        hasEncryptionKey: !!req.body.encryptionKey,
        encryptionKeyLength: req.body.encryptionKey?.length,
        hasTitle: !!req.body.title,
        hasCategory: !!req.body.category,
        fieldsProvided: Object.keys(req.body).filter(key => key !== 'encryptionKey')
      }
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
    
    // Get encryption key from request body for validation
    const { encryptionKey } = req.body;
    
    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data (if any exists)
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let testEncryptedData = testEntry.encryptedData;
        if (typeof testEncryptedData === 'string') {
          testEncryptedData = JSON.parse(testEncryptedData);
        }
        await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Invalid encryption key',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Delete entry from vault
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
    logger.error('Delete entry error', {
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
 * GET /vault/search
 */
const searchEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: query, category, encryptionKey } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long',
        timestamp: new Date().toISOString()
      });
    }

    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Create a modified request object for getEntries
    const modifiedReq = {
      ...req,
      body: { 
        ...req.body, 
        search: query,
        encryptionKey 
      }
    };

    // Use the getEntries function with search parameter
    return await getEntries(modifiedReq, res);

  } catch (error) {
    logger.error('Search entries error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query.q,
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
    // Validate options
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
      userId: req.user?.id,
      length: options.length || 16,
      includeSymbols: options.includeSymbols || false,
      ip: req.ip
    });

    res.status(200).json({
      password: result.password,
      options: {
        length: options.length || 16,
        includeUppercase: options.includeUppercase !== false,
        includeLowercase: options.includeLowercase !== false,
        includeNumbers: options.includeNumbers !== false,
        includeSymbols: options.includeSymbols || false
      },
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
 * DEPRECATED: Reset master password hash (zero-knowledge architecture)
 */
const resetMasterPasswordHash = async (req, res) => {
  return res.status(410).json({
    error: 'This endpoint is deprecated. Master passwords are not stored on server (zero-knowledge architecture).',
    message: 'Use vault reset instead - this will permanently delete all data.',
    timestamp: new Date().toISOString()
  });
};

/**
 * Error handling middleware
 */
const handleVaultError = (error, req, res, next) => {
  logger.error('Vault operation error', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    operation: req.method + ' ' + req.path,
    ip: req.ip
  });

  // Check for specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return res.status(400).json({
      error: 'Invalid JSON format',
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('decrypt')) {
    return res.status(403).json({
      error: 'Invalid encryption key - vault may need to be unlocked again',
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
};

/**
 * Check for expiring passwords
 * GET /vault/expiring-passwords
 */
const checkExpiringPasswords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { encryptionKey } = req.query;

    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data (if any exists)
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let testEncryptedData = testEntry.encryptedData;
        if (typeof testEncryptedData === 'string') {
          testEncryptedData = JSON.parse(testEncryptedData);
        }
        await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Invalid encryption key',
          timestamp: new Date().toISOString()
        });
      }
    }

    // For now, return empty array - this would integrate with password expiry service
    const expiringPasswords = [];

    res.status(200).json({
      expiringPasswords,
      count: expiringPasswords.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Check expiring passwords error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to check expiring passwords',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Clear notification tracking (for testing purposes)
 * POST /vault/clear-notification-tracking
 */
const clearNotificationTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const ip = req.ip;
    const attemptKey = `${userId}_${ip}`;
    
    // Clear notification tracking for this user/IP combination
    notifiedUsers.delete(attemptKey);
    failedVaultAttempts.delete(attemptKey);
    
    // Also clear notification service cache
    const notificationService = require('../services/notificationService');
    const clearedKeys = notificationService.clearNotificationCache(userId, 'suspicious_login');
    
    console.log('🧹 Cleared notification tracking for:', attemptKey);
    console.log('🧹 Cleared notification service cache keys:', clearedKeys);
    logger.info('Notification tracking cleared', {
      userId,
      ip,
      attemptKey,
      clearedCacheKeys: clearedKeys
    });

    res.status(200).json({
      message: 'Notification tracking cleared',
      attemptKey,
      clearedCacheKeys: clearedKeys,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Clear notification tracking error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to clear notification tracking',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Export vault data (encrypted)
 * POST /vault/export
 */
const exportVault = async (req, res) => {
  try {
    const userId = req.user.id;
    const { encryptionKey } = req.body;

    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data (if any exists)
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let testEncryptedData = testEntry.encryptedData;
        if (typeof testEncryptedData === 'string') {
          testEncryptedData = JSON.parse(testEncryptedData);
        }
        await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Invalid encryption key',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Get all vault entries for the user
    const result = await vaultRepository.getEntries(userId);
    const entries = result.entries || [];
    
    // Filter out system entries from export (they shouldn't be exported)
    const exportableEntries = entries.filter(entry => entry.category !== 'system');
    
    // Create export data (excluding sensitive fields for security)
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      source: 'Lockr Password Manager',
      itemCount: exportableEntries.length,
      items: exportableEntries.map(entry => ({
        id: entry.id,
        name: entry.name || 'Untitled',
        username: entry.username || '',
        email: entry.email || '',
        website: entry.url || '',
        category: entry.category,
        favorite: entry.favorite || false,
        notes: entry.notes || '',
        created: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
        lastUsed: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : new Date().toISOString(),
        // Card fields (excluding sensitive data)
        cardholderName: entry.cardholderName || '',
        // WiFi fields (excluding passwords)
        networkName: entry.networkName || '',
        security: entry.security || 'WPA2'
        // Note: Passwords, card numbers, CVV, and expiry dates are intentionally excluded for security
      }))
    };

    logger.info('Vault export completed', {
      userId,
      totalEntries: entries.length,
      exportableEntries: exportableEntries.length,
      filteredOut: entries.length - exportableEntries.length,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Vault export completed successfully',
      data: exportData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Vault export error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to export vault',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Import vault data
 * POST /vault/import
 */
const importVault = async (req, res) => {
  try {
    const userId = req.user.id;
    const { encryptionKey, data } = req.body;

    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    if (!data || !data.items || !Array.isArray(data.items)) {
      return res.status(400).json({
        error: 'Invalid import data format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data (if any exists)
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      try {
        const testEntry = entriesResult.entries[0];
        let testEncryptedData = testEntry.encryptedData;
        if (typeof testEncryptedData === 'string') {
          testEncryptedData = JSON.parse(testEncryptedData);
        }
        await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      } catch (decryptError) {
        return res.status(403).json({
          error: 'Invalid encryption key',
          timestamp: new Date().toISOString()
        });
      }
    }

    const validItems = [];
    const errors = [];
    const duplicates = [];

    // Get existing items for duplicate checking
    const existingResult = await vaultRepository.getEntries(userId);
    const existingItems = existingResult.entries || [];

    // Process each import item
    for (const item of data.items) {
      try {
        // Validate required fields
        if (!item.title || !item.category) {
          errors.push(`Item "${item.title || 'Unknown'}": Missing required fields (title, category)`);
          continue;
        }

        // Validate category
        if (!['login', 'card', 'note', 'wifi'].includes(item.category)) {
          errors.push(`Item "${item.title}": Invalid category "${item.category}"`);
          continue;
        }

        // Check for duplicates (by title and category)
        const isDuplicate = existingItems.some(existing => 
          existing.name === item.title && existing.category === item.category
        );

        if (isDuplicate) {
          duplicates.push(`Item "${item.title}" (${item.category})`);
          continue;
        }

        // Prepare data for encryption
        const dataToEncrypt = {
          title: item.title.trim(),
          username: item.username?.trim() || '',
          email: item.email?.trim() || '',
          password: '', // Always empty for security - users need to add passwords manually
          website: item.website?.trim() || '',
          notes: item.notes?.trim() || '',
          category: item.category
        };

        // Encrypt the entry data
        let encryptedData;
        try {
          encryptedData = await cryptoService.encrypt(JSON.stringify(dataToEncrypt), Buffer.from(encryptionKey, 'base64'));
        } catch (encryptionError) {
          errors.push(`Item "${item.title}": Encryption failed - ${encryptionError.message}`);
          continue;
        }

        // Create new vault entry
        const newEntry = await vaultRepository.createEntry(userId, {
          name: dataToEncrypt.title,
          username: dataToEncrypt.username || null,
          url: dataToEncrypt.website || null,
          encryptedData: JSON.stringify(encryptedData),
          category: item.category,
          favorite: Boolean(item.favorite)
        });

        validItems.push(newEntry);

      } catch (itemError) {
        errors.push(`Item "${item.title || 'Unknown'}": ${itemError.message}`);
      }
    }

    // If there are validation errors, return 400
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid import data format',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Vault import completed', {
      userId,
      totalItems: data.items.length,
      validItems: validItems.length,
      errors: errors.length,
      duplicates: duplicates.length,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Vault import completed',
      summary: {
        totalItems: data.items.length,
        imported: validItems.length,
        errors: errors.length,
        duplicates: duplicates.length
      },
      errors: errors.length > 0 ? errors : undefined,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      note: 'For security, passwords and card details need to be added manually.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Vault import error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to import vault',
      timestamp: new Date().toISOString()
    });
  }
};

// Update module.exports to include all functions
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
  resetMasterPasswordHash,
  handleVaultError,
  requireUnlockedVault,
  checkExpiringPasswords,
  clearNotificationTracking,
  exportVault,
  importVault
};
