/**
 * Session encryption utilities for PKCE data protection
 * Provides symmetric encryption for sensitive session data
 */

/**
 * Encrypts data using Web Crypto API
 * @param data Data to encrypt
 * @param key Encryption key
 * @returns Promise resolving to encrypted data with IV
 */
export async function encryptData(data: string, key: CryptoKey): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBuffer);

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt session data');
  }
}

/**
 * Decrypts data using Web Crypto API
 * @param encryptedData Encrypted data with IV
 * @param key Decryption key
 * @returns Promise resolving to decrypted string
 */
export async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt session data');
  }
}

/**
 * Derives encryption key from environment secret
 * @returns Promise resolving to encryption key
 */
export async function deriveEncryptionKey(): Promise<CryptoKey> {
  try {
    // Get encryption secret from environment
    const secret = process.env.AUTH_SECRET || 'dev-secret-key-change-in-production';

    if (secret === 'dev-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set in production');
    }

    // Import key material
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('pkce-session-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch (error) {
    console.error('Key derivation failed:', error);
    throw new Error('Failed to derive encryption key');
  }
}

/**
 * Encrypts PKCE session data for secure storage
 * @param sessionData PKCE session object
 * @returns Promise resolving to encrypted session string
 */
export async function encryptPKCESession(sessionData: Record<string, any>): Promise<string> {
  const key = await deriveEncryptionKey();
  const jsonData = JSON.stringify(sessionData);
  return encryptData(jsonData, key);
}

/**
 * Decrypts PKCE session data from secure storage
 * @param encryptedSession Encrypted session string
 * @returns Promise resolving to PKCE session object
 */
export async function decryptPKCESession<T = Record<string, any>>(
  encryptedSession: string,
): Promise<T> {
  const key = await deriveEncryptionKey();
  const jsonData = await decryptData(encryptedSession, key);
  return JSON.parse(jsonData);
}

/**
 * Validates environment for encryption support
 * @returns True if encryption is properly configured
 */
export function validateEncryptionConfig(): boolean {
  try {
    // Check if Web Crypto API is available
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.warn('Web Crypto API not available - falling back to plaintext storage');
      return false;
    }

    // Check if AUTH_SECRET is configured
    const secret = process.env.AUTH_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error('AUTH_SECRET environment variable is required in production');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Encryption config validation failed:', error);
    return false;
  }
}
