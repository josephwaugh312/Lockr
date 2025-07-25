/**
 * Client-side encryption utilities for zero-knowledge architecture
 * Master passwords are never sent to the server - only derived encryption keys
 */

/**
 * Derive encryption key from master password using PBKDF2
 * This matches the server-side implementation for validation
 */
export async function deriveEncryptionKey(masterPassword: string, email: string): Promise<string> {
  // Use email as salt for consistent key derivation
  const salt = email.toLowerCase();
  
  // Convert password and salt to ArrayBuffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(masterPassword);
  const saltBuffer = encoder.encode(salt);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000, // Match server-side iterations
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );
  
  // Convert to base64 string
  const derivedArray = new Uint8Array(derivedBits);
  return btoa(String.fromCharCode.apply(null, Array.from(derivedArray)));
}

/**
 * Generate test data for server-side validation
 * The server validates the encryption key by attempting to decrypt this test data
 */
export function generateTestData(): string {
  return JSON.stringify({
    test: true,
    timestamp: Date.now(),
    data: 'validation_test'
  });
}

/**
 * Encrypt data using AES-GCM (matches server-side encryption)
 */
export async function encryptData(data: string, encryptionKey: string): Promise<string> {
  try {
    // Convert base64 key to ArrayBuffer
    const keyBuffer = Uint8Array.from(atob(encryptionKey), c => c.charCodeAt(0));
    
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Generate random IV (96 bits for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Return as base64
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(encryptedData: string, encryptionKey: string): Promise<string> {
  try {
    // Convert base64 to ArrayBuffer
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Convert base64 key to ArrayBuffer
    const keyBuffer = Uint8Array.from(atob(encryptionKey), c => c.charCodeAt(0));
    
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      encrypted
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
    
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Validate master password by attempting to derive key and decrypt test data
 */
export async function validateMasterPassword(
  masterPassword: string, 
  email: string, 
  testEncryptedData: string
): Promise<boolean> {
  try {
    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(masterPassword, email);
    
    // Try to decrypt test data
    const decrypted = await decryptData(testEncryptedData, encryptionKey);
    const parsed = JSON.parse(decrypted);
    
    // Validate test data structure
    return parsed.test === true && typeof parsed.timestamp === 'number';
    
  } catch (error) {
    return false;
  }
} 