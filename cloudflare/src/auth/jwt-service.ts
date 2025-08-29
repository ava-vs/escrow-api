/**
 * JWT Service - Token creation and validation
 * Uses Web Crypto API for signing and verification
 */

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  type: 'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM';
  iat: number; // Issued at
  exp: number; // Expires at
  jti: string; // JWT ID (unique token identifier)
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // Token ID
  type: 'refresh';
  iat: number;
  exp: number;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
  private static readonly ALGORITHM = 'HS256';

  /**
   * Generate HMAC key from secret
   */
  private static async getSigningKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  /**
   * Base64URL encode (JWT standard)
   */
  private static base64URLEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Base64URL decode (JWT standard)
   */
  private static base64URLDecode(data: string): Uint8Array {
    // Add padding if needed
    const padded = data + '==='.slice((data.length + 3) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Create JWT header
   */
  private static createHeader(): string {
    const header = {
      alg: this.ALGORITHM,
      typ: 'JWT'
    };
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(JSON.stringify(header));
    return this.base64URLEncode(headerBytes);
  }

  /**
   * Create JWT payload
   */
  private static createPayload(payload: JWTPayload | RefreshTokenPayload): string {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(payload));
    return this.base64URLEncode(payloadBytes);
  }

  /**
   * Sign JWT
   */
  private static async signJWT(data: string, secret: string): Promise<string> {
    const key = await this.getSigningKey(secret);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const signature = await crypto.subtle.sign('HMAC', key, dataBytes);
    return this.base64URLEncode(new Uint8Array(signature));
  }

  /**
   * Generate unique JWT ID
   */
  private static generateJTI(): string {
    return crypto.randomUUID();
  }

  /**
   * Create access token
   */
  static async createAccessToken(
    userId: string,
    email: string,
    userType: 'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM',
    secret: string
  ): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJTI();
    
    const payload: JWTPayload = {
      sub: userId,
      email,
      type: userType,
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRY,
      jti
    };

    const header = this.createHeader();
    const payloadEncoded = this.createPayload(payload);
    const data = `${header}.${payloadEncoded}`;
    const signature = await this.signJWT(data, secret);
    
    return {
      token: `${data}.${signature}`,
      jti,
      expiresAt: new Date((now + this.ACCESS_TOKEN_EXPIRY) * 1000)
    };
  }

  /**
   * Create refresh token
   */
  static async createRefreshToken(
    userId: string,
    secret: string
  ): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJTI();
    
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
      type: 'refresh',
      iat: now,
      exp: now + this.REFRESH_TOKEN_EXPIRY
    };

    const header = this.createHeader();
    const payloadEncoded = this.createPayload(payload);
    const data = `${header}.${payloadEncoded}`;
    const signature = await this.signJWT(data, secret);
    
    return {
      token: `${data}.${signature}`,
      jti,
      expiresAt: new Date((now + this.REFRESH_TOKEN_EXPIRY) * 1000)
    };
  }

  /**
   * Verify and decode JWT
   */
  static async verifyToken(token: string, secret: string): Promise<JWTPayload | RefreshTokenPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
      const data = `${headerEncoded}.${payloadEncoded}`;

      // Verify signature
      const key = await this.getSigningKey(secret);
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      const signature = this.base64URLDecode(signatureEncoded);
      
      const isValid = await crypto.subtle.verify('HMAC', key, signature, dataBytes);
      if (!isValid) {
        return null;
      }

      // Decode payload
      const payloadBytes = this.base64URLDecode(payloadEncoded);
      const payloadString = new TextDecoder().decode(payloadBytes);
      const payload = JSON.parse(payloadString);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract payload without verification (for debugging)
   */
  static decodePayload(token: string): JWTPayload | RefreshTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payloadBytes = this.base64URLDecode(parts[1]);
      const payloadString = new TextDecoder().decode(payloadBytes);
      return JSON.parse(payloadString);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    const payload = this.decodePayload(token);
    if (!payload) return null;

    return new Date(payload.exp * 1000);
  }
}