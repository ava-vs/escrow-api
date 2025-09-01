import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, lte, count, sum, avg, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export interface UserDashboard {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalEarnings: number;
  totalSpent: number;
  averageOrderValue: number;
  successRate: number;
  averageCompletionDays: number;
  recentActivity: RecentActivity[];
  monthlyStats: MonthlyStats[];
}

export interface RecentActivity {
  id: string;
  type: 'ORDER_CREATED' | 'ORDER_COMPLETED' | 'PAYMENT_RECEIVED' | 'PAYMENT_SENT' | 'MILESTONE_COMPLETED';
  title: string;
  description: string;
  amount?: number;
  orderId?: string;
  createdAt: Date;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  orders: number;
  earnings: number;
  spent: number;
}

export interface PlatformMetrics {
  totalVolume: number;
  platformRevenue: number;
  averageOrderValue: number;
  activeUsers: number;
  newRegistrations: number;
  userRetention: number;
  orderCompletionRate: number;
  averageCompletionTime: number;
  disputeRate: number;
  apiResponseTime: number;
  uptime: number;
  errorRate: number;
}

export class AnalyticsService {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Get comprehensive user dashboard
   */
  async getUserDashboard(userId: string): Promise<UserDashboard> {
    // Try to get cached analytics first
    let analytics = await this.getCachedUserAnalytics(userId);
    
    // If cache is older than 1 hour, recompute
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!analytics || analytics.computedAt < oneHourAgo) {
      analytics = await this.computeUserAnalytics(userId);
    }

    // Get recent activity and monthly stats (always fresh)
    const [recentActivity, monthlyStats] = await Promise.all([
      this.getRecentActivity(userId),
      this.getMonthlyStats(userId)
    ]);

    return {
      totalOrders: analytics.totalOrders,
      completedOrders: analytics.completedOrders,
      cancelledOrders: analytics.cancelledOrders,
      totalEarnings: analytics.totalEarnings,
      totalSpent: analytics.totalSpent,
      averageOrderValue: analytics.averageOrderValue,
      successRate: analytics.successRate,
      averageCompletionDays: analytics.averageCompletionDays,
      recentActivity,
      monthlyStats
    };
  }

  /**
   * Get cached user analytics
   */
  private async getCachedUserAnalytics(userId: string): Promise<schema.UserAnalytics | null> {
    const result = await this.db
      .select()
      .from(schema.userAnalytics)
      .where(eq(schema.userAnalytics.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Compute and cache user analytics
   */
  async computeUserAnalytics(userId: string): Promise<schema.UserAnalytics> {
    // Get user type to determine if they're a contractor or customer
    const user = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user[0]) {
      throw new Error('User not found');
    }

    const userType = user[0].type;
    let analytics: Partial<schema.UserAnalytics> = {
      userId,
      computedAt: new Date()
    };

    if (userType === 'CONTRACTOR') {
      analytics = await this.computeContractorAnalytics(userId);
    } else if (userType === 'CUSTOMER') {
      analytics = await this.computeCustomerAnalytics(userId);
    }

    // Update last activity
    analytics.lastActivity = await this.getLastActivity(userId);

    // Upsert analytics
    const existing = await this.getCachedUserAnalytics(userId);
    
    if (existing) {
      const result = await this.db
        .update(schema.userAnalytics)
        .set(analytics)
        .where(eq(schema.userAnalytics.userId, userId))
        .returning();
      
      const updated = result[0];
      if (!updated) {
        throw new Error('Failed to update user analytics');
      }
      return updated;
    } else {
      const result = await this.db
        .insert(schema.userAnalytics)
        .values({
          userId,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalEarnings: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          successRate: 0,
          averageCompletionDays: 0,
          lastActivity: null,
          ...analytics,
          computedAt: new Date()
        })
        .returning();
      
      const created = result[0];
      if (!created) {
        throw new Error('Failed to create user analytics');
      }
      return created;
    }
  }

  /**
   * Compute analytics for contractor
   */
  private async computeContractorAnalytics(userId: string): Promise<Partial<schema.UserAnalytics>> {
    // Get orders where user is contractor
    const orders = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.contractorId, userId));

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

    // Calculate earnings from completed milestones
    const completedMilestones = await this.db
      .select()
      .from(schema.milestones)
      .innerJoin(schema.orders, eq(schema.milestones.orderId, schema.orders.id))
      .where(and(
        eq(schema.orders.contractorId, userId),
        eq(schema.milestones.status, 'COMPLETED')
      ));

    const totalEarnings = completedMilestones.reduce((sum, m) => sum + (m.milestones.amount * 0.8), 0);
    const averageOrderValue = totalOrders > 0 ? orders.reduce((sum, o) => sum + o.totalAmount, 0) / totalOrders : 0;
    const successRate = totalOrders > 0 ? completedOrders / totalOrders : 0;

    // Calculate average completion time
    const completedOrdersWithDates = orders.filter(o => o.status === 'COMPLETED');
    let averageCompletionDays = 0;
    
    if (completedOrdersWithDates.length > 0) {
      const totalDays = completedOrdersWithDates.reduce((sum, order) => {
        const daysDiff = Math.floor((order.updatedAt.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0);
      averageCompletionDays = totalDays / completedOrdersWithDates.length;
    }

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalEarnings,
      totalSpent: 0, // Contractors don't spend on orders
      averageOrderValue,
      successRate,
      averageCompletionDays
    };
  }

  /**
   * Compute analytics for customer
   */
  private async computeCustomerAnalytics(userId: string): Promise<Partial<schema.UserAnalytics>> {
    // Get orders where user is customer (through customerOrders table)
    const customerOrdersData = await this.db
      .select()
      .from(schema.customerOrders)
      .innerJoin(schema.orders, eq(schema.customerOrders.orderId, schema.orders.id))
      .where(eq(schema.customerOrders.customerId, userId));

    const totalOrders = customerOrdersData.length;
    const completedOrders = customerOrdersData.filter(co => co.orders.status === 'COMPLETED').length;
    const cancelledOrders = customerOrdersData.filter(co => co.orders.status === 'CANCELLED').length;

    // Calculate total spent
    const totalSpent = customerOrdersData.reduce((sum, co) => sum + co.customer_orders.contributedAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const successRate = totalOrders > 0 ? completedOrders / totalOrders : 0;

    // Calculate average completion time for completed orders
    const completedOrdersWithDates = customerOrdersData.filter(co => co.orders.status === 'COMPLETED');
    let averageCompletionDays = 0;
    
    if (completedOrdersWithDates.length > 0) {
      const totalDays = completedOrdersWithDates.reduce((sum, co) => {
        const daysDiff = Math.floor((co.orders.updatedAt.getTime() - co.orders.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0);
      averageCompletionDays = totalDays / completedOrdersWithDates.length;
    }

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalEarnings: 0, // Customers don't earn from orders
      totalSpent,
      averageOrderValue,
      successRate,
      averageCompletionDays
    };
  }

  /**
   * Get recent activity for user
   */
  private async getRecentActivity(userId: string, limit: number = 10): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Get recent orders
    const recentOrders = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.contractorId, userId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(5);

    for (const order of recentOrders) {
      activities.push({
        id: `order-${order.id}`,
        type: order.status === 'COMPLETED' ? 'ORDER_COMPLETED' : 'ORDER_CREATED',
        title: order.status === 'COMPLETED' ? 'Заказ завершен' : 'Новый заказ',
        description: order.title,
        orderId: order.id,
        createdAt: order.status === 'COMPLETED' ? order.updatedAt : order.createdAt
      });
    }

    // Get recent customer orders
    const recentCustomerOrders = await this.db
      .select()
      .from(schema.customerOrders)
      .innerJoin(schema.orders, eq(schema.customerOrders.orderId, schema.orders.id))
      .where(eq(schema.customerOrders.customerId, userId))
      .orderBy(desc(schema.customerOrders.createdAt))
      .limit(5);

    for (const co of recentCustomerOrders) {
      activities.push({
        id: `payment-${co.customer_orders.id}`,
        type: 'PAYMENT_SENT',
        title: 'Оплата заказа',
        description: co.orders.title,
        amount: co.customer_orders.contributedAmount,
        orderId: co.orders.id,
        createdAt: co.customer_orders.createdAt
      });
    }

    // Sort by date and limit
    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get monthly statistics for user
   */
  private async getMonthlyStats(userId: string, months: number = 6): Promise<MonthlyStats[]> {
    const stats: MonthlyStats[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthStr = month.toISOString().substring(0, 7); // YYYY-MM

      // Get orders for this month (as contractor)
      const contractorOrders = await this.db
        .select()
        .from(schema.orders)
        .where(and(
          eq(schema.orders.contractorId, userId),
          gte(schema.orders.createdAt, month),
          lte(schema.orders.createdAt, nextMonth)
        ));

      // Get customer orders for this month
      const customerOrders = await this.db
        .select()
        .from(schema.customerOrders)
        .where(and(
          eq(schema.customerOrders.customerId, userId),
          gte(schema.customerOrders.createdAt, month),
          lte(schema.customerOrders.createdAt, nextMonth)
        ));

      const orders = contractorOrders.length + customerOrders.length;
      const earnings = contractorOrders.reduce((sum, o) => sum + o.totalAmount * 0.8, 0);
      const spent = customerOrders.reduce((sum, co) => sum + co.contributedAmount, 0);

      stats.push({
        month: monthStr,
        orders,
        earnings,
        spent
      });
    }

    return stats.reverse(); // Oldest first
  }

  /**
   * Get last activity timestamp for user
   */
  private async getLastActivity(userId: string): Promise<Date | null> {
    // Check various tables for last activity
    const activities = await Promise.all([
      // Last order creation
      this.db
        .select({ createdAt: schema.orders.createdAt })
        .from(schema.orders)
        .where(eq(schema.orders.contractorId, userId))
        .orderBy(desc(schema.orders.createdAt))
        .limit(1),
      
      // Last customer order
      this.db
        .select({ createdAt: schema.customerOrders.createdAt })
        .from(schema.customerOrders)
        .where(eq(schema.customerOrders.customerId, userId))
        .orderBy(desc(schema.customerOrders.createdAt))
        .limit(1),
      
      // Last chat message
      this.db
        .select({ createdAt: schema.chatMessages.createdAt })
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.senderId, userId))
        .orderBy(desc(schema.chatMessages.createdAt))
        .limit(1)
    ]);

    const dates = activities
      .flat()
      .map(a => a.createdAt)
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());

    return dates[0] || null;
  }

  /**
   * Get platform-wide metrics (admin only)
   */
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get basic counts
    const [
      totalOrdersResult,
      completedOrdersResult,
      totalUsersResult,
      newUsersResult,
      totalVolumeResult
    ] = await Promise.all([
      this.db.select({ count: count() }).from(schema.orders),
      this.db.select({ count: count() }).from(schema.orders).where(eq(schema.orders.status, 'COMPLETED')),
      this.db.select({ count: count() }).from(schema.users),
      this.db.select({ count: count() }).from(schema.users).where(gte(schema.users.createdAt, thirtyDaysAgo)),
      this.db.select({ total: sum(schema.orders.totalAmount) }).from(schema.orders).where(eq(schema.orders.status, 'COMPLETED'))
    ]);

    const totalOrders = totalOrdersResult[0]?.count || 0;
    const completedOrders = completedOrdersResult[0]?.count || 0;
    const totalUsers = totalUsersResult[0]?.count || 0;
    const newRegistrations = newUsersResult[0]?.count || 0;
    const totalVolume = Number(totalVolumeResult[0]?.total || 0);

    // Calculate derived metrics
    const platformRevenue = totalVolume * 0.1; // 10% platform fee
    const averageOrderValue = totalOrders > 0 ? totalVolume / totalOrders : 0;
    const orderCompletionRate = totalOrders > 0 ? completedOrders / totalOrders : 0;

    // Get active users (users with activity in last 30 days)
    const activeUsersResult = await this.db
      .select({ count: count() })
      .from(schema.users)
      .where(gte(schema.users.lastLogin, thirtyDaysAgo));
    
    const activeUsers = activeUsersResult[0]?.count || 0;
    const userRetention = totalUsers > 0 ? activeUsers / totalUsers : 0;

    return {
      totalVolume,
      platformRevenue,
      averageOrderValue,
      activeUsers,
      newRegistrations,
      userRetention,
      orderCompletionRate,
      averageCompletionTime: 0, // TODO: Calculate from completed orders
      disputeRate: 0, // TODO: Implement dispute tracking
      apiResponseTime: 0, // TODO: Implement from monitoring
      uptime: 99.9, // TODO: Implement from monitoring
      errorRate: 0 // TODO: Implement from monitoring
    };
  }

  /**
   * Update user analytics when events occur
   */
  async updateUserAnalyticsOnEvent(userId: string, eventType: string, data?: any): Promise<void> {
    // Invalidate cache by updating computedAt to force recomputation
    try {
      await this.db
        .update(schema.userAnalytics)
        .set({ computedAt: new Date(0) }) // Force recomputation
        .where(eq(schema.userAnalytics.userId, userId));
    } catch (error) {
      console.error('Failed to invalidate user analytics cache:', error);
    }
  }

  /**
   * Generate daily platform analytics
   */
  async generateDailyPlatformAnalytics(date?: Date): Promise<void> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().substring(0, 10); // YYYY-MM-DD
    
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Calculate daily metrics
    const [
      ordersResult,
      completedOrdersResult,
      volumeResult,
      newUsersResult
    ] = await Promise.all([
      this.db.select({ count: count() }).from(schema.orders)
        .where(and(gte(schema.orders.createdAt, dayStart), lte(schema.orders.createdAt, dayEnd))),
      
      this.db.select({ count: count() }).from(schema.orders)
        .where(and(
          eq(schema.orders.status, 'COMPLETED'),
          gte(schema.orders.updatedAt, dayStart),
          lte(schema.orders.updatedAt, dayEnd)
        )),
      
      this.db.select({ total: sum(schema.orders.totalAmount) }).from(schema.orders)
        .where(and(
          eq(schema.orders.status, 'COMPLETED'),
          gte(schema.orders.updatedAt, dayStart),
          lte(schema.orders.updatedAt, dayEnd)
        )),
      
      this.db.select({ count: count() }).from(schema.users)
        .where(and(gte(schema.users.createdAt, dayStart), lte(schema.users.createdAt, dayEnd)))
    ]);

    const totalOrders = ordersResult[0]?.count || 0;
    const completedOrders = completedOrdersResult[0]?.count || 0;
    const totalVolume = Number(volumeResult[0]?.total || 0);
    const newRegistrations = newUsersResult[0]?.count || 0;
    const platformRevenue = totalVolume * 0.1;

    // Get active users for the day
    const activeUsersResult = await this.db
      .select({ count: count() })
      .from(schema.users)
      .where(and(gte(schema.users.lastLogin, dayStart), lte(schema.users.lastLogin, dayEnd)));
    
    const activeUsers = activeUsersResult[0]?.count || 0;

    // Upsert daily analytics
    const analyticsId = `daily-${dateStr}`;
    
    try {
      await this.db
        .insert(schema.platformAnalytics)
        .values({
          id: analyticsId,
          date: dateStr,
          totalOrders,
          completedOrders,
          totalVolume,
          platformRevenue,
          activeUsers,
          newRegistrations,
          createdAt: new Date()
        });
    } catch (error) {
      // If record exists, update it
      await this.db
        .update(schema.platformAnalytics)
        .set({
          totalOrders,
          completedOrders,
          totalVolume,
          platformRevenue,
          activeUsers,
          newRegistrations
        })
        .where(eq(schema.platformAnalytics.id, analyticsId));
    }
  }
}