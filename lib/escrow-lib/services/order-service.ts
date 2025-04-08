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
  roadmapPhaseId?: string;
}

export class OrderService {
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
    
    // Create new order
    const newOrder = {
      id: orderId,
      customerIds: [customerId],
      isGroupOrder: false,
      title,
      description,
      status: OrderStatus.CREATED,
      totalAmount,
      fundedAmount: '0', // Using string for money values
      createdAt: new Date(),
      updatedAt: new Date(),
      votes: {}
    };
    
    // Do not use transaction to insert order and milestones
    await db.insert(schema.orders).values(newOrder);
      
      // Insert milestones
      for (const milestone of sanitizedMilestones) {
        await db.insert(schema.milestones).values({
          id: uuidv4(),
          orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: MilestoneStatus.PENDING,
          paid: false,
          roadmapPhaseId: milestone.roadmapPhaseId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
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
    
    // Create new order
    const newOrder = {
      id: orderId,
      customerIds,
      isGroupOrder: true,
      representativeId,
      title,
      description,
      status: OrderStatus.CREATED,
      totalAmount,
      fundedAmount: '0', // Using string for money values
      createdAt: new Date(),
      updatedAt: new Date(),
      votes: {}
    };
    
    // Do not use transaction to insert order and milestones
    await db.insert(schema.orders).values(newOrder);
      
      // Insert milestones
      for (const milestone of sanitizedMilestones) {
        await db.insert(schema.milestones).values({
          id: uuidv4(),
          orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: MilestoneStatus.PENDING,
          paid: false,
          roadmapPhaseId: milestone.roadmapPhaseId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
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
        status: milestone.status as unknown as MilestoneStatus, // Explicit type conversion
        paid: milestone.paid
      };
      
      acc[orderId].push(convertedMilestone);
      return acc;
    }, {} as Record<string, IMilestone[]>);
    
    // Combine orders with their milestones and convert milestone statuses
    return orders.map(order => {
      const orderMilestones = milestonesByOrderId[order.id] || [];
      
      // Convert milestone status string literals to MilestoneStatus enum
      const mappedMilestones = orderMilestones.map(milestone => {
        return {
          id: milestone.id,
          orderId: milestone.orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: milestone.status as unknown as MilestoneStatus, // Explicit type conversion
          paid: milestone.paid
        };
      });
      
      return {
        ...order,
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
    
    // Get orders where customer is participant
    const orders = await db.query.orders.findMany();
    
    // Filter orders where customer is a participant
    const customerOrders = orders.filter(order => 
      order.customerIds.includes(customerId)
    );
    
    // Get all milestones for these orders
    const orderIds = customerOrders.map(order => order.id);
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
        status: milestone.status as unknown as MilestoneStatus, // Explicit type conversion
        paid: milestone.paid
      };
      
      acc[orderId].push(convertedMilestone);
      return acc;
    }, {} as Record<string, IMilestone[]>);
    
    // Combine orders with their milestones
    return customerOrders.map(order => {
      const orderMilestones = milestonesByOrderId[order.id] || [];
      
      // Convert milestone status string literals to MilestoneStatus enum
      const mappedMilestones = orderMilestones.map(milestone => {
        return {
          id: milestone.id,
          orderId: milestone.orderId,
          description: milestone.description,
          amount: milestone.amount,
          deadline: milestone.deadline,
          status: milestone.status as unknown as MilestoneStatus, // Explicit type conversion
          paid: milestone.paid
        };
      });
      
      return {
        ...order,
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
    if (!order.customerIds.includes(contributingUserId)) {
      throw new Error('Only customers of this order can contribute funds');
    }
    
    // Update order funded amount
    const newFundedAmount = order.fundedAmount + amount;
    let newStatus = order.status;
    
    // Update status if becoming fully funded
    if (newFundedAmount >= order.totalAmount) {
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
    
    // Validate voter is a customer in this order
    if (!order.customerIds.includes(voterId)) {
      throw new Error('Voter is not a customer in this order');
    }
    
    // Validate candidate is a customer in this order
    if (!order.customerIds.includes(candidateId)) {
      throw new Error('Candidate is not a customer in this order');
    }
    
    // Get current votes
    const votes = { ...order.votes };
    
    // Remove voter from any previous votes
    // Convert entries to array to avoid iteration issues with MapIterator
    Array.from(Object.entries(votes)).forEach(([cId, voterIds]) => {
      votes[cId] = (voterIds as string[]).filter(vId => vId !== voterId);
    });
    
    // Add new vote
    if (!votes[candidateId]) {
      votes[candidateId] = [];
    }
    votes[candidateId].push(voterId);
    
    // Determine if we have a new representative
    let newRepresentativeId = order.representativeId;
    const voteCount = new Map<string, number>();
    
    Object.entries(votes).forEach(([cId, voters]) => {
      voteCount.set(cId, voters.length);
    });
    
    // Find candidate with most votes
    let maxVotes = 0;
    // Convert Map entries to array to avoid iteration issues with MapIterator
    Array.from(voteCount.entries()).forEach(([cId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        newRepresentativeId = cId;
      }
    });
    
    // Update order with new votes and possibly new representative
    await db
      .update(schema.orders)
      .set({ 
        votes,
        representativeId: newRepresentativeId,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId));
    
    // Return updated order
    return this.getOrder(orderId);
  }
}
