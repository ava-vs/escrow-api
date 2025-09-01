import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export interface NotificationData {
  orderId?: string;
  milestoneId?: string;
  amount?: number;
  status?: string;
  [key: string]: any;
}

export class NotificationService {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    type: schema.NotificationType,
    title: string,
    message: string,
    data?: NotificationData
  ): Promise<schema.Notification> {
    const notificationId = crypto.randomUUID();

    const result = await this.db
      .insert(schema.notifications)
      .values({
        id: notificationId,
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const notification = result[0];
    if (!notification) {
      throw new Error('Failed to create notification');
    }

    // Check user preferences and send external notifications
    await this.sendExternalNotifications(userId, notification);

    return notification;
  }

  /**
   * Send order status update notification
   */
  async sendOrderStatusUpdate(userId: string, orderId: string, status: string): Promise<void> {
    const statusMessages = {
      'CREATED': 'Заказ создан',
      'FUNDED': 'Заказ профинансирован',
      'IN_PROGRESS': 'Заказ в работе',
      'COMPLETED': 'Заказ завершен',
      'CANCELLED': 'Заказ отменен'
    };

    const title = statusMessages[status as keyof typeof statusMessages] || 'Обновление статуса заказа';
    const message = `Статус заказа ${orderId} изменен на "${status}"`;

    await this.createNotification(userId, 'ORDER_STATUS', title, message, {
      orderId,
      status
    });
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(
    userId: string, 
    type: 'RECEIVED' | 'SENT' | 'DEDUCTED',
    amount: number,
    orderId?: string
  ): Promise<void> {
    const typeMessages = {
      'RECEIVED': 'Получен платеж',
      'SENT': 'Отправлен платеж',
      'DEDUCTED': 'Списание средств'
    };

    const title = typeMessages[type];
    const message = `${title} на сумму ${amount}${orderId ? ` по заказу ${orderId}` : ''}`;

    await this.createNotification(userId, 'PAYMENT', title, message, {
      amount,
      orderId,
      paymentType: type
    });
  }

  /**
   * Send milestone completion notification
   */
  async sendMilestoneNotification(
    userId: string,
    orderId: string,
    milestoneId: string,
    description: string,
    amount: number
  ): Promise<void> {
    const title = 'Этап завершен';
    const message = `Завершен этап "${description}" на сумму ${amount}`;

    await this.createNotification(userId, 'MILESTONE', title, message, {
      orderId,
      milestoneId,
      description,
      amount
    });
  }

  /**
   * Send chat message notification
   */
  async sendChatMessageNotification(
    userId: string,
    orderId: string,
    senderName: string,
    messagePreview: string
  ): Promise<void> {
    const title = 'Новое сообщение';
    const message = `${senderName}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}`;

    await this.createNotification(userId, 'CHAT_MESSAGE', title, message, {
      orderId,
      senderName
    });
  }

  /**
   * Send document notification
   */
  async sendDocumentNotification(
    userId: string,
    orderId: string,
    documentType: 'CREATED' | 'SIGNED' | 'APPROVED',
    documentName: string
  ): Promise<void> {
    const typeMessages = {
      'CREATED': 'Создан документ',
      'SIGNED': 'Подписан документ',
      'APPROVED': 'Утвержден документ'
    };

    const title = typeMessages[documentType];
    const message = `${title}: ${documentName}`;

    await this.createNotification(userId, 'DOCUMENT', title, message, {
      orderId,
      documentName,
      documentType
    });
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<schema.Notification[]> {
    const whereConditions = unreadOnly 
      ? and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false)
        )
      : eq(schema.notifications.userId, userId);

    return await this.db
      .select()
      .from(schema.notifications)
      .where(whereConditions)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.read, false)
      ));

    return result[0]?.count || 0;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(schema.notifications)
      .set({ 
        read: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId)
      ));
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(schema.notifications)
      .set({ 
        read: true,
        updatedAt: new Date()
      })
      .where(eq(schema.notifications.userId, userId));
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<schema.NotificationPreferences | null> {
    const result = await this.db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<schema.NotificationPreferences>
  ): Promise<schema.NotificationPreferences> {
    // Check if preferences exist
    const existing = await this.getUserPreferences(userId);

    if (existing) {
      const result = await this.db
        .update(schema.notificationPreferences)
        .set({
          ...preferences,
          updatedAt: new Date()
        })
        .where(eq(schema.notificationPreferences.userId, userId))
        .returning();

      const updated = result[0];
      if (!updated) {
        throw new Error('Failed to update notification preferences');
      }
      return updated;
    } else {
      // Create new preferences with defaults
      const defaultPreferences = {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        orderUpdates: true,
        paymentUpdates: true,
        chatMessages: true,
        systemUpdates: true,
        preferences: null,
        ...preferences
      };

      const result = await this.db
        .insert(schema.notificationPreferences)
        .values({
          userId,
          ...defaultPreferences,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new Error('Failed to create notification preferences');
      }
      return created;
    }
  }

  /**
   * Send external notifications (email, push, etc.)
   */
  private async sendExternalNotifications(
    userId: string,
    notification: schema.Notification
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences) return;

      // Check if user wants this type of notification
      const shouldSend = this.shouldSendNotification(notification.type, preferences);
      
      if (!shouldSend) return;

      // Send email notification if enabled
      if (preferences.emailEnabled) {
        await this.sendEmailNotification(userId, notification);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(userId, notification);
      }

    } catch (error) {
      console.error('Failed to send external notifications:', error);
      // Don't throw - external notifications are not critical
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  private shouldSendNotification(
    type: schema.NotificationType,
    preferences: schema.NotificationPreferences
  ): boolean {
    switch (type) {
      case 'ORDER_STATUS':
      case 'MILESTONE':
        return preferences.orderUpdates;
      case 'PAYMENT':
        return preferences.paymentUpdates;
      case 'CHAT_MESSAGE':
        return preferences.chatMessages;
      case 'SYSTEM':
      case 'DOCUMENT':
        return preferences.systemUpdates;
      default:
        return true;
    }
  }

  /**
   * Send email notification (placeholder for future implementation)
   */
  private async sendEmailNotification(
    userId: string,
    notification: schema.Notification
  ): Promise<void> {
    // TODO: Implement email sending via Cloudflare Email Workers
    console.log(`Email notification for user ${userId}: ${notification.title}`);
  }

  /**
   * Send push notification (placeholder for future implementation)
   */
  private async sendPushNotification(
    userId: string,
    notification: schema.Notification
  ): Promise<void> {
    // TODO: Implement push notifications via WebPush API
    console.log(`Push notification for user ${userId}: ${notification.title}`);
  }

  /**
   * Delete old notifications (cleanup)
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db
      .delete(schema.notifications)
      .where(eq(schema.notifications.createdAt, cutoffDate));

    return result.meta?.changes || 0;
  }
}