const userRepository = require('../models/userRepository');
const vaultRepository = require('../models/vaultRepository');
const { CryptoService } = require('../services/cryptoService');
const { logger, securityEvents } = require('../utils/logger');
const { 
  validateVaultUnlockData, 
  validateVaultEntryData,
  validatePasswordGenerationOptions 
} = require('../utils/validation');
const passwordGenerator = require('../utils/passwordGenerator');

// Initialize services
const cryptoService = new CryptoService();

// Rate limiting
const rateLimitStore = new Map();

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
    
    // Rate limiting
    const rateLimit = checkRateLimit(userId, 'unlock', 5, 60000);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many unlock attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    const { encryptionKey } = req.body;

    if (!encryptionKey) {
      return res.status(400).json({
        error: 'Encryption key is required',
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

    // Get user data
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key by attempting to decrypt existing data
    let isValidKey = true;
    const entriesResult = await vaultRepository.getEntries(userId, { limit: 1 });
    
    if (entriesResult.entries && entriesResult.entries.length > 0) {
      // User has existing data - validate key by decryption test
      try {
        const testEntry = entriesResult.entries[0];
        let encryptedData = testEntry.encryptedData;
        if (typeof encryptedData === 'string') {
          encryptedData = JSON.parse(encryptedData);
        }
        await cryptoService.decrypt(encryptedData, encryptionKey);
      } catch (decryptError) {
        isValidKey = false;
      }
    }
    // If no entries exist, accept the encryption key (new user)
    
    if (!isValidKey) {
      logger.warn('Vault unlock failed - invalid encryption key', {
        userId,
        ip: req.ip
      });
      
      securityEvents.failedVaultUnlock(userId, req.ip);
      
      return res.status(401).json({
        error: 'Invalid master password',
        timestamp: new Date().toISOString()
      });
    }

    // Create vault session with encryption key
    await vaultRepository.createSession(userId, encryptionKey);

    logger.info('Vault unlocked successfully (zero-knowledge)', {
      userId,
      ip: req.ip
    });

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

    await vaultRepository.clearSession(userId);

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
        const decryptedData = await cryptoService.decrypt(encryptedData, currentEncryptionKey);
        
        // Re-encrypt with new key
        const reencryptedDataObject = await cryptoService.encrypt(decryptedData, newEncryptionKey);
        
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