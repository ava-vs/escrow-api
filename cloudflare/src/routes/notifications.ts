import { Hono } from 'hono';
import { jwtAuth } from '../middleware/auth-middleware';
import { NotificationServiceRaw } from '../services/notification-service-raw';
import type { Env } from '../index';

interface Variables {
  user: any;
}

const notificationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get user notifications
notificationRoutes.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    if (!userId) return c.json({ error: 'User not authenticated' }, 401);

    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const unreadOnly = c.req.query('unread_only') === 'true';

    const notificationService = new NotificationServiceRaw(c.env);
    
    const [notifications, unreadCount] = await Promise.all([
      notificationService.getUserNotifications(userId, limit, offset, unreadOnly),
      notificationService.getUnreadCount(userId)
    ]);

    return c.json({
      notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

// Get unread notifications count
notificationRoutes.get('/unread-count', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    if (!userId) return c.json({ error: 'User not authenticated' }, 401);

    const notificationService = new NotificationServiceRaw(c.env);
    
    const unreadCount = await notificationService.getUnreadCount(userId);

    return c.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return c.json({ error: 'Failed to fetch unread count' }, 500);
  }
});

// Mark all notifications as read
notificationRoutes.put('/read-all', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    if (!userId) return c.json({ error: 'User not authenticated' }, 401);

    const notificationService = new NotificationServiceRaw(c.env);
    
    await notificationService.markAllAsRead(userId);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return c.json({ error: 'Failed to mark all notifications as read' }, 500);
  }
});

// Get notification preferences
notificationRoutes.get('/preferences', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    if (!userId) return c.json({ error: 'User not authenticated' }, 401);

    const notificationService = new NotificationServiceRaw(c.env);
    
    const preferences = await notificationService.getUserPreferences(userId);

    return c.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return c.json({ error: 'Failed to fetch notification preferences' }, 500);
  }
});

// Update notification preferences
notificationRoutes.put('/preferences', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    if (!userId) return c.json({ error: 'User not authenticated' }, 401);

    const body = await c.req.json();
    const notificationService = new NotificationServiceRaw(c.env);
    
    const preferences = await notificationService.updateUserPreferences(userId, body);

    return c.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return c.json({ error: 'Failed to update notification preferences' }, 500);
  }
});

// Create test notification
notificationRoutes.post('/create-test', jwtAuth, async (c) => {
  try {
    const { userId, type, title, message, data } = await c.req.json();
    const service = new NotificationServiceRaw(c.env);

    const notification = await service.createNotification(userId, type, title, message, data ?? null);

    return c.json({ success: true, notification });
  } catch (error: any) {
    console.error('Create notification error:', error);
    return c.json({ 
      error: 'Failed to create notification',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

export { notificationRoutes };