/**
 * Document service for managing documents and acts in the Cloudflare Workers environment
 * Adapted from the original document service for D1 database
 */

import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { Env } from '../index';

export interface IDocumentData {
  type: 'CONTRACT' | 'ROADMAP' | 'SPECIFICATION' | 'DELIVERY' | 'OTHER';
  name: string;
  content: any; // JSON content
}

export interface IActData {
  type: 'APPROVAL' | 'SIGNATURE' | 'COMPLETION' | 'REJECTION';
  description: string;
  signatories: string[]; // Array of user IDs who need to sign
}

export class DocumentService {
  private db: ReturnType<typeof drizzle>;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Create a new document in the system
   * @param orderId Order ID for the document
   * @param createdBy User ID of creator
   * @param documentData Document data
   * @returns Created document
   */
  async createDocument(
    orderId: string,
    createdBy: string,
    documentData: IDocumentData
  ): Promise<schema.Document> {
    try {
      const documentId = crypto.randomUUID();

      const [document] = await this.db
        .insert(schema.documents)
        .values({
          id: documentId,
          orderId,
          type: documentData.type,
          name: documentData.name,
          createdBy,
          content: JSON.stringify(documentData.content),
          approvedBy: JSON.stringify([]) // Empty array initially
        })
        .returning();

      return document!;
    } catch (error) {
      console.error('Error creating document:', error);
      throw new Error('Failed to create document');
    }
  }

  /**
   * Get document by ID
   * @param documentId Document ID
   * @returns Document or null
   */
  async getDocumentById(documentId: string): Promise<schema.Document | null> {
    try {
      const [document] = await this.db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, documentId));

      return document || null;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw new Error('Failed to fetch document');
    }
  }

  /**
   * Get documents for an order
   * @param orderId Order ID
   * @returns Array of documents
   */
  async getDocumentsByOrderId(orderId: string): Promise<schema.Document[]> {
    try {
      return await this.db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.orderId, orderId));
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Failed to fetch documents');
    }
  }

  /**
   * Approve a document by adding user to approved list
   * @param documentId Document ID
   * @param userId User ID approving the document
   * @returns Updated document
   */
  async approveDocument(documentId: string, userId: string): Promise<schema.Document> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      const approvedBy = JSON.parse(document.approvedBy || '[]') as string[];
      
      // Add user if not already approved
      if (!approvedBy.includes(userId)) {
        approvedBy.push(userId);
      }

      const [updatedDocument] = await this.db
        .update(schema.documents)
        .set({ 
          approvedBy: JSON.stringify(approvedBy)
        })
        .where(eq(schema.documents.id, documentId))
        .returning();

      return updatedDocument!;
    } catch (error) {
      console.error('Error approving document:', error);
      throw new Error('Failed to approve document');
    }
  }

  /**
   * Create an act for document workflow
   * @param documentId Document ID
   * @param createdBy User ID creating the act
   * @param actData Act data
   * @returns Created act
   */
  async createAct(
    documentId: string,
    createdBy: string,
    actData: IActData
  ): Promise<schema.Act> {
    try {
      const actId = crypto.randomUUID();

      const [act] = await this.db
        .insert(schema.acts)
        .values({
          id: actId,
          documentId,
          type: actData.type,
          description: actData.description,
          createdBy,
          status: 'PENDING',
          signatories: JSON.stringify(actData.signatories),
          signatures: JSON.stringify([]) // Empty array initially
        })
        .returning();

      return act!;
    } catch (error) {
      console.error('Error creating act:', error);
      throw new Error('Failed to create act');
    }
  }

  /**
   * Sign an act
   * @param actId Act ID
   * @param userId User ID signing the act
   * @param signature Signature data (can be string or object)
   * @returns Updated act
   */
  async signAct(actId: string, userId: string, signature: any = {}): Promise<schema.Act> {
    try {
      const [act] = await this.db
        .select()
        .from(schema.acts)
        .where(eq(schema.acts.id, actId));

      if (!act) {
        throw new Error('Act not found');
      }

      const signatories = JSON.parse(act.signatories || '[]') as string[];
      const signatures = JSON.parse(act.signatures || '[]') as any[];

      // Check if user is authorized to sign
      if (!signatories.includes(userId)) {
        throw new Error('User not authorized to sign this act');
      }

      // Check if already signed
      const existingSignature = signatures.find(sig => sig.userId === userId);
      if (existingSignature) {
        throw new Error('User has already signed this act');
      }

      // Add signature
      signatures.push({
        userId,
        signature,
        signedAt: new Date().toISOString()
      });

      // Check if all required signatures are collected
      const allSigned = signatories.every(signatory => 
        signatures.some(sig => sig.userId === signatory)
      );

      const newStatus = allSigned ? 'COMPLETED' : 'SIGNED';

      const [updatedAct] = await this.db
        .update(schema.acts)
        .set({ 
          signatures: JSON.stringify(signatures),
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(schema.acts.id, actId))
        .returning();

      return updatedAct!;
    } catch (error) {
      console.error('Error signing act:', error);
      throw new Error('Failed to sign act');
    }
  }

  /**
   * Get acts for a document
   * @param documentId Document ID
   * @returns Array of acts
   */
  async getActsByDocumentId(documentId: string): Promise<schema.Act[]> {
    try {
      return await this.db
        .select()
        .from(schema.acts)
        .where(eq(schema.acts.documentId, documentId));
    } catch (error) {
      console.error('Error fetching acts:', error);
      throw new Error('Failed to fetch acts');
    }
  }

  /**
   * Update act status
   * @param actId Act ID
   * @param status New status
   * @returns Updated act
   */
  async updateActStatus(
    actId: string, 
    status: 'PENDING' | 'SIGNED' | 'COMPLETED' | 'REJECTED'
  ): Promise<schema.Act> {
    try {
      const [act] = await this.db
        .update(schema.acts)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(schema.acts.id, actId))
        .returning();

      if (!act) {
        throw new Error('Act not found');
      }

      return act;
    } catch (error) {
      console.error('Error updating act status:', error);
      throw new Error('Failed to update act status');
    }
  }

  /**
   * Get pending acts for a user (acts they need to sign)
   * @param userId User ID
   * @returns Array of pending acts
   */
  async getPendingActsForUser(userId: string): Promise<schema.Act[]> {
    try {
      const allActs = await this.db
        .select()
        .from(schema.acts)
        .where(eq(schema.acts.status, 'PENDING'));

      // Filter acts where user is a required signatory and hasn't signed yet
      const pendingActs = allActs.filter(act => {
        const signatories = JSON.parse(act.signatories || '[]') as string[];
        const signatures = JSON.parse(act.signatures || '[]') as any[];
        
        return signatories.includes(userId) && 
               !signatures.some(sig => sig.userId === userId);
      });

      return pendingActs;
    } catch (error) {
      console.error('Error fetching pending acts:', error);
      throw new Error('Failed to fetch pending acts');
    }
  }
}