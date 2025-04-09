/**
 * Order service for managing orders and milestones in the escrow system
 * Handles creation, updates, and retrieval of orders
 */

import { db } from '../../db';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../schema';
import { IOrder, IMilestone, OrderStatus, MilestoneStatus } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

// Interface for milestone input data
export interface IMilestoneInputData {
  description: string;
  amount: string; // Using string for money values to match DB schema
  deadline: Date | string;
  // roadmapPhaseId?: string; // Field doesn't exist in the database
}

export class OrderService {
  /**
   * Helper method to get customer IDs for an order from the junction table
   * @param orderId Order ID
   * @returns Array of customer IDs
   */
  private async getCustomerIdsForOrder(orderId: string): Promise<string[]> {
    const customerOrders = await db.query.customerOrders.findMany({
      where: eq(schema.customerOrders.orderId, orderId)
    });
    
    return customerOrders.map(co => co.customerId);
  }

  /**
   * Create a new order with specified customer, title, description, and milestones
   * @param customerId ID of the customer creating the order
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
    // Validate input
    if (!customerId) throw new Error('Customer ID is required');
    if (!title) throw new Error('Order title is required');
    if (!description) throw new Error('Order description is required');
    if (!milestones || milestones.length === 0) {
      throw new Error('At least one milestone is required');
    }
    
    // Create order ID
    const orderId = uuidv4();
    
    // Calculate total amount
    // Calculate total amount as string for DB compatibility
    const totalAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0).toString();
    
    // Convert milestone dates
    const sanitizedMilestones = milestones.map(m => ({
      ...m,
      deadline: m.deadline instanceof Date ? m.deadline : new Date(m.deadline)
    }));
    
    // Create new order without customerIds field since we're using junction table
    const newOrder = {
      id: orderId,
      isGroupOrder: false,
      title,
      description,
      status: OrderStatus.CREATED,
      totalAmount,
      fundedAmount: '0', // Using string for money values
      createdAt: new Date(),
      updatedAt: new Date()
      // votes field removed as it doesn't exist in the DB schema
    };
    
    // Insert order and related data
    try {
      // Insert order first
      await db.insert(schema.orders).values(newOrder);
      
      // Insert record into customer_orders junction table
      await db.insert(schema.customerOrders).values({
        customerId: customerId,
        orderId: orderId
      });
      
      // Insert milestones
      for (const milestone of sanitizedMilestones) {
        await db.insert(schema.milestones).values({
          id: uuidv4(),
          orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: MilestoneStatus.PENDING,
          // roadmapPhaseId: milestone.roadmapPhaseId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
    
    // Return complete order with milestones
    return this.getOrder(orderId);
  }
  
  /**
   * Create a new group order with multiple customers
   * @param customerIds Array of customer IDs participating in the order
   * @param title Order title
   * @param description Order description
   * @param milestones Array of milestone data
   * @param initialRepresentativeId ID of initial customer representative
   * @returns Created group order
   */
  async createGroupOrder(
    customerIds: string[],
    title: string,
    description: string,
    milestones: IMilestoneInputData[],
    initialRepresentativeId?: string
  ): Promise<IOrder> {
    // Validate input
    if (!customerIds || customerIds.length < 2) {
      throw new Error('Group order requires at least 2 customers');
    }
    if (!title) throw new Error('Order title is required');
    if (!description) throw new Error('Order description is required');
    if (!milestones || milestones.length === 0) {
      throw new Error('At least one milestone is required');
    }
    
    // Validate representative
    if (initialRepresentativeId && !customerIds.includes(initialRepresentativeId)) {
      throw new Error('Representative must be one of the customers');
    }
    
    // Default representative to first customer if not specified
    const representativeId = initialRepresentativeId || customerIds[0];
    
    // Create order ID
    const orderId = uuidv4();
    
    // Calculate total amount
    // Calculate total amount as string for DB compatibility
    const totalAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0).toString();
    
    // Convert milestone dates
    const sanitizedMilestones = milestones.map(m => ({
      ...m,
      deadline: m.deadline instanceof Date ? m.deadline : new Date(m.deadline)
    }));
    
    // Create new order (without customerIds field)
    const newOrder = {
      id: orderId,
      isGroupOrder: true,
      representativeId,
      title,
      description,
      status: OrderStatus.CREATED,
      totalAmount,
      fundedAmount: '0', // Using string for money values
      createdAt: new Date(),
      updatedAt: new Date()
      // votes field removed
    };
    
    try {
      // Insert order first
      await db.insert(schema.orders).values(newOrder);
      
      // Insert records into customer_orders junction table for each customer
      for (const customerId of customerIds) {
        await db.insert(schema.customerOrders).values({
          customerId,
          orderId
        });
      }
      
      // Insert milestones
      for (const milestone of sanitizedMilestones) {
        await db.insert(schema.milestones).values({
          id: uuidv4(),
          orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: MilestoneStatus.PENDING,
          // roadmapPhaseId: milestone.roadmapPhaseId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error creating group order:', error);
      throw error;
    }
    
    // Return complete order with milestones
    return this.getOrder(orderId);
  }
  
  /**
   * Get order by ID with all milestones
   * @param orderId Order ID
   * @returns Order with milestones or null if not found
   */
  async getOrder(orderId: string): Promise<IOrder> {
    if (!orderId) throw new Error('Order ID is required');
    
    // Get order
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId)
    });
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    // Get customer IDs from junction table
    const customerIds = await this.getCustomerIdsForOrder(orderId);
    
    // Get milestones for order
    const milestones = await db.query.milestones.findMany({
      where: eq(schema.milestones.orderId, orderId)
    });
    
    // Convert milestone status string literals to MilestoneStatus enum
    const mappedMilestones = milestones.map(milestone => ({
      ...milestone,
      status: milestone.status as unknown as MilestoneStatus // Explicit type conversion
    }));
    
    // Return combined order with milestones
    return {
      ...order,
      customerIds, // Add customerIds from junction table
      milestones: mappedMilestones
    } as IOrder;
  }
  
  /**
   * Get all orders with their milestones
   * @returns Array of all orders with milestones
   */
  async getAllOrders(): Promise<IOrder[]> {
    // Get all orders
    const orders = await db.query.orders.findMany();
    
    // Get all customer_orders records to build the relationships
    const customerOrders = await db.query.customerOrders.findMany();
    
    // Group customer IDs by order ID
    const customerIdsByOrderId = customerOrders.reduce((acc, co) => {
      if (!acc[co.orderId]) {
        acc[co.orderId] = [];
      }
      acc[co.orderId].push(co.customerId);
      return acc;
    }, {} as Record<string, string[]>);
    
    // Get all milestones
    const allMilestones = await db.query.milestones.findMany();
    
    // Group milestones by order ID and convert types
    const milestonesByOrderId = allMilestones.reduce((acc, milestone) => {
      const orderId = milestone.orderId;
      if (!acc[orderId]) {
        acc[orderId] = [];
      }
      
      // Convert milestone to IMilestone with proper type conversion
      const convertedMilestone = {
        id: milestone.id,
        orderId: milestone.orderId,
        description: milestone.description,
        amount: milestone.amount, 
        deadline: milestone.deadline,
        status: milestone.status as unknown as MilestoneStatus // Explicit type conversion
        // paid: milestone.paid
      };
      
      acc[orderId].push(convertedMilestone);
      return acc;
    }, {} as Record<string, IMilestone[]>);
    
    // Combine orders with their milestones and convert milestone statuses
    return orders.map(order => {
      const orderMilestones = milestonesByOrderId[order.id] || [];
      const orderCustomerIds = customerIdsByOrderId[order.id] || [];
      
      // Convert milestone status string literals to MilestoneStatus enum
      const mappedMilestones = orderMilestones.map(milestone => {
        return {
          id: milestone.id,
          orderId: milestone.orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: milestone.status as unknown as MilestoneStatus // Explicit type conversion
        };
      });
      
      return {
        ...order,
        customerIds: orderCustomerIds, // Add customerIds from junction table
        milestones: mappedMilestones
      };
    }) as IOrder[];
  }
  
  /**
   * Get orders by customer ID
   * @param customerId Customer ID
   * @returns Array of orders for the customer
   */
  async getOrdersByCustomer(customerId: string): Promise<IOrder[]> {
    if (!customerId) throw new Error('Customer ID is required');
    
    // Get order IDs for this customer from junction table
    const customerOrders = await db.query.customerOrders.findMany({
      where: eq(schema.customerOrders.customerId, customerId)
    });
    
    const orderIds = customerOrders.map(co => co.orderId);
    
    if (orderIds.length === 0) {
      return []; // No orders for this customer
    }
    
    // Get all orders for these IDs
    const orders = await db.query.orders.findMany({
      where: inArray(schema.orders.id, orderIds)
    });
    
    // Get all customer_orders to build full relationships
    const allCustomerOrders = await db.query.customerOrders.findMany({
      where: inArray(schema.customerOrders.orderId, orderIds)
    });
    
    // Group customer IDs by order ID
    const customerIdsByOrderId = allCustomerOrders.reduce((acc, co) => {
      if (!acc[co.orderId]) {
        acc[co.orderId] = [];
      }
      acc[co.orderId].push(co.customerId);
      return acc;
    }, {} as Record<string, string[]>);
    
    // Get all milestones for these orders
    const milestones = await db.query.milestones.findMany({
      where: inArray(schema.milestones.orderId, orderIds)
    });
    
    // Group milestones by order ID and convert types
    const milestonesByOrderId = milestones.reduce((acc, milestone) => {
      const orderId = milestone.orderId;
      if (!acc[orderId]) {
        acc[orderId] = [];
      }
      
      // Convert milestone to IMilestone with proper type conversion
      const convertedMilestone = {
        id: milestone.id,
        orderId: milestone.orderId,
        description: milestone.description,
        amount: milestone.amount, 
        deadline: milestone.deadline,
        status: milestone.status as unknown as MilestoneStatus // Explicit type conversion
        // paid: milestone.paid
      };
      
      acc[orderId].push(convertedMilestone);
      return acc;
    }, {} as Record<string, IMilestone[]>);
    
    // Combine orders with their milestones
    return orders.map(order => {
      const orderMilestones = milestonesByOrderId[order.id] || [];
      const orderCustomerIds = customerIdsByOrderId[order.id] || [];
      
      // Convert milestone status string literals to MilestoneStatus enum
      const mappedMilestones = orderMilestones.map(milestone => {
        return {
          id: milestone.id,
          orderId: milestone.orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: milestone.status as unknown as MilestoneStatus // Explicit type conversion
          // paid: milestone.paid
        };
      });
      
      return {
        ...order,
        customerIds: orderCustomerIds, // Add customerIds from junction table
        milestones: mappedMilestones
      };
    }) as IOrder[];
  }
  
  /**
   * Assign a contractor to an order
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
    const order = await this.getOrder(orderId);
    
    // Validate order status
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.FUNDED) {
      throw new Error(`Cannot assign contractor to order with status ${order.status}`);
    }
    
    // Check if already has contractor
    if (order.contractorId) {
      throw new Error('Order already has a contractor assigned');
    }
    
    // Update order with contractor
    await db
      .update(schema.orders)
      .set({ 
        contractorId,
        status: order.fundedAmount >= order.totalAmount ? OrderStatus.IN_PROGRESS : OrderStatus.CREATED,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId));
    
    // Return updated order
    return this.getOrder(orderId);
  }
  
  /**
   * Contribute funds to an order
   * @param orderId Order ID
   * @param contributingUserId User ID making the contribution
   * @param amount Amount to contribute
   * @returns Updated order
   */
  async contributeFunds(
    orderId: string,
    contributingUserId: string,
    amount: string
  ): Promise<IOrder> {
    // Проверка суммы - должна быть положительной
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Contribution amount must be positive');
    }
    
    const order = await this.getOrder(orderId);
    
    // Validate order can receive funds
    if (
      order.status !== OrderStatus.CREATED && 
      order.status !== OrderStatus.FUNDED &&
      order.status !== OrderStatus.IN_PROGRESS
    ) {
      throw new Error(`Cannot contribute to order with status ${order.status}`);
    }
    
    // Ensure user is a customer for this order
    const customerIds = await this.getCustomerIdsForOrder(orderId);
    if (!customerIds.includes(contributingUserId)) {
      throw new Error('Only customers of this order can contribute funds');
    }
    
    // Update order funded amount
    const newFundedAmount = (Number(order.fundedAmount) + Number(amount)).toString();
    let newStatus = order.status;
    
    // Update status if becoming fully funded
    if (Number(newFundedAmount) >= Number(order.totalAmount)) {
      newStatus = order.contractorId ? OrderStatus.IN_PROGRESS : OrderStatus.FUNDED;
    }
    
    // Update order
    await db
      .update(schema.orders)
      .set({ 
        fundedAmount: newFundedAmount,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId));
    
    // Return updated order
    return this.getOrder(orderId);
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
    if (!orderId) throw new Error('Order ID is required');
    if (amount < 0) throw new Error('Amount must be a positive number');
    
    const order = await this.getOrder(orderId);
    
    // Adjust amount based on isDebit flag (add or subtract)
    const adjustedAmount = isDebit ? -Math.abs(amount) : Math.abs(amount);
    const currentFunded = Number(order.fundedAmount);
    
    // For debits, make sure we have enough funds
    if (isDebit && Math.abs(adjustedAmount) > currentFunded) {
      throw new Error(`Insufficient funds in order. Available: ${currentFunded}, Requested: ${Math.abs(adjustedAmount)}`);
    }
    
    const newFundedAmount = (currentFunded + adjustedAmount).toString();
    let newStatus = order.status;
    
    // Update status based on new funded amount
    if (!isDebit && Number(newFundedAmount) >= Number(order.totalAmount)) {
      // When adding funds and reaching total amount
      newStatus = order.contractorId ? OrderStatus.IN_PROGRESS : OrderStatus.FUNDED;
    } else if (isDebit && Number(newFundedAmount) <= 0) {
      // When all funds have been paid out
      newStatus = OrderStatus.COMPLETED;
    }
    
    // Update order
    await db
      .update(schema.orders)
      .set({ 
        fundedAmount: newFundedAmount,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId));
    
    // Return updated order
    return this.getOrder(orderId);
  }
  
  /**
   * Vote for a new representative in a group order
   * @param orderId Order ID
   * @param voterId ID of the voting customer
   * @param candidateId ID of the candidate customer
   * @returns Updated order with new vote recorded
   */
  async voteForRepresentative(
    orderId: string,
    voterId: string,
    candidateId: string
  ): Promise<IOrder> {
    const order = await this.getOrder(orderId);
    
    // Validate order is a group order
    if (!order.isGroupOrder) {
      throw new Error('Not a group order');
    }
    
    // Get customer IDs from junction table
    const customerIds = await this.getCustomerIdsForOrder(orderId);
    
    // Validate voter is a customer in this order
    if (!customerIds.includes(voterId)) {
      throw new Error('Voter is not a customer in this order');
    }
    
    // Validate candidate is a customer in this order
    if (!customerIds.includes(candidateId)) {
      throw new Error('Candidate is not a customer in this order');
    }
    
    try {
      // Delete previous vote from this voter if exists
      await db
        .delete(schema.representativeVotes)
        .where(and(
          eq(schema.representativeVotes.orderId, orderId),
          eq(schema.representativeVotes.voterId, voterId)
        ));
      
      // Add new vote
      await db.insert(schema.representativeVotes).values({
        orderId,
        voterId,
        candidateId
      });
      
      // Count votes for each candidate
      const votes = await db.query.representativeVotes.findMany({
        where: eq(schema.representativeVotes.orderId, orderId)
      });
      
      // Group votes by candidate
      const votesByCandidate: Record<string, number> = {};
      for (const vote of votes) {
        if (!votesByCandidate[vote.candidateId]) {
          votesByCandidate[vote.candidateId] = 0;
        }
        votesByCandidate[vote.candidateId]++;
      }
      
      // Find candidate with most votes
      let maxVotes = 0;
      let newRepresentativeId = order.representativeId;
      
      for (const [candidateId, voteCount] of Object.entries(votesByCandidate)) {
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          newRepresentativeId = candidateId;
        }
      }
      
      // Update representative if changed
      if (newRepresentativeId !== order.representativeId) {
        await db
          .update(schema.orders)
          .set({ 
            representativeId: newRepresentativeId,
            updatedAt: new Date()
          })
          .where(eq(schema.orders.id, orderId));
      }
    } catch (error) {
      console.error('Error processing vote:', error);
      throw error;
    }
    
    // Return updated order
    return this.getOrder(orderId);
  }

  /**
   * Get all votes for an order
   * @param orderId Order ID
   * @returns Array of vote objects containing voter, candidate and creation date
   */
  async getVotesForOrder(orderId: string): Promise<Array<{
    voterId: string;
    candidateId: string;
    createdAt: Date;
  }>> {
    // Get all votes for this order
    const votes = await db.query.representativeVotes.findMany({
      where: eq(schema.representativeVotes.orderId, orderId)
    });
    
    return votes;
  }

  /**
   * Update order status based on milestones completion
   * Checks if all milestones are completed, and if so, updates order status to COMPLETED
   * @param orderId Order ID
   * @returns Updated order
   */
  async updateOrderStatusBasedOnMilestones(orderId: string): Promise<IOrder> {
    // Get order and its milestones
    const order = await this.getOrder(orderId);
    
    // Skip if order already completed or cancelled
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      return order;
    }
    
    // Get all milestones for this order
    const milestones = await db.query.milestones.findMany({
      where: eq(schema.milestones.orderId, orderId)
    });
    
    // Check if all milestones are completed
    const allCompleted = milestones.length > 0 && 
      milestones.every(m => m.status === MilestoneStatus.COMPLETED);
    
    if (allCompleted) {
      // Update order status to COMPLETED
      await db
        .update(schema.orders)
        .set({
          status: OrderStatus.COMPLETED,
          updatedAt: new Date()
        })
        .where(eq(schema.orders.id, orderId));
        
      return this.getOrder(orderId);
    }
    
    return order;
  }
}
