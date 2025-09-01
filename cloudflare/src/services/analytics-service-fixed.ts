import { drizzle } from 'drizzle-orm/d1';
import { eq, count, sum } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export class AnalyticsServiceFixed {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  /**
   * Get simple user dashboard
   */
  async getUserDashboard(userId: string): Promise<any> {
    try {
      console.log('Getting dashboard for user:', userId);
      
      // Get basic user info
      const user = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      console.log('User found:', user.length > 0);

      if (!user[0]) {
        console.log('User not found, returning default dashboard');
        return {
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalEarnings: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          successRate: 0,
          averageCompletionDays: 0,
          recentActivity: [],
          monthlyStats: []
        };
      }

      // Get basic stats with individual error handling
      let totalOrders = 0;
      let completedOrders = 0;
      let totalSpent = 0;
      let totalEarnings = 0;

      try {
        totalOrders = await this.getTotalOrders(userId);
        console.log('Total orders:', totalOrders);
      } catch (e) {
        console.error('Error getting total orders:', e);
      }

      try {
        completedOrders = await this.getCompletedOrders(userId);
        console.log('Completed orders:', completedOrders);
      } catch (e) {
        console.error('Error getting completed orders:', e);
      }

      try {
        totalSpent = await this.getTotalSpent(userId);
        console.log('Total spent:', totalSpent);
      } catch (e) {
        console.error('Error getting total spent:', e);
      }

      try {
        totalEarnings = await this.getTotalEarnings(userId);
        console.log('Total earnings:', totalEarnings);
      } catch (e) {
        console.error('Error getting total earnings:', e);
      }

      const dashboard = {
        totalOrders,
        completedOrders,
        cancelledOrders: 0,
        totalEarnings,
        totalSpent,
        averageOrderValue: totalOrders > 0 ? (totalSpent + totalEarnings) / totalOrders : 0,
        successRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
        averageCompletionDays: 0,
        recentActivity: [],
        monthlyStats: []
      };

      console.log('Dashboard result:', dashboard);
      return dashboard;
    } catch (error) {
      console.error('Error getting dashboard:', error);
      // Return default dashboard on error instead of throwing
      return {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalEarnings: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        successRate: 0,
        averageCompletionDays: 0,
        recentActivity: [],
        monthlyStats: []
      };
    }
  }

  private async getTotalOrders(userId: string): Promise<number> {
    try {
      // Check if user is contractor
      const contractorOrdersResult = await this.db
        .select({ count: count() })
        .from(schema.orders)
        .where(eq(schema.orders.contractorId, userId));

      // Check if user is customer
      const customerOrdersResult = await this.db
        .select({ count: count() })
        .from(schema.customerOrders)
        .where(eq(schema.customerOrders.customerId, userId));

      return (contractorOrdersResult[0]?.count || 0) + (customerOrdersResult[0]?.count || 0);
    } catch (error) {
      console.error('Error getting total orders:', error);
      return 0;
    }
  }

  private async getCompletedOrders(userId: string): Promise<number> {
    try {
      // Check contractor completed orders
      const contractorOrders = await this.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.contractorId, userId));

      const contractorCompletedCount = contractorOrders.filter(o => o.status === 'COMPLETED').length;

      // Check customer completed orders
      const customerOrdersData = await this.db
        .select()
        .from(schema.customerOrders)
        .innerJoin(schema.orders, eq(schema.customerOrders.orderId, schema.orders.id))
        .where(eq(schema.customerOrders.customerId, userId));

      const customerCompletedCount = customerOrdersData.filter(co => co.orders.status === 'COMPLETED').length;

      return contractorCompletedCount + customerCompletedCount;
    } catch (error) {
      console.error('Error getting completed orders:', error);
      return 0;
    }
  }

  private async getTotalSpent(userId: string): Promise<number> {
    try {
      const customerOrders = await this.db
        .select()
        .from(schema.customerOrders)
        .where(eq(schema.customerOrders.customerId, userId));

      return customerOrders.reduce((sum, co) => sum + co.contributedAmount, 0);
    } catch (error) {
      console.error('Error getting total spent:', error);
      return 0;
    }
  }

  private async getTotalEarnings(userId: string): Promise<number> {
    try {
      const completedMilestones = await this.db
        .select()
        .from(schema.milestones)
        .innerJoin(schema.orders, eq(schema.milestones.orderId, schema.orders.id))
        .where(eq(schema.orders.contractorId, userId));

      const completedOnly = completedMilestones.filter(m => m.milestones.status === 'COMPLETED');
      return completedOnly.reduce((sum, m) => sum + (m.milestones.amount * 0.8), 0);
    } catch (error) {
      console.error('Error getting total earnings:', error);
      return 0;
    }
  }

  /**
   * Get platform metrics
   */
  async getPlatformMetrics(): Promise<any> {
    try {
      const [totalOrdersResult, totalUsersResult] = await Promise.all([
        this.db.select({ count: count() }).from(schema.orders),
        this.db.select({ count: count() }).from(schema.users)
      ]);

      const totalOrders = totalOrdersResult[0]?.count || 0;
      const totalUsers = totalUsersResult[0]?.count || 0;

      // Get all orders to calculate metrics
      const allOrders = await this.db.select().from(schema.orders);
      const completedOrders = allOrders.filter(o => o.status === 'COMPLETED').length;
      const totalVolume = allOrders
        .filter(o => o.status === 'COMPLETED')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        totalVolume,
        platformRevenue: totalVolume * 0.1,
        averageOrderValue: totalOrders > 0 ? totalVolume / totalOrders : 0,
        activeUsers: totalUsers,
        newRegistrations: 0,
        userRetention: 0,
        orderCompletionRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
        averageCompletionTime: 0,
        disputeRate: 0,
        apiResponseTime: 0,
        uptime: 99.9,
        errorRate: 0
      };
    } catch (error) {
      console.error('Error getting platform metrics:', error);
      throw new Error('Failed to get platform metrics');
    }
  }
}