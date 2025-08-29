/**
 * Order service for managing orders and milestones in the Cloudflare Workers environment
 * Adapted from the original order service for D1 database
 */

import { eq, and, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { Env } from '../index';

// Interface for milestone input data
export interface IMilestoneInputData {
  description: string;
  amount: number;
  deadline: Date | string;
}

export interface IOrderData {
  title: string;
  description: string;
  isGroupOrder?: boolean;
  milestones: IMilestoneInputData[];
}

export class OrderService {
  private db: ReturnType<typeof drizzle>;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Helper method to get customer IDs for an order from the junction table
   * @param orderId Order ID
   * @returns Array of customer IDs
   */
  private async getCustomerIdsForOrder(orderId: string): Promise<string[]> {
    const customerOrders = await this.db
      .select()
      .from(schema.customerOrders)
      .where(eq(schema.customerOrders.orderId, orderId));
    
    return customerOrders.map(co => co.customerId);
  }

  /**
   * Create a new order with specified customer, title, description, and milestones
   * @param customerId ID of the customer creating the order
   * @param orderData Order data including title, description, and milestones
   * @returns Created order
   */
  async createOrder(
    customerId: string,
    orderData: IOrderData
  ): Promise<schema.Order> {
    // Validate input
    if (!customerId) throw new Error('Customer ID is required');
    if (!orderData.title) throw new Error('Order title is required');
    if (!orderData.milestones || orderData.milestones.length === 0) {
      throw new Error('At least one milestone is required');
    }

    const orderId = crypto.randomUUID();
    
    // Calculate total amount from milestones
    const totalAmount = orderData.milestones.reduce((sum, milestone) => sum + milestone.amount, 0);

    try {
      // Create the order
      const [order] = await this.db
        .insert(schema.orders)
        .values({
          id: orderId,
          title: orderData.title,
          description: orderData.description,
          isGroupOrder: orderData.isGroupOrder || false,
          totalAmount,
          status: 'CREATED'
        })
        .returning();

      // Create customer-order relationship
      await this.db
        .insert(schema.customerOrders)
        .values({
          id: crypto.randomUUID(),
          customerId,
          orderId,
          contributedAmount: 0
        });

      // Create milestones
      for (const milestoneData of orderData.milestones) {
        await this.db
          .insert(schema.milestones)
          .values({
            id: crypto.randomUUID(),
            orderId,
            description: milestoneData.description,
            amount: milestoneData.amount,
            deadline: new Date(milestoneData.deadline),
            status: 'PENDING'
          });
      }

      return order!;
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
  }

  /**
   * Get order by ID with related data
   * @param orderId Order ID
   * @returns Order with milestones and customer data
   */
  async getOrderById(orderId: string): Promise<schema.Order | null> {
    try {
      const [order] = await this.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      return order || null;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw new Error('Failed to fetch order');
    }
  }

  /**
   * Get milestones for an order
   * @param orderId Order ID
   * @returns Array of milestones
   */
  async getMilestonesByOrderId(orderId: string): Promise<schema.Milestone[]> {
    try {
      return await this.db
        .select()
        .from(schema.milestones)
        .where(eq(schema.milestones.orderId, orderId));
    } catch (error) {
      console.error('Error fetching milestones:', error);
      throw new Error('Failed to fetch milestones');
    }
  }

  /**
   * Update order status
   * @param orderId Order ID
   * @param status New status
   * @returns Updated order
   */
  async updateOrderStatus(
    orderId: string, 
    status: 'CREATED' | 'FUNDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ): Promise<schema.Order> {
    try {
      const [order] = await this.db
        .update(schema.orders)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(schema.orders.id, orderId))
        .returning();

      if (!order) {
        throw new Error('Order not found');
      }

      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw new Error('Failed to update order status');
    }
  }

  /**
   * Assign contractor to order
   * @param orderId Order ID
   * @param contractorId Contractor user ID
   * @returns Updated order
   */
  async assignContractor(orderId: string, contractorId: string): Promise<schema.Order> {
    try {
      const [order] = await this.db
        .update(schema.orders)
        .set({ 
          contractorId,
          status: 'IN_PROGRESS',
          updatedAt: new Date()
        })
        .where(eq(schema.orders.id, orderId))
        .returning();

      if (!order) {
        throw new Error('Order not found');
      }

      return order;
    } catch (error) {
      console.error('Error assigning contractor:', error);
      throw new Error('Failed to assign contractor');
    }
  }

  /**
   * Get orders for a user (as customer or contractor)
   * @param userId User ID
   * @returns Array of orders
   */
  async getOrdersForUser(userId: string): Promise<schema.Order[]> {
    try {
      // Get orders where user is contractor
      const contractorOrders = await this.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.contractorId, userId));

      // Get orders where user is customer
      const customerOrderIds = await this.db
        .select({ orderId: schema.customerOrders.orderId })
        .from(schema.customerOrders)
        .where(eq(schema.customerOrders.customerId, userId));

      const customerOrders = customerOrderIds.length > 0 
        ? await this.db
            .select()
            .from(schema.orders)
            .where(inArray(schema.orders.id, customerOrderIds.map(co => co.orderId)))
        : [];

      // Combine and deduplicate
      const allOrders = [...contractorOrders, ...customerOrders];
      const uniqueOrders = allOrders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      );

      return uniqueOrders;
    } catch (error) {
      console.error('Error fetching user orders:', error);
      throw new Error('Failed to fetch user orders');
    }
  }

  /**
   * Update milestone status
   * @param milestoneId Milestone ID
   * @param status New status
   * @returns Updated milestone
   */
  async updateMilestoneStatus(
    milestoneId: string, 
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ): Promise<schema.Milestone> {
    try {
      const [milestone] = await this.db
        .update(schema.milestones)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(schema.milestones.id, milestoneId))
        .returning();

      if (!milestone) {
        throw new Error('Milestone not found');
      }

      return milestone;
    } catch (error) {
      console.error('Error updating milestone status:', error);
      throw new Error('Failed to update milestone status');
    }
  }
}