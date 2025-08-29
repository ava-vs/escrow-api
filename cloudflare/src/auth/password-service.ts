/**
 * Password Service - Secure password hashing and verification
 * Uses Web Crypto API with PBKDF2 for financial-grade security
 */

export class PasswordService {
  private static readonly ITERATIONS = 100000; // OWASP recommended minimum
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly HASH_LENGTH = 32; // 256 bits

  /**
   * Generate a cryptographically secure salt
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * Hash password using PBKDF2
   */
  private static async hashPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive key using PBKDF2
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.HASH_LENGTH * 8 // bits
    );

    return new Uint8Array(hashBuffer);
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private static base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Hash a password for storage
   * Returns { hash, salt } as base64 strings
   */
  static async hashPasswordForStorage(password: string): Promise<{ hash: string; salt: string }> {
    // Validate password strength
    if (!this.isPasswordStrong(password)) {
      throw new Error('Password does not meet security requirements');
    }

    const salt = this.generateSalt();
    const hash = await this.hashPassword(password, salt);

    return {
      hash: this.arrayToBase64(hash),
      salt: this.arrayToBase64(salt)
    };
  }

  /**
   * Verify a password against stored hash and salt
   * Uses constant-time comparison to prevent timing attacks
   */
  static async verifyPassword(
    password: string,
    storedHash: string,
    storedSalt: string
  ): Promise<boolean> {
    try {
      const salt = this.base64ToArray(storedSalt);
      const expectedHash = this.base64ToArray(storedHash);
      const actualHash = await this.hashPassword(password, salt);

      // Constant-time comparison
      return this.constantTimeEqual(expectedHash, actualHash);
    } catch (error) {
      // Always return false on error to prevent information leakage
      return false;
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private static constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Validate password strength
   */
  static isPasswordStrong(password: string): boolean {
    // Minimum requirements for financial application
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    return Array.from(array, byte => charset[byte % charset.length]).join('');
  }

  /**
   * Generate a secure token for password reset
   */
  static generateResetToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayToBase64(array);
  }
}