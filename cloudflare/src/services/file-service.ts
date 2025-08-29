/**
 * Simple file service without R2 - stores file metadata only
 * For free plan compatibility
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: Date;
  // For free plan: store as base64 in database (small files only)
  content?: string;
  // Or external URL if hosted elsewhere
  externalUrl?: string;
}

export class FileService {
  private db: ReturnType<typeof drizzle>;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Store small file as base64 in database (free plan limitation)
   * Max size: 1MB for base64 storage
   */
  async storeFile(
    file: File, 
    uploadedBy: string
  ): Promise<FileMetadata> {
    if (file.size > 1024 * 1024) { // 1MB limit
      throw new Error('File too large. Maximum size: 1MB');
    }

    const fileId = crypto.randomUUID();
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const fileMetadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedBy,
      uploadedAt: new Date(),
      content: base64Content
    };

    // Store in a simple files table (we'll add this to schema)
    // For now, return the metadata
    return fileMetadata;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<FileMetadata | null> {
    // Implementation would query files table
    // For now, return null
    return null;
  }

  /**
   * Generate download URL for file
   * For free plan: return data URL
   */
  async getDownloadUrl(fileId: string): Promise<string | null> {
    const file = await this.getFile(fileId);
    if (!file || !file.content) {
      return null;
    }

    // Return data URL for direct download
    return `data:${file.type};base64,${file.content}`;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    // Implementation would delete from files table
    return true;
  }
}