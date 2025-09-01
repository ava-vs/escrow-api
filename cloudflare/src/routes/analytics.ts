import { Hono } from 'hono';
import { jwtAuth } from '../middleware/auth-middleware';
import { AnalyticsServiceFixed } from '../services/analytics-service-fixed';
import type { Env } from '../index';

interface Variables {
  user: any;
}

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get user dashboard
analyticsRoutes.get('/dashboard', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const analyticsService = new AnalyticsServiceFixed(c.env);
    
    const dashboard = await analyticsService.getUserDashboard(user.id);

    return c.json({ dashboard });
  } catch (error) {
    console.error('Error fetching user dashboard:', error);
    return c.json({ error: 'Failed to fetch user dashboard' }, 500);
  }
});

// Get user statistics summary
analyticsRoutes.get('/summary', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const analyticsService = new AnalyticsServiceFixed(c.env);
    
    const dashboard = await analyticsService.getUserDashboard(user.id);
    
    // Return simplified summary
    const summary = {
      totalOrders: dashboard.totalOrders,
      completedOrders: dashboard.completedOrders,
      successRate: dashboard.successRate,
      totalEarnings: dashboard.totalEarnings,
      totalSpent: dashboard.totalSpent,
      averageOrderValue: dashboard.averageOrderValue
    };

    return c.json({ summary });
  } catch (error) {
    console.error('Error fetching user summary:', error);
    return c.json({ error: 'Failed to fetch user summary' }, 500);
  }
});

// Get platform metrics (admin only)
analyticsRoutes.get('/platform', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.type !== 'PLATFORM') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }
    
    const analyticsService = new AnalyticsServiceFixed(c.env);
    const metrics = await analyticsService.getPlatformMetrics();

    return c.json({ metrics });
  } catch (error) {
    console.error('Error fetching platform metrics:', error);
    return c.json({ error: 'Failed to fetch platform metrics' }, 500);
  }
});

// Test notification creation through analytics route
analyticsRoutes.post('/test-notification', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    const notificationId = 'analytics_test_' + Date.now();
    const now = Math.floor(Date.now() / 1000);
    
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at, updated_at)
      VALUES (?, ?, 'SYSTEM', ?, ?, NULL, 0, ?, ?)
    `).bind(
      notificationId,
      user.id,
      body.title || 'Analytics Test Notification',
      body.message || 'Test from analytics route',
      now,
      now
    ).run();
    
    return c.json({ 
      success: true,
      notification: {
        id: notificationId,
        userId: user.id,
        type: 'SYSTEM',
        title: body.title || 'Analytics Test Notification',
        message: body.message || 'Test from analytics route',
        read: false,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('Analytics test notification error:', error);
    return c.json({ 
      error: 'Failed to create test notification',
      details: error.message 
    }, 500);
  }
});

export { analyticsRoutes };