import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export class NotificationServiceSimple {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any
  ): Promise<any> {
    try {
      const notificationId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      // Validate notification type
      const validTypes = ['ORDER_STATUS', 'PAYMENT', 'CHAT_MESSAGE', 'SYSTEM', 'MILESTONE', 'DOCUMENT'];
      const validType = validTypes.includes(type) ? type : 'SYSTEM';

      console.log('Creating notification with values:', {
        id: notificationId,
        userId,
        type: validType,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        read: 0,
        createdAt: now,
        updatedAt: now
      });

      // Use raw SQL to avoid any schema issues
      const sql = `
        INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.env.DB.prepare(sql)
        .bind(
          notificationId,
          userId,
          validType,
          title,
          message,
          data ? JSON.stringify(data) : null,
          0,
          now,
          now
        )
        .run();

      console.log('Notification created successfully');

      return {
        id: notificationId,
        userId,
        type: validType,
        title,
        message,
        data,
        read: false,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    try {
      let query = this.db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId));

      if (unreadOnly) {
        query = this.db
          .select()
          .from(schema.notifications)
          .where(and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false)
          ));
      }

      return await query
        .orderBy(desc(schema.notifications.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false)
        ));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.db
        .update(schema.notifications)
        .set({ 
          read: true,
          updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId)
        ));
    } catch (error) {
      console.error('Error marking as read:', error);
      throw new Error('Failed to mark as read');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.db
        .update(schema.notifications)
        .set({ 
          read: true,
          updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(schema.notifications.userId, userId));
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw new Error('Failed to mark all as read');
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(schema.notificationPreferences)
        .where(eq(schema.notificationPreferences.userId, userId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting preferences:', error);
      return null;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: any): Promise<any> {
    try {
      const existing = await this.getUserPreferences(userId);

      if (existing) {
        const result = await this.db
          .update(schema.notificationPreferences)
          .set({
            ...preferences,
            updatedAt: Math.floor(Date.now() / 1000)
          })
          .where(eq(schema.notificationPreferences.userId, userId))
          .returning();

        return result[0] || existing;
      } else {
        const now = Math.floor(Date.now() / 1000);
        const result = await this.db
          .insert(schema.notificationPreferences)
          .values({
            userId,
            emailEnabled: true,
            pushEnabled: true,
            smsEnabled: false,
            orderUpdates: true,
            paymentUpdates: true,
            chatMessages: true,
            systemUpdates: true,
            preferences: null,
            ...preferences,
            createdAt: now,
            updatedAt: now
          })
          .returning();

        return result[0];
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }
}