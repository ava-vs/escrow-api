/**
 * Document service for managing documents in the escrow system
 * Handles creation, approval, and management of various document types
 */

import { getDb } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../schema';
import { v4 as uuidv4 } from 'uuid';
import { 
  IDocument, 
  IAct, 
  DocumentType, 
  ActStatus, 
  IOrder,
  MilestoneStatus
} from '../interfaces';

export class DocumentService {
  private orderService: any; // Will be set via dependency injection

  constructor(orderService?: any) {
    if (orderService) {
      this.orderService = orderService;
    }
  }

  /**
   * Set order service reference (for circular dependency resolution)
   * @param orderService Order service instance
   */
  setOrderService(orderService: any): void {
    this.orderService = orderService;
  }

  /**
   * Create a new document in the system
   * @param orderId Order ID for the document
   * @param type Document type
   * @param name Document name/title
   * @param createdBy User ID of creator
   * @param content Document content (structure depends on document type)
   * @returns Created document
   */
  async createDocument(
    orderId: string,
    type: DocumentType,
    name: string,
    createdBy: string,
    content: any
  ): Promise<IDocument> {
    // Validate input
    if (!orderId) throw new Error('Order ID is required');
    if (!type) throw new Error('Document type is required');
    if (!name) throw new Error('Document name is required');
    if (!createdBy) throw new Error('Creator ID is required');
    if (!content) throw new Error('Document content is required');
    
    // Create document
    const documentId = uuidv4();
    const newDocument = {
      id: documentId,
      orderId,
      type,
      name,
      createdBy,
      createdAt: new Date(),
      content
    };
    
    await getDb().insert(schema.documents).values(newDocument);
    
    return newDocument;
  }
  
  /**
   * Get document by ID
   * @param documentId Document ID
   * @returns Document or null if not found
   */
  async getDocumentById(documentId: string): Promise<IDocument | null> {
    if (!documentId) throw new Error('Document ID is required');
    
    const document = await getDb().query.documents.findFirst({
      where: eq(schema.documents.id, documentId)
    });
    
    if (!document) return null;
    
    // Convert string type to DocumentType enum
    return {
      ...document,
      type: document.type as unknown as DocumentType, // Explicit type conversion
      // Handle nullable vs undefined for approvedBy
      approvedBy: document.approvedBy || undefined
    };
  }
  
  /**
   * Get all documents for a specific order
   * @param orderId Order ID
   * @returns Array of documents for the order
   */
  async getDocumentsByOrder(orderId: string): Promise<IDocument[]> {
    if (!orderId) throw new Error('Order ID is required');
    
    const documents = await getDb().query.documents.findMany({
      where: eq(schema.documents.orderId, orderId)
    });
    
    // Convert string types to DocumentType enum
    return documents.map(document => ({
      ...document,
      type: document.type as unknown as DocumentType, // Explicit type conversion
      // Handle nullable vs undefined for approvedBy
      approvedBy: document.approvedBy || undefined
    }));
  }
  
  /**
   * Approve a document by a user
   * @param documentId Document ID
   * @param approverId User ID approving the document
   * @returns Updated document
   */
  async approveDocument(
    documentId: string,
    approverId: string
  ): Promise<IDocument> {
    if (!documentId) throw new Error('Document ID is required');
    if (!approverId) throw new Error('Approver ID is required');
    
    const document = await this.getDocumentById(documentId);
    
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }
    
    // Check if already approved by this user
    const approvedBy = document.approvedBy || [];
    if (approvedBy.includes(approverId)) {
      throw new Error('Document already approved by this user');
    }
    
    // Add approver
    const updatedApprovedBy = [...approvedBy, approverId];
    
    // Update document
    await getDb()
      .update(schema.documents)
      .set({ approvedBy: updatedApprovedBy })
      .where(eq(schema.documents.id, documentId));
    
    return {
      ...document,
      approvedBy: updatedApprovedBy
    };
  }
  
  /**
   * Create an act of work for a milestone
   * @param orderId Order ID
   * @param milestoneId Milestone ID
   * @param deliverableIds Array of deliverable document IDs
   * @param createdBy User ID creating the act
   * @param name Name/title of the act
   * @returns Created act
   */
  async createAct(
    orderId: string,
    milestoneId: string,
    deliverableIds: string[],
    createdBy: string,
    name: string
  ): Promise<IAct> {
    // Validate input
    if (!orderId) throw new Error('Order ID is required');
    if (!milestoneId) throw new Error('Milestone ID is required');
    if (!deliverableIds || deliverableIds.length === 0) {
      throw new Error('At least one deliverable ID is required');
    }
    if (!createdBy) throw new Error('Creator ID is required');
    if (!name) throw new Error('Act name is required');
    
    // Create document transaction
    return await getDb().transaction(async (tx) => {
      // First create base document
      const documentId = uuidv4();
      const actId = uuidv4();
      
      // Create document
      await tx.insert(schema.documents).values({
        id: documentId,
        orderId,
        type: DocumentType.ACT_OF_WORK,
        name,
        createdBy,
        createdAt: new Date(),
        content: { milestoneId, deliverableIds }
      });
      
      // Create act
      await tx.insert(schema.acts).values({
        id: actId,
        documentId,
        milestoneId,
        deliverableIds,
        status: ActStatus.CREATED,
        signedBy: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Update milestone status to AWAITING_ACCEPTANCE
      await tx
        .update(schema.milestones)
        .set({ 
          status: MilestoneStatus.AWAITING_ACCEPTANCE,
          updatedAt: new Date()
        })
        .where(eq(schema.milestones.id, milestoneId));
      
      // Get created act with document
      const document = await tx.query.documents.findFirst({
        where: eq(schema.documents.id, documentId)
      });
      
      const act = await tx.query.acts.findFirst({
        where: eq(schema.acts.documentId, documentId)
      });
      
      if (!document || !act) {
        throw new Error('Failed to create act');
      }
      
      // Combine document and act data
      return {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: act.milestoneId,
        deliverableIds: act.deliverableIds,
        status: act.status,
        signedBy: act.signedBy,
        rejectionReason: act.rejectionReason
      } as IAct;
    });
  }
  
  /**
   * Sign an act by a user
   * @param actId Act ID (document ID)
   * @param userId User ID signing the act
   * @returns Updated act
   */
  async signAct(actId: string, userId: string): Promise<IAct> {
    if (!actId) throw new Error('Act ID is required');
    if (!userId) throw new Error('User ID is required');
    
    return await getDb().transaction(async (tx) => {
      // Get document
      const document = await tx.query.documents.findFirst({
        where: and(
          eq(schema.documents.id, actId),
          eq(schema.documents.type, DocumentType.ACT_OF_WORK)
        )
      });
      
      if (!document) {
        throw new Error(`Act with ID ${actId} not found`);
      }
      
      // Get act
      const act = await tx.query.acts.findFirst({
        where: eq(schema.acts.documentId, actId)
      });
      
      if (!act) {
        throw new Error(`Act data for document ${actId} not found`);
      }
      
      // Check if already signed by this user
      const signedBy = act.signedBy || [];
      if (signedBy.some(sig => sig.userId === userId)) {
        throw new Error('Act already signed by this user');
      }
      
      // Add signature
      const newSignature = {
        userId,
        signedAt: new Date()
      };
      
      signedBy.push(newSignature);
      
      // Determine new status based on signatures
      // This logic should be expanded based on the exact requirements
      // For example, checking if both contractor and customer have signed
      let newStatus = act.status;
      
      // Check if order is a group order
      const order = await this.orderService.getOrder(document.orderId);
      
      if (order.isGroupOrder) {
        // For group orders, only representative signature is needed
        if (userId === order.representativeId) {
          newStatus = ActStatus.SIGNED_CUSTOMER;
        } else if (userId === order.contractorId) {
          newStatus = ActStatus.SIGNED_CONTRACTOR;
        }
      } else {
        // For regular orders
        if (order.customerIds.includes(userId)) {
          newStatus = ActStatus.SIGNED_CUSTOMER;
        } else if (userId === order.contractorId) {
          newStatus = ActStatus.SIGNED_CONTRACTOR;
        }
      }
      
      // If both parties signed, mark as completed
      const hasCustomerSignature = signedBy.some(sig => 
        order.customerIds.includes(sig.userId) || sig.userId === order.representativeId
      );
      
      const hasContractorSignature = signedBy.some(sig => 
        sig.userId === order.contractorId
      );
      
      if (hasCustomerSignature && hasContractorSignature) {
        newStatus = ActStatus.COMPLETED;
        
        // Mark milestone as completed
        await tx
          .update(schema.milestones)
          .set({ 
            status: MilestoneStatus.COMPLETED,
            paid: true,
            updatedAt: new Date()
          })
          .where(eq(schema.milestones.id, act.milestoneId));
      }
      
      // Update act
      await tx
        .update(schema.acts)
        .set({ 
          signedBy,
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(schema.acts.documentId, actId));
      
      // Return updated act
      return {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: act.milestoneId,
        deliverableIds: act.deliverableIds,
        status: newStatus,
        signedBy,
        rejectionReason: act.rejectionReason
      } as IAct;
    });
  }
  
  /**
   * Reject an act with a reason
   * @param actId Act ID (document ID)
   * @param userId User ID rejecting the act
   * @param reason Reason for rejection
   * @returns Updated act
   */
  async rejectAct(
    actId: string,
    userId: string,
    reason: string
  ): Promise<IAct> {
    if (!actId) throw new Error('Act ID is required');
    if (!userId) throw new Error('User ID is required');
    if (!reason) throw new Error('Rejection reason is required');
    
    // Do not use transaction to reject act
    const act = await getDb().insert(schema.acts).values({
      id: actId,
      documentId: actId,
      milestoneId: actId,
      deliverableIds: [],
      status: ActStatus.REJECTED,
      signedBy: [],
      rejectionReason: reason,
      createdAt: new Date(),
      updatedAt: new Date()
    });
      // Get document
      const document = await getDb().query.documents.findFirst({
        where: and(
          eq(schema.documents.id, actId),
          eq(schema.documents.type, DocumentType.ACT_OF_WORK)
        )
      });
      
      if (!document) {
        throw new Error(`Act with ID ${actId} not found`);
      }
      
      // Get act
      const actData = await getDb().query.acts.findFirst({
        where: eq(schema.acts.documentId, actId)
      });
      
      if (!actData) {
        throw new Error(`Act data for document ${actId} not found`);
      }
      
      // Check if act can be rejected (not already completed or rejected)
      if (actData.status === ActStatus.COMPLETED || actData.status === ActStatus.REJECTED) {
        throw new Error(`Cannot reject act with status ${actData.status}`);
      }
      
      // Update act
      await getDb().update(schema.acts)
        .set({ 
          status: ActStatus.REJECTED,
          rejectionReason: reason,
          updatedAt: new Date()
        })
        .where(eq(schema.acts.documentId, actId));
      
      // Update milestone status
      await getDb().update(schema.milestones)
        .set({ 
          status: MilestoneStatus.REJECTED,
          updatedAt: new Date()
        })
        .where(eq(schema.milestones.id, actData.milestoneId));
      
      // Return updated act
      return  {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: actData.milestoneId,
        deliverableIds: actData.deliverableIds,
        status: ActStatus.REJECTED,
        signedBy: actData.signedBy,
        rejectionReason: reason
      } as IAct;
  }
}
