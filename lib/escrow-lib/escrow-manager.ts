/**
 * Main Escrow Manager class that combines all services
 * and provides a unified interface for the escrow system
 */

import { EventEmitter } from 'events';
import { UserService } from './services/user-service';
import { OrderService, IMilestoneInputData } from './services/order-service';
import { DocumentService } from './services/document-service';
import { InterestService } from './services/interest-service';
import { getDb } from '../db';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import {
  IUser,
  IOrder,
  IMilestone,
  IDocument,
  IAct,
  UserType,
  DocumentType,
  ActStatus
} from './interfaces';

// Define events that can be emitted by the Escrow Manager
export enum EscrowEvents {
  // User events
  USER_CREATED = 'user.created',
  USER_BALANCE_UPDATED = 'user.balance_updated',
  
  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_INTEREST_TOGGLED = 'order.interest_toggled',
  GROUP_ORDER_CREATED = 'order.group_created',
  ORDER_UPDATED = 'order.updated',
  CONTRACTOR_ASSIGNED = 'order.contractor_assigned',
  FUNDS_CONTRIBUTED = 'order.funds_contributed',
  REPRESENTATIVE_VOTE = 'order.representative_vote',
  REPRESENTATIVE_CHANGED = 'order.representative_changed',
  
  // Document events
  DOCUMENT_CREATED = 'document.created',
  DOCUMENT_APPROVED = 'document.approved',
  
  // Act events
  ACT_CREATED = 'act.created',
  ACT_SIGNED = 'act.signed',
  ACT_COMPLETED = 'act.completed',
  ACT_REJECTED = 'act.rejected',
  
  // Milestone events
  MILESTONE_STATUS_CHANGED = 'milestone.status_changed'
}

import { IEscrowManager } from './interfaces/escrow-manager.interface';

export class EscrowManager extends EventEmitter implements IEscrowManager {
  private userService: UserService;
  private orderService: OrderService;
  private documentService: DocumentService;
  private interestService: InterestService;
  
  constructor() {
    super();
    this.setMaxListeners(20);
    
    // Initialize services with proper dependency injection
    this.userService = new UserService();
    this.orderService = new OrderService();
    this.documentService = new DocumentService(this.orderService);
    this.interestService = new InterestService();
    
    // Set circular dependencies - используем приведение типа для безопасного присваивания
    (this.orderService as any).documentService = this.documentService;
    this.documentService.setOrderService(this.orderService);
    
    // Add direct reference to EscrowManager in DocumentService for balance operations
    this.documentService.setEscrowManager(this);
    // Also ensure OrderService has access to EscrowManager
    (this.orderService as any).escrowManager = this;
  }
  
  // ======== User Methods ========
  
  /**
   * Create a new user in the system
   * @param name User name
   * @param email User email
   * @param type User type (CUSTOMER, CONTRACTOR, PLATFORM)
   * @param initialBalance Optional initial balance
   * @returns Created user
   */
  async createUser(
    name: string,
    email: string,
    type: UserType,
    initialBalance = '0'
  ): Promise<IUser> {
    try {
      const user = await this.userService.createUser(name, email, type, initialBalance);
      this.emit(EscrowEvents.USER_CREATED, user);
      return user;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get user by ID
   * @param userId User ID
   * @returns User or null if not found
   */
  async getUser(userId: string): Promise<IUser | null> {
    return this.userService.getUserById(userId);
  }
  
  /**
   * Get user by email
   * @param email User email
   * @returns User or null if not found
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    return this.userService.getUserByEmail(email);
  }
  
  /**
   * Get all users in the system
   * @returns Array of all users
   */
  async getAllUsers(): Promise<IUser[]> {
    return this.userService.getAllUsers();
  }
  
  /**
   * Update user balance
   * @param userId User ID
   * @param amount Amount to add (positive) or subtract (negative)
   * @returns Updated user
   */
  async updateUserBalance(userId: string, amount: string): Promise<IUser> {
    try {
      const user = await this.userService.updateUserBalance(userId, amount);
      this.emit(EscrowEvents.USER_BALANCE_UPDATED, { userId, amount, newBalance: user.balance });
      return user;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Update user profile information
   * @param userId User ID
   * @param updateData Object containing fields to update (name, email, bio, preferences)
   * @returns Updated user
   */
  async updateUser(userId: string, updateData: Partial<IUser> & { bio?: string, preferences?: any }): Promise<IUser> {
    try {
      // Validate that user exists
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      // Use userService to update the profile
      const updatedUser = await this.userService.updateUserProfile(userId, updateData);
      
      // Could emit an event if needed
      // this.emit(EscrowEvents.USER_UPDATED, { userId, updatedFields: Object.keys(updateData) });
      
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }
  
  // ======== Order Methods ========
  
  /**
   * Create a new order
   * @param customerId Customer ID
   * @param title Order title
   * @param description Order description
   * @param milestones Array of milestone data
   * @returns Created order
   */
  async createOrder(
    customerId: string,
    title: string,
    description: string,
    milestones: IMilestoneInputData[]
  ): Promise<IOrder> {
    try {
      // Validate customer
      const isCustomer = await this.userService.isCustomer(customerId);
      if (!isCustomer) {
        throw new Error(`User ${customerId} is not a Customer`);
      }
      
      const order = await this.orderService.createOrder(
        customerId,
        title,
        description,
        milestones
      );
      
      this.emit(EscrowEvents.ORDER_CREATED, order);
      return order;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Create a new group order
   * @param customerIds Array of customer IDs
   * @param title Order title
   * @param description Order description
   * @param milestones Array of milestone data
   * @param initialRepresentativeId Optional ID of initial representative
   * @returns Created group order
   */
  async createGroupOrder(
    customerIds: string[],
    title: string,
    description: string,
    milestones: IMilestoneInputData[],
    initialRepresentativeId?: string
  ): Promise<IOrder> {
    try {
      // Validate all customers
      for (const customerId of customerIds) {
        const isCustomer = await this.userService.isCustomer(customerId);
        if (!isCustomer) {
          throw new Error(`User ${customerId} is not a Customer`);
        }
      }
      
      const order = await this.orderService.createGroupOrder(
        customerIds,
        title,
        description,
        milestones,
        initialRepresentativeId
      );
      
      this.emit(EscrowEvents.GROUP_ORDER_CREATED, order);
      return order;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get order by ID
   * @param orderId Order ID
   * @returns Order or throws error if not found
   */
  async getOrder(orderId: string): Promise<IOrder> {
    return this.orderService.getOrder(orderId);
  }
  
  /**
   * Get all orders
   * @returns Array of all orders
   */
  async getAllOrders(): Promise<IOrder[]> {
    return this.orderService.getAllOrders();
  }
  
  /**
   * Get orders by customer
   * @param customerId Customer ID
   * @returns Array of orders for the customer
   */
  async getOrdersByCustomer(customerId: string): Promise<IOrder[]> {
    return this.orderService.getOrdersByCustomer(customerId);
  }
  
  /**
   * Assign contractor to order
   * @param orderId Order ID
   * @param contractorId Contractor ID
   * @param assignerUserId ID of user assigning the contractor
   * @returns Updated order
   */
  async assignContractor(
    orderId: string,
    contractorId: string,
    assignerUserId: string
  ): Promise<IOrder> {
    try {
      // Validate contractor is really a contractor
      const isContractor = await this.userService.isContractor(contractorId);
      if (!isContractor) {
        throw new Error(`User ${contractorId} is not a Contractor`);
      }
      
      const order = await this.orderService.assignContractor(
        orderId,
        contractorId,
        assignerUserId
      );
      
      this.emit(EscrowEvents.CONTRACTOR_ASSIGNED, { 
        orderId, 
        contractorId, 
        assignerUserId 
      });
      
      return order;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Contribute funds to an order
   * @param orderId Order ID
   * @param contributingUserId User ID contributing funds
   * @param amount Amount to contribute
   * @returns Updated order
   */
  async contributeFunds(
    orderId: string,
    contributingUserId: string,
    amount: string
  ): Promise<IOrder> {
    try {
      // Deduct from user balance first
      // Convert to negative string amount
      const negativeAmount = `-${amount}`;  
      await this.updateUserBalance(contributingUserId, negativeAmount);
      
      try {
        // Then update order funded amount
        // Convert string amount to the expected type for the contributeFunds method
        const order = await this.orderService.contributeFunds(
          orderId,
          contributingUserId,
          amount // Amount should already be a string based on updated interfaces
        );
        
        this.emit(EscrowEvents.FUNDS_CONTRIBUTED, { 
          orderId, 
          contributingUserId, 
          amount 
        });
        
        return order;
      } catch (error) {
        // If order update fails, revert user balance deduction
        await this.updateUserBalance(contributingUserId, amount);  // Возвращаем средства обратно (положительная сумма)
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Update order funded amount
   * @param orderId Order ID
   * @param amount Amount to change funded amount by
   * @param isDebit If true, amount will be subtracted from funded amount (e.g. payment to contractor). 
   *                If false (default), amount will be added to funded amount (e.g. customer contribution)
   * @returns Updated order
   */
  async updateOrderFundedAmount(orderId: string, amount: number, isDebit: boolean = false): Promise<IOrder> {
    return this.orderService.updateOrderFundedAmount(orderId, amount, isDebit);
  }
  
  /**
   * Vote for a representative in a group order
   * @param orderId Order ID
   * @param voterId ID of voting customer
   * @param candidateId ID of candidate customer
   * @returns Current representative ID
   */
  async voteForRepresentative(
    orderId: string,
    voterId: string,
    candidateId: string
  ): Promise<void> {
    try {
      const originalOrder = await this.getOrder(orderId);
      const originalRepId = originalOrder.representativeId;
      
      const updatedOrder = await this.orderService.voteForRepresentative(
        orderId,
        voterId,
        candidateId
      );
      
      this.emit(EscrowEvents.REPRESENTATIVE_VOTE, { 
        orderId, 
        voterId, 
        candidateId 
      });
      
      // If representative changed, emit additional event
      if (originalRepId !== updatedOrder.representativeId) {
        this.emit(EscrowEvents.REPRESENTATIVE_CHANGED, { 
          orderId, 
          previousRepresentativeId: originalRepId,
          newRepresentativeId: updatedOrder.representativeId
        });
      }
    } catch (error) {
      throw error;
    }
  }
  
  // ======== Document Methods ========
  
  /**
   * Create a document
   * @param orderId Order ID
   * @param type Document type
   * @param name Document name
   * @param createdBy User ID of creator
   * @param content Document content
   * @returns Created document
   */
  async createDocument(
    orderId: string,
    type: DocumentType,
    name: string,
    createdBy: string,
    content: any
  ): Promise<IDocument> {
    try {
      const document = await this.documentService.createDocument(
        orderId,
        type,
        name,
        createdBy,
        content
      );
      
      this.emit(EscrowEvents.DOCUMENT_CREATED, document);
      return document;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get document by ID
   * @param documentId Document ID
   * @returns Document or null if not found
   */
  async getDocument(documentId: string): Promise<IDocument | null> {
    return this.documentService.getDocumentById(documentId);
  }
  
  /**
   * Get all documents for an order
   * @param orderId Order ID
   * @returns Array of documents
   */
  async getDocumentsByOrder(orderId: string): Promise<IDocument[]> {
    return this.documentService.getDocumentsByOrder(orderId);
  }
  
  /**
   * Approve a document
   * @param documentId Document ID
   * @param approverId User ID of approver
   * @returns Updated document
   */
  async approveDocument(
    documentId: string,
    approverId: string
  ): Promise<IDocument> {
    try {
      const document = await this.documentService.approveDocument(
        documentId,
        approverId
      );
      
      this.emit(EscrowEvents.DOCUMENT_APPROVED, { 
        documentId, 
        approverId 
      });
      
      return document;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Create an act of work
   * @param orderId Order ID
   * @param milestoneId Milestone ID
   * @param deliverableIds Array of deliverable document IDs
   * @param createdBy User ID of creator
   * @param name Act name
   * @returns Created act
   */
  async createAct(
    orderId: string,
    milestoneId: string,
    deliverableIds: string[],
    createdBy: string,
    name: string
  ): Promise<IAct> {
    try {
      const act = await this.documentService.createAct(
        orderId,
        milestoneId,
        deliverableIds,
        createdBy,
        name
      );
      
      this.emit(EscrowEvents.ACT_CREATED, act);
      this.emit(EscrowEvents.MILESTONE_STATUS_CHANGED, { 
        milestoneId, 
        status: 'AWAITING_ACCEPTANCE' 
      });
      
      return act;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Sign an act
   * @param actId Act ID
   * @param userId User ID signing the act
   * @returns Updated act
   */
  async signAct(actId: string, userId: string): Promise<IAct> {
    try {
      const act = await this.documentService.signAct(actId, userId);
      
      this.emit(EscrowEvents.ACT_SIGNED, { 
        actId, 
        userId, 
        status: act.status 
      });
      
      if (act.status === ActStatus.COMPLETED) {
        this.emit(EscrowEvents.ACT_COMPLETED, act);
        this.emit(EscrowEvents.MILESTONE_STATUS_CHANGED, { 
          milestoneId: act.milestoneId, 
          status: 'COMPLETED' 
        });
      }
      
      return act;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Reject an act
   * @param actId Act ID
   * @param userId User ID rejecting the act
   * @param reason Rejection reason
   * @returns Updated act
   */
  async rejectAct(
    actId: string,
    userId: string,
    reason: string
  ): Promise<IAct> {
    try {
      const act = await this.documentService.rejectAct(actId, userId, reason);
      
      this.emit(EscrowEvents.ACT_REJECTED, { 
        actId, 
        userId, 
        reason 
      });
      
      this.emit(EscrowEvents.MILESTONE_STATUS_CHANGED, { 
        milestoneId: act.milestoneId, 
        status: 'REJECTED' 
      });
      
      return act;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an act by ID
   * @param actId Act ID
   * @returns Act document or null if not found
   */
  async getAct(actId: string): Promise<IAct | null> {
    try {
      // First get the document to check if it's an act
      const document = await this.documentService.getDocumentById(actId);
      
      if (!document || document.type !== DocumentType.ACT_OF_WORK) {
        return null; // Not found or not an act
      }
      
      // Then get the act data using the same ID
      const actData = await getDb().query.acts.findFirst({
        where: eq(schema.acts.id, actId)
      });
      
      if (!actData) {
        return null; // Act data not found
      }
      
      // Convert array of user IDs to array of objects with userId and signedAt
      const signedByObjects = (actData.signedBy || []).map((userId: string) => ({
        userId,
        signedAt: new Date() // Using current date as fallback
      }));
      
      // Construct and return the combined act object
      return {
        ...document,
        type: DocumentType.ACT_OF_WORK,
        milestoneId: actData.milestoneId,
        deliverableIds: actData.deliverableIds || [],
        status: actData.status as ActStatus,
        signedBy: signedByObjects,
        rejectionReason: actData.rejectionReason || undefined
      };
    } catch (error) {
      console.error('Error getting act:', error);
      throw error;
    }
  }

  /**
   * Get all votes for a specific order
   * @param orderId Order ID
   * @returns Array of vote objects containing voter, candidate and creation date
   */
  async getVotesForOrder(orderId: string): Promise<Array<{
    voterId: string;
    candidateId: string;
    createdAt: Date;
  }>> {
    return this.orderService.getVotesForOrder(orderId);
  }
  
  /**
   * Check if a user is interested in an order
   * @param userId User ID
   * @param orderId Order ID
   * @returns Boolean indicating if user has expressed interest
   */
  async checkInterest(userId: string, orderId: string): Promise<boolean> {
    return this.interestService.checkInterest(userId, orderId);
  }
  
  /**
   * Toggle user's interest in an order (add or remove interest)
   * @param userId User ID
   * @param orderId Order ID
   * @returns Object with action performed (added/removed)
   */
  async toggleInterest(userId: string, orderId: string): Promise<{ action: 'added' | 'removed' }> {
    // Verify that user and order exist
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const order = await this.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Toggle interest
    const result = await this.interestService.toggleInterest(userId, orderId);
    
    // Emit event
    super.emit(EscrowEvents.ORDER_INTEREST_TOGGLED, {
      userId,
      orderId,
      action: result.action
    });
    
    return result;
  }
  
  /**
   * Get all orders that a user is interested in
   * @param userId User ID
   * @returns Array of orders
   */
  async getInterestedOrders(userId: string): Promise<IOrder[]> {
    const orderIds = await this.interestService.getUserInterests(userId);
    
    // Get full order details for each ID
    const orders: IOrder[] = [];
    for (const orderId of orderIds) {
      try {
        const order = await this.getOrder(orderId);
        orders.push(order);
      } catch (error) {
        console.error(`Error getting order ${orderId}:`, error);
        // Continue with other orders even if one fails
      }
    }
    
    return orders;
  }
  
  /**
   * Get all users interested in a specific order
   * @param orderId Order ID
   * @returns Array of users
   */
  async getInterestedUsers(orderId: string): Promise<IUser[]> {
    const userIds = await this.interestService.getOrderInterestedUsers(orderId);
    
    // Get full user details for each ID
    const users: IUser[] = [];
    for (const userId of userIds) {
      try {
        const user = await this.getUser(userId);
        if (user) {
          users.push(user);
        }
      } catch (error) {
        console.error(`Error getting user ${userId}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    return users;
  }
}
