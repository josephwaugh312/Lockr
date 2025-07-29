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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
    
    res.status(500).json({
      error: "Failed to verify vault session",
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
        await cryptoService.decrypt(encryptedData, Buffer.from(encryptionKey, 'base64'));
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

    // No session creation needed - system is now stateless!
    // Each vault operation will include the encryption key

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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(200).json({
      message: 'Master password changed successfully',
      reencryptedEntries: reencryptedCount,
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

  } catch (error) {
    logger.error('Change master password error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(500).json({
      error: 'Failed to change master password',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
      username: username || '',
      email: email || '',
      password: password || '',
      website: website || '',
      notes: notes || '',
      category: category || 'other'
    };

    // Encrypt the entry data
    console.log("DEBUG: Starting encryption with key length:", encryptionKey.length);
    let encryptedData;
    try {
      encryptedData = await cryptoService.encrypt(JSON.stringify(dataToEncrypt), Buffer.from(encryptionKey, 'base64'));
      console.log("DEBUG: Encryption completed successfully");
    } catch (encryptionError) {
      console.log("DEBUG: Encryption failed:", encryptionError.message);
      return res.status(500).json({
        error: "Encryption failed: " + encryptionError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Create entry in vault
    console.log("DEBUG: About to call database");
    console.log("DEBUG: Creating entry in database");
    const entry = await vaultRepository.createEntry(userId, {
      name: dataToEncrypt.title,
      username: dataToEncrypt.username,
      url: dataToEncrypt.website,
      encryptedData: JSON.stringify(encryptedData),
      category: category || 'other',
      favorite: favorite || false
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
    console.log("DEBUG: Database entry creation completed");

    logger.info('Vault entry created', {
      userId,
      entryId: entry.id,
      category: entry.category,
      ip: req.ip
    });

    console.log("DEBUG: About to send success response");
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

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
    console.log("DEBUG: Entry data prepared, getting encryption key");
    console.log("DEBUG: Getting session for userId:", userId);
    const sessionDebug = await vaultRepository.getSession(userId);
    console.log("DEBUG: Session exists:", !!sessionDebug);
    const encryptionKey = await vaultRepository.getEncryptionKey(userId);
    console.log("DEBUG: Encryption key result:", !!encryptionKey);
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(200).json({
      entry: decryptedEntry,
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

  } catch (error) {
    logger.error('Get entry error', {
      error: error.message,
      userId: req.user?.id,
      entryId: req.params.id,
      ip: req.ip
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

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
  console.log("DEBUG: UpdateEntry function called");
  try {
    const userId = req.user.id;
    const entryId = req.params.id;
    console.log("DEBUG: Processing update for entry:", entryId, "user:", userId);

    // SECURITY: Never log request body (contains encryption key and sensitive data)
    // console.log("DEBUG: UpdateEntry called for entry:", entryId);
    // console.log("DEBUG: Request body:", JSON.stringify(req.body, null, 2));

    // Get encryption key from request body (stateless approach)
    const { encryptionKey, ...entryData } = req.body;
    console.log("DEBUG: Has encryption key:", !!encryptionKey, "Key length:", encryptionKey?.length);
    console.log("DEBUG: Entry data fields:", Object.keys(entryData));
    
    if (!encryptionKey) {
      console.log("DEBUG: Missing encryption key");
      return res.status(400).json({
        error: 'Encryption key is required for vault operations',
        timestamp: new Date().toISOString()
      });
    }

    // Validate encryption key format (should be base64 encoded)
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptionKey)) {
      console.log("DEBUG: Invalid encryption key format");
      return res.status(400).json({
        error: 'Invalid encryption key format',
        timestamp: new Date().toISOString()
      });
    }

    console.log("DEBUG: Getting existing entry...");
    // Check if entry exists and belongs to user
    const existingEntry = await vaultRepository.getEntry(entryId, userId);
    if (!existingEntry) {
      console.log("DEBUG: Entry not found");
      return res.status(404).json({
        error: 'Entry not found',
        timestamp: new Date().toISOString()
      });
    }
    console.log("DEBUG: Found existing entry, validating encryption key...");

    // Validate encryption key by attempting to decrypt the existing entry
    try {
      let testEncryptedData = existingEntry.encryptedData;
      if (typeof testEncryptedData === 'string') {
        testEncryptedData = JSON.parse(testEncryptedData);
      }
      await cryptoService.decrypt(testEncryptedData, Buffer.from(encryptionKey, 'base64'));
      console.log("DEBUG: Encryption key validation successful");
    } catch (decryptError) {
      console.log("DEBUG: Encryption key validation failed:", decryptError.message);
      return res.status(403).json({
        error: 'Invalid encryption key',
        timestamp: new Date().toISOString()
      });
    }

    console.log("DEBUG: Validating entry data...");
    // Validate entry data
    const { title, username, email, password, website, notes, category, favorite } = entryData;
    
    if (!title || title.trim().length === 0) {
      console.log("DEBUG: Missing or empty title");
      return res.status(400).json({
        error: 'Entry title is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log("DEBUG: Preparing data for encryption...");
    // Prepare data for encryption
    const dataToEncrypt = {
      title: title.trim(),
      username: username || '',
      email: email || '',
      password: password || '',
      website: website || '',
      notes: notes || '',
      category: category || 'other'
    };

    // Encrypt the entry data
    console.log("DEBUG: Starting encryption with key length:", encryptionKey.length);
    let encryptedData;
    try {
      encryptedData = await cryptoService.encrypt(JSON.stringify(dataToEncrypt), Buffer.from(encryptionKey, 'base64'));
      console.log("DEBUG: Encryption completed successfully");
    } catch (encryptionError) {
      console.log("DEBUG: Encryption failed:", encryptionError.message);
      return res.status(500).json({
        error: "Encryption failed: " + encryptionError.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log("DEBUG: Calling vaultRepository.updateEntry...");
    // Update entry in vault
    const updatedEntry = await vaultRepository.updateEntry(entryId, userId, {
      name: dataToEncrypt.title,
      username: dataToEncrypt.username,
      url: dataToEncrypt.website,
      encryptedData: JSON.stringify(encryptedData),
      category: category || 'other',
      favorite: favorite !== undefined ? favorite : undefined
    });
    console.log("DEBUG: Database update completed successfully");

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
    console.log("DEBUG: Sending success response");

    res.status(200).json(response);
    console.log("DEBUG: Response sent successfully");

  } catch (error) {
    console.log("DEBUG: Caught error in updateEntry:", error.message);
    console.log("DEBUG: Error stack:", error.stack);
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
    console.log("DEBUG: Sent error response");
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(500).json({
      error: 'Failed to search entries',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

  } catch (error) {
    logger.error('Generate password error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(500).json({
      error: 'Failed to generate password',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
  }

  if (error.message.includes('decrypt')) {
    return res.status(403).json({
      error: 'Invalid encryption key - vault may need to be unlocked again',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
  }

  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

  } catch (error) {
    logger.error('Check expiring passwords error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");

    res.status(500).json({
      error: 'Failed to check expiring passwords',
      timestamp: new Date().toISOString()
    });
    console.log("DEBUG: Success response sent");
    console.log("DEBUG: Database call completed");
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
