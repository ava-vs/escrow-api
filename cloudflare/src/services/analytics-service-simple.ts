import { drizzle } from 'drizzle-orm/d1';
import { eq, count } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export class AnalyticsServiceSimple {
    private db;

    constructor(private env: Env) {
        this.db = drizzle(env.DB);
    }

    /**
     * Get simple user dashboard
     */
    async getUserDashboard(userId: string): Promise<any> {
        try {
            // Get basic user info
            const user = await this.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, userId))
                .limit(1);

            if (!user[0]) {
                throw new Error('User not found');
            }

            // Get basic stats
            const totalOrders = await this.getTotalOrders(userId);
            const completedOrders = await this.getCompletedOrders(userId);
            const totalSpent = await this.getTotalSpent(userId);
            const totalEarnings = await this.getTotalEarnings(userId);

            return {
                totalOrders,
                completedOrders,
                cancelledOrders: 0,
                totalEarnings,
                totalSpent,
                averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
                successRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
                averageCompletionDays: 0,
                recentActivity: [],
                monthlyStats: []
            };
        } catch (error) {
            console.error('Error getting dashboard:', error);
            throw new Error('Failed to get dashboard');
        }
    }

    private async getTotalOrders(userId: string): Promise<number> {
        try {
            // Check if user is contractor
            const contractorOrders = await this.db
                .select({ count: count() })
                .from(schema.orders)
                .where(eq(schema.orders.contractorId, userId));

            // Check if user is customer
            const customerOrders = await this.db
                .select({ count: count() })
                .from(schema.customerOrders)
                .where(eq(schema.customerOrders.customerId, userId));

            return (contractorOrders[0]?.count || 0) + (customerOrders[0]?.count || 0);
        } catch (error) {
            console.error('Error getting total orders:', error);
            return 0;
        }
    }

    private async getCompletedOrders(userId: string): Promise<number> {
        try {
            // Check contractor completed orders
            const contractorCompleted = await this.db
                .select({ count: count() })
                .from(schema.orders)
                .where(eq(schema.orders.contractorId, userId));

            const completedContractorOrders = await this.db
                .select()
                .from(schema.orders)
                .where(eq(schema.orders.contractorId, userId));

            const contractorCompletedCount = completedContractorOrders.filter(o => o.status === 'COMPLETED').length;

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
            const totalOrdersResult = await this.db.select({ count: count() }).from(schema.orders);
            const completedOrdersResult = await this.db
                .select()
                .from(schema.orders);

            const totalOrders = totalOrdersResult[0]?.count || 0;
            const allOrders = completedOrdersResult || [];
            const completedOrders = allOrders.filter(o => o.status === 'COMPLETED').length;
            const totalVolume = allOrders
                .filter(o => o.status === 'COMPLETED')
                .reduce((sum, o) => sum + o.totalAmount, 0);

            const totalUsersResult = await this.db.select({ count: count() }).from(schema.users);
            const totalUsers = totalUsersResult[0]?.count || 0;

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