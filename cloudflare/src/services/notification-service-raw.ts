import type { Env } from '../index';

export class NotificationServiceRaw {
  constructor(private env: Env) {}

  /**
   * Create a new notification using raw SQL
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any
  ): Promise<any> {
    if (!userId) throw new Error("User ID is required for notification");
    try {
      const notificationId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const now = Math.floor(Date.now() / 1000);
      const validType = ['ORDER_STATUS', 'PAYMENT', 'CHAT_MESSAGE', 'SYSTEM', 'MILESTONE', 'DOCUMENT'].includes(type) ? type : 'SYSTEM';

      console.log('Creating notification with raw SQL:', {
        id: notificationId,
        userId,
        type: validType,
        title,
        message
      });

      const result = await this.env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        notificationId,
        userId,
        validType,
        title,
        message,
        data ? JSON.stringify(data) : null,
        0,
        now,
        now
      ).run();

      console.log('Raw SQL insert result:', result);

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
    } catch (error: any) {
      console.error('Error creating notification with raw SQL:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Get user notifications using raw SQL
   */
  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    if (!userId) throw new Error("User ID is required");
    try {
      console.log('Getting notifications with raw SQL for user:', userId);

      let sql = `
        SELECT id, user_id, type, title, message, data, read, created_at, updated_at
        FROM notifications 
        WHERE user_id = ?
      `;
      
      const params = [userId];

      if (unreadOnly) {
        sql += ' AND read = 0';
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit.toString(), offset.toString());

      const result = await this.env.DB.prepare(sql).bind(...params).all();
      
      console.log('Raw SQL query result:', result);

      return result.results || [];
    } catch (error: any) {
      console.error('Error getting notifications with raw SQL:', error);
      return [];
    }
  }

  /**
   * Get unread count using raw SQL
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) throw new Error("User ID is required");
    try {
      const result = await this.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = ? AND read = 0
      `).bind(userId).first();

      return (result?.count as number) || 0;
    } catch (error: any) {
      console.error('Error getting unread count with raw SQL:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read using raw SQL
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    try {
      const now = Math.floor(Date.now() / 1000);
      
      console.log('markAsRead params:', { notificationId, userId, now });
      
      const result = await this.env.DB.prepare(`
        UPDATE notifications 
        SET read = 1, updated_at = ? 
        WHERE id = ? AND user_id = ?
      `).bind(now, notificationId, userId).run();
      
      console.log('markAsRead result:', result);
    } catch (error: any) {
      console.error('Error marking as read with raw SQL:', error);
      console.error('Error details:', { message: error.message, stack: error.stack });
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read using raw SQL
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    try {
      const now = Math.floor(Date.now() / 1000);
      
      console.log('markAllAsRead params:', { userId, now });
      
      const result = await this.env.DB.prepare(`
        UPDATE notifications 
        SET read = 1, updated_at = ? 
        WHERE user_id = ? AND read = 0
      `).bind(now, userId).run();
      
      console.log('markAllAsRead result:', result);
    } catch (error: any) {
      console.error('Error marking all as read with raw SQL:', error);
      console.error('Error details:', { message: error.message, stack: error.stack });
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  /**
   * Get user preferences using raw SQL
   */
  async getUserPreferences(userId: string): Promise<any> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM notification_preferences WHERE user_id = ?
      `).bind(userId).first();
      
      if (!result) {
        // Create default preferences if none exist
        console.log('No preferences found for user, creating defaults:', userId);
        const now = Math.floor(Date.now() / 1000);
        
        await this.env.DB.prepare(`
          INSERT INTO notification_preferences (
            user_id, email_enabled, push_enabled, sms_enabled, order_updates, payment_updates, chat_messages, system_updates, preferences, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          1, // email_enabled
          1, // push_enabled
          0, // sms_enabled
          1, // order_updates
          1, // payment_updates
          1, // chat_messages
          1, // system_updates
          null, // preferences
          now,
          now
        ).run();
        
        // Return default preferences
        return {
          userId,
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
          orderUpdates: true,
          paymentUpdates: true,
          chatMessages: true,
          systemUpdates: true,
          preferences: null,
          createdAt: now,
          updatedAt: now
        };
      }

      // Map DB snake_case to API camelCase
      return {
        userId: result.user_id,
        emailEnabled: Boolean(result.email_enabled),
        pushEnabled: Boolean(result.push_enabled),
        smsEnabled: Boolean(result.sms_enabled),
        orderUpdates: Boolean(result.order_updates),
        paymentUpdates: Boolean(result.payment_updates),
        chatMessages: Boolean(result.chat_messages),
        systemUpdates: Boolean(result.system_updates),
        preferences: (() => {
          try {
            return result.preferences ? JSON.parse(result.preferences as string) : null;
          } catch {
            return null;
          }
        })(),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (error: any) {
      console.error('Error getting preferences with raw SQL:', error);
      return null;
    }
  }

  /**
   * Update user preferences using raw SQL
   */
  async updateUserPreferences(userId: string, preferences: any): Promise<any> {
    try {
      // Read raw existing row to preserve defaults when updating
      const existingRow = await this.env.DB.prepare(`
        SELECT * FROM notification_preferences WHERE user_id = ?
      `).bind(userId).first();
      const now = Math.floor(Date.now() / 1000);
      // Normalize input keys: accept both new camelCase and legacy names
      const p = preferences || {};
      const emailEnabledIn = p.emailEnabled ?? p.emailNotifications;
      const pushEnabledIn = p.pushEnabled ?? p.pushNotifications;
      const smsEnabledIn = p.smsEnabled; // no legacy alias used previously
      const orderUpdatesIn = p.orderUpdates ?? p.productUpdates; // map productUpdates->orderUpdates if provided
      const paymentUpdatesIn = p.paymentUpdates ?? p.transactionalEmails;
      const chatMessagesIn = p.chatMessages;
      const systemUpdatesIn = p.systemUpdates ?? p.securityUpdates;
      const extraPreferences = p.preferences ? JSON.stringify(p.preferences) : undefined;

      // Helper: normalize various truthy/falsey inputs to 0/1
      const norm = (v: any, defBool: boolean): number => {
        if (v === undefined || v === null) return defBool ? 1 : 0;
        if (typeof v === 'number') return v ? 1 : 0;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'string') {
          const s = v.toLowerCase().trim();
          if (['true', '1', 'yes', 'y'].includes(s)) return 1;
          if (['false', '0', 'no', 'n'].includes(s)) return 0;
          return defBool ? 1 : 0;
        }
        return v ? 1 : 0;
      };

      if (existingRow && (existingRow as any).user_id) {
        // Update existing preferences using correct column names
        const updateQuery = `
          UPDATE notification_preferences SET 
            email_enabled = ?, 
            push_enabled = ?, 
            sms_enabled = ?, 
            order_updates = ?, 
            payment_updates = ?, 
            chat_messages = ?, 
            system_updates = ?, 
            preferences = ?, 
            updated_at = ? 
          WHERE user_id = ?
        `;

        const params = [
          norm(emailEnabledIn, Boolean((existingRow as any).email_enabled ?? 1)),
          norm(pushEnabledIn, Boolean((existingRow as any).push_enabled ?? 1)),
          norm(smsEnabledIn, Boolean((existingRow as any).sms_enabled ?? 0)),
          norm(orderUpdatesIn, Boolean((existingRow as any).order_updates ?? 1)),
          norm(paymentUpdatesIn, Boolean((existingRow as any).payment_updates ?? 1)),
          norm(chatMessagesIn, Boolean((existingRow as any).chat_messages ?? 1)),
          norm(systemUpdatesIn, Boolean((existingRow as any).system_updates ?? 1)),
          extraPreferences ?? (existingRow as any).preferences ?? null,
          now,
          userId
        ];
        
        console.log('UPDATE preferences params:', params);
        console.log('UPDATE query:', updateQuery);
        
        const result = await this.env.DB.prepare(updateQuery).bind(...params).run();
        console.log('UPDATE result:', result);
      } else {
        // Insert new preferences using correct column names
        const insertQuery = `
          INSERT INTO notification_preferences (
            user_id, email_enabled, push_enabled, sms_enabled, order_updates, payment_updates, chat_messages, system_updates, preferences, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          userId,
          norm(emailEnabledIn, true),
          norm(pushEnabledIn, true),
          norm(smsEnabledIn, false),
          norm(orderUpdatesIn, true),
          norm(paymentUpdatesIn, true),
          norm(chatMessagesIn, true),
          norm(systemUpdatesIn, true),
          extraPreferences ?? null,
          now,
          now
        ];
        
        console.log('INSERT preferences params:', insertParams);
        console.log('INSERT query:', insertQuery);
        
        const result = await this.env.DB.prepare(insertQuery).bind(...insertParams).run();
        console.log('INSERT result:', result);
      }

      // Return mapped preferences
      return await this.getUserPreferences(userId);
    } catch (error: any) {
      console.error('Error updating preferences with raw SQL:', error);
      throw new Error('Failed to update preferences');
    }
  }
}