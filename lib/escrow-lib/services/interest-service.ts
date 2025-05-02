/**
 * Service for managing interest-only functionality
 * Handles user interest in order completion
 */

import { getDb } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../schema/index';

export class InterestService {
  /**
   * Check if user has marked interest in an order
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Boolean indicating whether user is interested
   */
  async checkInterest(userId: string, orderId: string): Promise<boolean> {
    const db = getDb();
    
    const result = await db.select()
      .from(schema.interestOnly)
      .where(
        and(
          eq(schema.interestOnly.userId, userId),
          eq(schema.interestOnly.orderId, orderId)
        )
      );
      
    return result.length > 0;
  }
  
  /**
   * Toggle user interest in an order
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Object containing the action performed (added/removed)
   */
  async toggleInterest(userId: string, orderId: string): Promise<{ action: 'added' | 'removed' }> {
    const db = getDb();
    
    // Check if interest record already exists
    const isInterested = await this.checkInterest(userId, orderId);
    
    if (isInterested) {
      // Remove interest
      await db.delete(schema.interestOnly)
        .where(
          and(
            eq(schema.interestOnly.userId, userId),
            eq(schema.interestOnly.orderId, orderId)
          )
        );
      return { action: 'removed' };
    } else {
      // Add interest
      await db.insert(schema.interestOnly)
        .values({
          userId,
          orderId,
          createdAt: new Date()
        });
      return { action: 'added' };
    }
  }
  
  /**
   * Get all orders that a user is interested in
   * @param userId - User ID
   * @returns Array of order IDs
   */
  async getUserInterests(userId: string): Promise<string[]> {
    const db = getDb();
    
    const interests = await db.select({ orderId: schema.interestOnly.orderId })
      .from(schema.interestOnly)
      .where(eq(schema.interestOnly.userId, userId))
      .orderBy(schema.interestOnly.createdAt);
      
    return interests.map((i: { orderId: string }) => i.orderId);
  }
  
  /**
   * Get all users interested in a specific order
   * @param orderId - Order ID
   * @returns Array of user IDs
   */
  async getOrderInterestedUsers(orderId: string): Promise<string[]> {
    const db = getDb();
    
    const interests = await db.select({ userId: schema.interestOnly.userId })
      .from(schema.interestOnly)
      .where(eq(schema.interestOnly.orderId, orderId))
      .orderBy(schema.interestOnly.createdAt);
      
    return interests.map((i: { userId: string }) => i.userId);
  }
}
