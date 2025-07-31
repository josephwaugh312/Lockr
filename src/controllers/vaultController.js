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
setInterval(() => {
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
  console.log('🔥🔥🔥 VAULT UNLOCK ENDPOINT HIT 🔥🔥🔥');
  console.log('Request body:', JSON.stringify({ hasEncryptionKey: !!req.body.encryptionKey }, null, 2));
  console.log('User ID:', req.user?.id);
  console.log('IP:', req.ip);
  
  try {
    console.log('🔄 Entering try block');
    const userId = req.user.id;
    console.log('✅ Got userId:', userId);
    
    logger.info('🔓 VAULT UNLOCK ATTEMPT STARTED', {
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log('✅ Logger.info completed');
    
    const { encryptionKey } = req.body;
    console.log('✅ Got encryptionKey:', !!encryptionKey);

    if (!encryptionKey) {
      console.log('❌ No encryption key provided');
      logger.info('❌ VAULT UNLOCK FAILED - No encryption key provided', {
        userId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Encryption key is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Encryption key validation started');
    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      console.log('❌ Invalid encryption key format');
      logger.info('❌ VAULT UNLOCK FAILED - Invalid encryption key format', {
        userId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Encryption key format valid, getting user');
    // Get user data
    const user = await userRepository.findById(userId);
    console.log('✅ User found:', !!user);
    if (!user) {
      console.log('❌ User not found');
      logger.info('❌ VAULT UNLOCK FAILED - User not found', {
        userId,
        ip: req.ip
      });
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Getting vault entries for validation');
    // Validate encryption key by attempting to decrypt existing data
    let isValidKey = true;
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    console.log('✅ Vault entries retrieved:', entriesResult?.entries?.length || 0);
    
    // CRITICAL: Check if master password was recently reset
    // TEMPORARILY DISABLED - waiting for migration to be applied
    /*
    if (user.masterPasswordResetAt) {
      const resetTime = new Date(user.masterPasswordResetAt);
      const now = new Date();
      const hoursSinceReset = (now - resetTime) / (1000 * 60 * 60);
      
      // If master password was reset within the last 24 hours, require re-authentication
      if (hoursSinceReset < 24) {
        console.log('🔒 Master password was recently reset - requiring re-authentication');
        logger.info('🔒 MASTER PASSWORD RECENTLY RESET - REQUIRING RE-AUTHENTICATION', {
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
    
    console.log('🔍 About to call logger.info for encryption key validity');
    logger.info('🔍 CHECKING ENCRYPTION KEY VALIDITY', {
      userId,
      ip: req.ip,
      hasEntries: !!(entriesResult.entries && entriesResult.entries.length > 0)
    });
    console.log('✅ Logger.info for encryption key validity completed');
    
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      console.log('🔍 User has existing data - validating key by decryption test');
      // User has existing data - validate key by decryption test
      try {
        console.log('🔍 Getting test entry for decryption');
        const testEntry = entriesResult.entries[0];
        console.log('✅ Got test entry:', !!testEntry);
        
        console.log('🔍 Parsing encrypted data');
        let encryptedData = testEntry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        console.log('✅ Encrypted data parsed:', !!encryptedData);
        
        console.log('🔍 About to decrypt with provided key');
        await cryptoService.decrypt(encryptedData, Buffer.from(encryptionKey, 'base64'));
        console.log('✅ Decryption successful - key is valid');
        
        logger.info('✅ ENCRYPTION KEY VALIDATION PASSED', {
          userId,
          ip: req.ip
        });
      } catch (decryptError) {
        console.log('❌ Decryption failed - key is invalid:', decryptError.message);
        isValidKey = false;
        logger.info('❌ ENCRYPTION KEY VALIDATION FAILED', {
          userId,
          ip: req.ip,
          error: decryptError.message
        });
      }
    } else {
      console.log('ℹ️ No existing entries - accepting key (new user)');
      logger.info('ℹ️ NO EXISTING ENTRIES - ACCEPTING KEY (NEW USER)', {
        userId,
        ip: req.ip
      });
    }
    console.log('✅ Encryption key validation completed, isValidKey:', isValidKey);
    
    console.log('🔍 About to check if key is invalid and process notifications');
    // PROCESS FAILED ATTEMPTS AND SEND NOTIFICATIONS BEFORE RATE LIMITING
    if (!isValidKey) {
      console.log('❌ Key is invalid - starting notification logic');
      logger.warn('Vault unlock failed - invalid encryption key', {
        userId,
        ip: req.ip
      });
      
      console.log('🔍 Calling securityEvents.failedVaultUnlock');
      securityEvents.failedVaultUnlock(userId, req.ip);
      console.log('✅ securityEvents.failedVaultUnlock completed');
      
      console.log('🔍 Starting suspicious login notification logic');
      logger.info('Starting suspicious login notification logic', {
        userId,
        ip: req.ip
      });
      
      try {
        console.log('🔍 Entering notification try block');
        // Track failed attempts for suspicious login detection (only send alert after 2+ attempts)
        const attemptKey = `${userId}_${req.ip}`;
        const now = Date.now();
        
        console.log('🔍 Setting up attempt tracking with key:', attemptKey);
        logger.info('Setting up attempt tracking', {
          userId,
          ip: req.ip,
          attemptKey
        });
        
        // Initialize tracking if not exists
        if (!failedVaultAttempts.has(attemptKey)) {
          console.log('🔍 Initializing new attempt tracking');
          failedVaultAttempts.set(attemptKey, []);
        }
        
        console.log('🔍 Getting current attempts');
        const attempts = failedVaultAttempts.get(attemptKey);
        console.log('🔍 Current attempts count:', attempts.length);
        attempts.push(now);
        console.log('🔍 Added current attempt, new count:', attempts.length);
        
        // Check threshold BEFORE cleanup (so we don't lose attempts)
        console.log('🔍 Checking if threshold met (>= 1):', attempts.length >= 1);
        const shouldSendNotification = attempts.length >= 1;
        
        // Clean up attempts older than 15 minutes
        console.log('🔍 Cleaning up old attempts');
        console.log('🔍 All attempts before cleanup:', attempts.map(t => new Date(t).toISOString()));
        const recentAttempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000);
        console.log('🔍 Recent attempts after cleanup:', recentAttempts.map(t => new Date(t).toISOString()));
        console.log('🔍 Removed attempts:', attempts.length - recentAttempts.length);
        failedVaultAttempts.set(attemptKey, recentAttempts);
        console.log('🔍 Recent attempts after cleanup:', recentAttempts.length);
        
        console.log('🔍 Attempt tracking updated');
        logger.info('Attempt tracking updated', {
          userId,
          ip: req.ip,
          attemptCount: recentAttempts.length,
          threshold: 1,
          shouldSendNotification
        });
        
        // Send suspicious login notification only when threshold is first reached
        if (shouldSendNotification) {
          console.log('🔍 Threshold met - checking notification logic');
          // Check if we've already notified for this failure window
          const lastNotified = notifiedUsers.get(attemptKey);
          const shouldNotify = !lastNotified || (now - lastNotified > 15 * 60 * 1000);
          
          console.log('🔍 Should notify:', shouldNotify, 'Last notified:', lastNotified);
          logger.info('Suspicious login notification check', {
            userId,
            ip: req.ip,
            attemptCount: recentAttempts.length,
            shouldNotify,
            lastNotified: lastNotified ? new Date(lastNotified).toISOString() : 'none'
          });
          
          if (shouldNotify) {
            console.log('🔍 About to send suspicious login notification');
            try {
              console.log('🔍 Attempting to send suspicious login notification');
              logger.info('Attempting to send suspicious login notification', {
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length
              });
              
              console.log('🔍 About to call notificationService.sendSecurityAlert');
              console.log('🔍 Notification service object:', !!notificationService);
              console.log('🔍 NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN:', NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN);
              
              // Check if notification service is initialized
              if (!notificationService || !notificationService.initialized) {
                console.log('❌ Notification service not initialized, attempting to initialize...');
                try {
                  await notificationService.initialize();
                  console.log('✅ Notification service initialized successfully');
                } catch (initError) {
                  console.log('❌ Failed to initialize notification service:', initError.message);
                  throw initError;
                }
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
              
              console.log('🔍 Notification result received:', !!notificationResult);
              console.log('🔍 Full notification result:', JSON.stringify(notificationResult, null, 2));
              logger.info('Suspicious login notification result', {
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length,
                result: notificationResult
              });
              
              // Check if email was sent
              if (notificationResult && notificationResult.email) {
                console.log('✅ Email notification was sent for suspicious login');
              } else {
                console.log('❌ Email notification was NOT sent for suspicious login');
              }
              
              // Mark this user as notified
              console.log('🔍 Marking user as notified');
              notifiedUsers.set(attemptKey, now);
              
              console.log('✅ Suspicious login notification sent successfully');
              logger.info('Suspicious login alert sent after multiple failed vault unlock attempts', {
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length
              });
            } catch (notificationError) {
              console.log('❌ Notification service error:', notificationError.message);
              console.log('❌ Full error stack:', notificationError.stack);
              logger.error('Failed to send suspicious login notification:', {
                error: notificationError.message,
                stack: notificationError.stack,
                userId,
                ip: req.ip,
                attemptCount: recentAttempts.length
              });
            }
          } else {
            console.log('🔍 Notification skipped - already notified in window');
            logger.info('Suspicious login notification skipped - already notified in current window', {
              userId,
              ip: req.ip,
              attemptCount: recentAttempts.length,
              lastNotified: new Date(lastNotified).toISOString()
            });
          }
        } else {
          console.log('🔍 Threshold not met yet');
          logger.info('Failed vault unlock attempt tracked', {
            userId,
            ip: req.ip,
            attemptCount: recentAttempts.length,
            threshold: 1
          });
        }
      } catch (notificationError) {
        console.log('❌ Outer notification error:', notificationError.message);
        console.log('❌ Outer notification error stack:', notificationError.stack);
        logger.error('Failed to send suspicious login notification:', notificationError);
      }
    } else {
      console.log('✅ Key is valid - vault unlock successful');
      logger.info('Vault unlock successful - valid encryption key', {
        userId,
        ip: req.ip
      });
    }
    
    console.log('🔍 About to check rate limit');
    // Rate limiting check AFTER we've processed the attempt for notifications
    const rateLimit = checkRateLimit(userId, 'unlock', 10, 60000);
    if (!rateLimit.allowed) {
      console.log('🚫 Rate limit exceeded - returning 429');
      logger.info('🚫 RATE LIMIT EXCEEDED - But notifications were already processed', {
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
      console.log('❌ Returning 401 - Invalid master password');
      return res.status(401).json({
        error: 'Invalid master password',
        timestamp: new Date().toISOString()
      });
    }

    // No session creation needed - system is now stateless!
    // Each vault operation will include the encryption key

    logger.info('Vault unlocked successfully (zero-knowledge)', {
      userId,
      ip: req.ip
    });

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

    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
    }

    const { currentEncryptionKey, newEncryptionKey } = req.body;

    if (!currentEncryptionKey || !newEncryptionKey) {
      return res.status(400).json({
        error: 'Current and new encryption keys are required',
        timestamp: new Date().toISOString()
      });
    }

    // Verify current encryption key matches session
    const sessionKey = await vaultRepository.getEncryptionKey(userId);
    if (!sessionKey || sessionKey !== currentEncryptionKey) {
      return res.status(403).json({
        error: 'Current encryption key does not match session',
        timestamp: new Date().toISOString()
      });
    }

    // Get all vault entries for re-encryption
    const entriesResult = await vaultRepository.getEntries(userId);
    const entries = entriesResult.entries || [];
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
        const decryptedDataString = await cryptoService.decrypt(encryptedData, currentEncryptionKey);
        const decryptedData = JSON.parse(decryptedDataString);
        
        // Re-encrypt with new key
        const reencryptedDataObject = await cryptoService.encrypt(decryptedDataString, newEncryptionKey);
        
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

    // Create new session with new encryption key
    await vaultRepository.clearSession(userId);
    await vaultRepository.createSession(userId, newEncryptionKey);

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

module.exports = {
  unlockVault,
  lockVault,
  changeMasterPassword,
  // Add other functions as needed
}; 
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
    const { title, username, email, password, website, notes, category, favorite } = entryData;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Entry title is required',
        timestamp: new Date().toISOString()
      });
    }

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
        category: entry.category,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Create entry error', {
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
 * Get all vault entries for user
 * GET /vault/entries
 */
const getEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get encryption key from request body (stateless approach)
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

    // Get pagination and filtering parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 entries per page
    const category = req.query.category;
    const search = req.query.search;

    // Get entries from vault
    const result = await vaultRepository.getEntries(userId, {
      page,
      limit,
      category,
      search
    });

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
    
    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
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

    // Get encryption key from session
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    if (!encryptionKey) {
      return res.status(403).json({
        error: 'No encryption key found in session',
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
      ...decryptedData,
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

    // Validate encryption key by attempting to decrypt the existing entry
    try {
      let testEncryptedData = existingEntry.encryptedData;
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

    // Validate entry data
    const { title, username, email, password, website, notes, category, favorite } = entryData;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Entry title is required',
        timestamp: new Date().toISOString()
      });
    }

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

    // Update entry in vault
    const updatedEntry = await vaultRepository.updateEntry(entryId, userId, {
      name: dataToEncrypt.title,
      username: dataToEncrypt.username || null, // Use null instead of empty string
      url: dataToEncrypt.website || null, // Use null instead of empty string
      encryptedData: JSON.stringify(encryptedData),
      category: category || 'other',
      favorite: favorite !== undefined ? favorite : undefined
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
        category: updatedEntry.category,
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
    
    // No session check needed for delete operations - just authentication
    // Delete operations don't require encryption keys

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
    const { q: query, category } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long',
        timestamp: new Date().toISOString()
      });
    }

    // Use the getEntries function with search parameter
    return await getEntries({
      ...req,
      query: { ...req.query, search: query }
    }, res);

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
    const password = passwordGenerator.generate(options);

    logger.info('Password generated', {
      userId: req.user?.id,
      length: options.length || 16,
      includeSymbols: options.includeSymbols || false,
      ip: req.ip
    });

    res.status(200).json({
      password,
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
    
    // Check if vault is unlocked
    const session = await vaultRepository.getSession(userId);
    if (!session) {
      return res.status(403).json({
        error: 'Vault must be unlocked to perform this operation',
        timestamp: new Date().toISOString()
      });
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
  checkExpiringPasswords
};
