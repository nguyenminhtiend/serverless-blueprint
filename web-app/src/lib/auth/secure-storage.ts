import { AuthUser } from '@/hooks/use-auth';

class SecureStorage {
  private readonly STORAGE_KEY = 'auth_enc_data';
  private readonly ENCRYPTION_KEY = 'auth_app_key_v1';

  private async generateKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    return crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encrypt(text: string): Promise<string> {
    try {
      const key = await this.generateKey(this.ENCRYPTION_KEY);
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  private async decrypt(encryptedText: string): Promise<string> {
    try {
      const key = await this.generateKey(this.ENCRYPTION_KEY);
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  async setUser(user: AuthUser): Promise<void> {
    try {
      const userData = JSON.stringify(user);
      const encryptedData = await this.encrypt(userData);
      
      // Use sessionStorage instead of localStorage for better security
      sessionStorage.setItem(this.STORAGE_KEY, encryptedData);
    } catch (error) {
      console.error('Failed to store user data:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const encryptedData = sessionStorage.getItem(this.STORAGE_KEY);
      
      if (!encryptedData) {
        return null;
      }
      
      const decryptedData = await this.decrypt(encryptedData);
      return JSON.parse(decryptedData) as AuthUser;
    } catch (error) {
      console.error('Failed to retrieve user data:', error);
      // Remove corrupted data
      this.clearUser();
      return null;
    }
  }

  clearUser(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    // Also clear from localStorage in case there's old data
    localStorage.removeItem('auth_user');
  }

  // Check if secure storage is available
  isAvailable(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        'sessionStorage' in window &&
        'crypto' in window &&
        'subtle' in window.crypto
      );
    } catch {
      return false;
    }
  }
}

export const secureStorage = new SecureStorage();