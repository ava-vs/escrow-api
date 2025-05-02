/**
 * Document service for managing documents in the escrow system
 * Handles creation, approval, and management of various document types
 */

import { getDb } from '../../db';
import { eq, and, or } from 'drizzle-orm';
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
  private orderService: any; // Will be set via dependency injection via setOrderService
  private escrowManager: any; // Reference to EscrowManager for direct access

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
   * Set escrow manager reference (for direct access to balance management)
   * @param escrowManager EscrowManager instance
   */
  setEscrowManager(escrowManager: any): void {
    this.escrowManager = escrowManager;
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
    
    // Create documents and acts without transaction (Neon HTTP driver doesn't support transactions)
      // First create base document
      const documentId = uuidv4();
      
      // Create document
      await getDb().insert(schema.documents).values({
        id: documentId,
        orderId,
        type: DocumentType.ACT_OF_WORK,
        name,
        createdBy,
        createdAt: new Date(),
        content: { milestoneId, deliverableIds }
      });
      
      // Create act with explicit foreign key to document
      await getDb().insert(schema.acts).values({
        id: documentId, // Using same ID as document for consistency
        documentId, // Explicit foreign key reference
        milestoneId,
        deliverableIds,
        status: ActStatus.CREATED,
        signedBy: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Update milestone status to AWAITING_ACCEPTANCE
      await getDb()
        .update(schema.milestones)
        .set({ 
          status: MilestoneStatus.AWAITING_ACCEPTANCE,
          updatedAt: new Date()
        })
        .where(eq(schema.milestones.id, milestoneId));
      
      // Get created act with document
      const document = await getDb().query.documents.findFirst({
        where: eq(schema.documents.id, documentId)
      });
      
      const act = await getDb().query.acts.findFirst({
        where: eq(schema.acts.documentId, documentId)
      });
      
      if (!document || !act) {
        throw new Error('Failed to create act');
      }
      
      // Convert signedBy from string[] to {userId, signedAt}[] format
      const signedByObjects = (act.signedBy || []).map((userId: string) => ({
        userId,
        signedAt: new Date()
      }));
      
      // Combine document and act data
      return {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: act.milestoneId,
        deliverableIds: act.deliverableIds,
        status: act.status,
        signedBy: signedByObjects,
        rejectionReason: act.rejectionReason
      } as IAct;
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
    
    // Get document (without transaction - Neon HTTP driver doesn't support transactions)
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
      
      // Get act (now using the same ID as document or explicit document_id)
      const act = await getDb().query.acts.findFirst({
        where: or(
          eq(schema.acts.id, actId),
          eq(schema.acts.documentId, actId)
        )
      });
      
      if (!act) {
        throw new Error(`Act data for document ${actId} not found`);
      }
      
      // Check if already signed by this user
      const signedBy = act.signedBy || [];
      if (signedBy.includes(userId)) {
        throw new Error('Act already signed by this user');
      }
      
      // Add user ID to the list of signers
      const updatedSignedBy = [...signedBy, userId];
      
      // Determine new status based on signatures
      // This logic should be expanded based on the exact requirements
      // For example, checking if both contractor and customer have signed
      let newStatus = act.status;
      
      // Проверяем, является ли подписывающий пользователь представителем платформы
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      const isPlatformUser = user && user.type === 'PLATFORM';
      
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
      // Используем updatedSignedBy вместо signedBy, чтобы учесть текущую добавляемую подпись
      const hasCustomerSignature = updatedSignedBy.some(sig => 
        order.customerIds.includes(sig) || sig === order.representativeId
      );
      
      const hasContractorSignature = updatedSignedBy.some(sig => 
        sig === order.contractorId
      );
      
      // Если акт был отклонён, но его подписывает платформа, или если есть обе подписи, устанавливаем статус COMPLETED
      if ((act.status === ActStatus.REJECTED && isPlatformUser) || (hasCustomerSignature && hasContractorSignature)) {
        newStatus = ActStatus.COMPLETED;
        
        // Mark milestone as completed
        // Если веха была ранее отклонена, вернем ей статус COMPLETED
        await getDb()
          .update(schema.milestones)
          .set({ 
            status: MilestoneStatus.COMPLETED,
            updatedAt: new Date()
          })
          .where(eq(schema.milestones.id, act.milestoneId));
          
        // Transfer funds from order to contractor
        try {
          // Get the milestone to determine the amount to pay
          const milestone = await getDb().query.milestones.findFirst({
            where: eq(schema.milestones.id, act.milestoneId)
          });
          
          if (milestone && order.contractorId) {
            const amountToTransfer = parseFloat(milestone.amount);
            
            // Update contractor balance - проверяем доступ к escrowManager
            // Сначала пробуем прямой доступ, затем через orderService как резерв
            if (this.escrowManager) {
              console.log(`Transferring ${amountToTransfer} to contractor ${order.contractorId} via direct escrowManager`);
              await this.escrowManager.updateUserBalance(
                order.contractorId,
                amountToTransfer.toString()
              );
              
              // Decrease order funded amount
              await this.escrowManager.updateOrderFundedAmount(
                order.id,
                amountToTransfer,
                true // isDebit=true means subtract from funded amount
              );
            } else if (this.orderService && this.orderService.escrowManager) {
              console.log(`Transferring ${amountToTransfer} to contractor ${order.contractorId} via orderService.escrowManager`);
              await this.orderService.escrowManager.updateUserBalance(
                order.contractorId,
                amountToTransfer.toString()
              );
              
              // Decrease order funded amount
              await this.orderService.escrowManager.updateOrderFundedAmount(
                order.id,
                amountToTransfer,
                true // isDebit=true means subtract from funded amount
              );
            } else {
              console.error('No escrowManager available to transfer funds');
            }
          }
        } catch (error) {
          console.error('Error transferring funds to contractor:', error);
          // We don't throw here to avoid rollback of the act signing
          // but log the error for investigation
        }
      }
      
      // Update act using either id or documentId for compatibility
      await getDb()
        .update(schema.acts)
        .set({ 
          signedBy: updatedSignedBy,
          status: newStatus,
          updatedAt: new Date()
        })
        .where(or(
          eq(schema.acts.id, actId),
          eq(schema.acts.documentId, actId)
        ));
      
      // Convert array of strings to array of objects with userId and signedAt
      const signedByObjects = updatedSignedBy.map((userId: string) => ({
        userId,
        signedAt: new Date()
      }));
      
      const updatedAct = {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: act.milestoneId,
        deliverableIds: act.deliverableIds,
        status: newStatus,
        signedBy: signedByObjects,
        rejectionReason: act.rejectionReason
      } as IAct;
      
      // If act was completed, check if all milestones are now completed
      // and update the order status if needed
      if (newStatus === ActStatus.COMPLETED) {
        // Have to do this outside transaction since it uses new database queries
        setTimeout(async () => {
          try {
            // Update order status based on milestone completion
            await this.orderService.updateOrderStatusBasedOnMilestones(document.orderId);
          } catch (error) {
            console.error('Error updating order status:', error);
          }
        }, 0);
      }
      
    // Return updated act
    return updatedAct;
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
    
    // Non-transaction operations (Neon HTTP driver doesn't support transactions)
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
      
    // Update act using either id or documentId for backward compatibility
    await getDb().update(schema.acts)
      .set({ 
        status: ActStatus.REJECTED,
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(or(
        eq(schema.acts.id, actId),
        eq(schema.acts.documentId, actId)
      ));
      
    // Update milestone status
    await getDb().update(schema.milestones)
      .set({ 
        status: MilestoneStatus.REJECTED,
        updatedAt: new Date()
      })
      .where(eq(schema.milestones.id, actData.milestoneId));
      
      // Convert signedBy from string[] to {userId, signedAt}[] format
      const signedByObjects = (actData.signedBy || []).map((userId: string) => ({
        userId,
        signedAt: new Date()
      }));
      
      // Return updated act
      return  {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: actData.milestoneId,
        deliverableIds: actData.deliverableIds,
        status: ActStatus.REJECTED,
        signedBy: signedByObjects,
        rejectionReason: reason
      } as IAct;
  }
}
