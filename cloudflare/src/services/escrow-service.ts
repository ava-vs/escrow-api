/**
 * Escrow service for managing escrow operations in Cloudflare Workers
 * Combines functionality from the original EscrowManager adapted for serverless environment
 */

import { UserService } from './user-service';
import { OrderService } from './order-service';
import { DocumentService } from './document-service';
import { ChatService } from './chat-service';
import type { Env } from '../index';
import * as schema from '../db/schema';

export interface EscrowEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  orderId?: string;
}

export class EscrowService {
  private userService: UserService;
  private orderService: OrderService;
  private documentService: DocumentService;
  private chatService: ChatService;

  constructor(private env: Env) {
    this.userService = new UserService(env);
    this.orderService = new OrderService(env);
    this.documentService = new DocumentService(env);
    this.chatService = new ChatService(env);
  }

  // User Management
  async createUser(userData: {
    name: string;
    email: string;
    type: 'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM';
  }): Promise<schema.User> {
    const user = await this.userService.createUser(userData);

    await this.emitEvent({
      type: 'USER_CREATED',
      data: user,
      timestamp: new Date(),
      userId: user.id
    });

    return user;
  }

  async updateUserBalance(userId: string, amount: number): Promise<schema.User> {
    const user = await this.userService.updateUserBalance(userId, amount);

    await this.emitEvent({
      type: 'USER_BALANCE_UPDATED',
      data: { userId, amount, newBalance: user.balance },
      timestamp: new Date(),
      userId
    });

    return user;
  }

  // Order Management
  async createOrder(
    customerId: string,
    orderData: {
      title: string;
      description: string;
      isGroupOrder?: boolean;
      milestones: Array<{
        description: string;
        amount: number;
        deadline: Date | string;
      }>;
    }
  ): Promise<schema.Order> {
    const order = await this.orderService.createOrder(customerId, orderData);

    // Create chat for the order
    await this.chatService.createOrderChat(order.id);

    await this.emitEvent({
      type: 'ORDER_CREATED',
      data: order,
      timestamp: new Date(),
      userId: customerId,
      orderId: order.id
    });

    return order;
  }

  async assignContractor(orderId: string, contractorId: string): Promise<schema.Order> {
    const order = await this.orderService.assignContractor(orderId, contractorId);

    // Add contractor to chat
    await this.chatService.addParticipant(orderId, contractorId, 'CONTRACTOR');

    await this.emitEvent({
      type: 'CONTRACTOR_ASSIGNED',
      data: { orderId, contractorId },
      timestamp: new Date(),
      userId: contractorId,
      orderId
    });

    return order;
  }

  async fundOrder(orderId: string, customerId: string, amount: number): Promise<void> {
    // Check customer balance
    const customer = await this.userService.getUserById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from customer balance
    await this.userService.updateUserBalance(customerId, -amount);

    // Update order funded amount
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const newFundedAmount = order.fundedAmount + amount;

    // Update order status if fully funded
    let newStatus = order.status;
    if (newFundedAmount >= order.totalAmount) {
      newStatus = 'FUNDED';
    }

    await this.orderService.updateOrderStatus(orderId, newStatus);

    await this.emitEvent({
      type: 'FUNDS_CONTRIBUTED',
      data: { orderId, customerId, amount, newFundedAmount },
      timestamp: new Date(),
      userId: customerId,
      orderId
    });
  }

  // Document Management
  async createDocument(
    orderId: string,
    createdBy: string,
    documentData: {
      type: 'CONTRACT' | 'ROADMAP' | 'SPECIFICATION' | 'DELIVERY' | 'OTHER';
      name: string;
      content: any;
    }
  ): Promise<schema.Document> {
    const document = await this.documentService.createDocument(orderId, createdBy, documentData);

    await this.emitEvent({
      type: 'DOCUMENT_CREATED',
      data: document,
      timestamp: new Date(),
      userId: createdBy,
      orderId
    });

    return document;
  }

  async approveDocument(documentId: string, userId: string): Promise<schema.Document> {
    const document = await this.documentService.approveDocument(documentId, userId);

    await this.emitEvent({
      type: 'DOCUMENT_APPROVED',
      data: { documentId, userId },
      timestamp: new Date(),
      userId,
      orderId: document.orderId
    });

    return document;
  }

  async createAct(
    documentId: string,
    createdBy: string,
    actData: {
      type: 'APPROVAL' | 'SIGNATURE' | 'COMPLETION' | 'REJECTION';
      description: string;
      signatories: string[];
    }
  ): Promise<schema.Act> {
    const act = await this.documentService.createAct(documentId, createdBy, actData);

    await this.emitEvent({
      type: 'ACT_CREATED',
      data: act,
      timestamp: new Date(),
      userId: createdBy
    });

    return act;
  }

  async signAct(actId: string, userId: string, signature: any = {}): Promise<schema.Act> {
    const act = await this.documentService.signAct(actId, userId, signature);

    const eventType = act.status === 'COMPLETED' ? 'ACT_COMPLETED' : 'ACT_SIGNED';

    await this.emitEvent({
      type: eventType,
      data: { actId, userId, signature },
      timestamp: new Date(),
      userId
    });

    return act;
  }

  // Milestone Management
  async completeMilestone(milestoneId: string, contractorId: string): Promise<void> {
    const milestone = await this.orderService.updateMilestoneStatus(milestoneId, 'COMPLETED');

    // Release milestone payment to contractor
    await this.userService.updateUserBalance(contractorId, milestone.amount);

    await this.emitEvent({
      type: 'MILESTONE_COMPLETED',
      data: { milestoneId, contractorId, amount: milestone.amount },
      timestamp: new Date(),
      userId: contractorId,
      orderId: milestone.orderId
    });
  }

  // Utility Methods
  async getOrderWithDetails(orderId: string): Promise<{
    order: schema.Order;
    milestones: schema.Milestone[];
    documents: schema.Document[];
  }> {
    const [order, milestones, documents] = await Promise.all([
      this.orderService.getOrderById(orderId),
      this.orderService.getMilestonesByOrderId(orderId),
      this.documentService.getDocumentsByOrderId(orderId)
    ]);

    if (!order) {
      throw new Error('Order not found');
    }

    return { order, milestones, documents };
  }

  async getUserDashboard(userId: string): Promise<{
    user: schema.User;
    orders: schema.Order[];
    pendingActs: schema.Act[];
  }> {
    const [user, orders, pendingActs] = await Promise.all([
      this.userService.getUserById(userId),
      this.orderService.getOrdersForUser(userId),
      this.documentService.getPendingActsForUser(userId)
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    return { user, orders, pendingActs };
  }

  // Event System (using Durable Objects for persistence)
  private async emitEvent(event: EscrowEvent): Promise<void> {
    try {
      // Get EscrowManager Durable Object
      const escrowManagerId = this.env.ESCROW_MANAGER_DO.idFromName('global');
      const escrowManager = this.env.ESCROW_MANAGER_DO.get(escrowManagerId);

      // Send event to Durable Object
      await escrowManager.fetch(new Request('https://escrow-manager/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }));
    } catch (error) {
      console.error('Failed to emit event:', error);
      // Don't throw - events are not critical for operation
    }
  }

  // Service Getters (for direct access when needed)
  getUserService(): UserService {
    return this.userService;
  }

  getOrderService(): OrderService {
    return this.orderService;
  }

  getDocumentService(): DocumentService {
    return this.documentService;
  }

  getChatService(): ChatService {
    return this.chatService;
  }
}