/**
 * Tests for the Order Service
 * These tests verify the functionality of the order management service
 */

import { OrderService, IMilestoneInputData } from '../../../../lib/escrow-lib/services/order-service';
import { OrderStatus, MilestoneStatus } from '../../../../lib/escrow-lib/interfaces';
import { db } from '../../../../lib/db';

// Mock the database
jest.mock('../../../../lib/db', () => ({
  db: {
    transaction: jest.fn(),
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

describe('OrderService', () => {
  let orderService: OrderService;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    orderService = new OrderService();
    
    // Setup transaction mock to execute the callback
    (db.transaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(db);
    });
  });
  
  describe('createOrder', () => {
    it('should create an order with milestones', async () => {
      // Arrange
      const mockOrderId = 'order-123';
      const mockOrder = {
        id: mockOrderId,
        customerId: 'customer-123',
        title: 'Test Order',
        description: 'Test Description',
        status: OrderStatus.CREATED,
        isGroup: false,
        createdAt: expect.any(Date)
      };
      
      const milestoneInputs: IMilestoneInputData[] = [
        {
          description: 'Description 1',
          amount: '100',
          deadline: new Date()
        }
      ];
      
      const mockMilestones = [
        {
          id: 'milestone-1',
          orderId: mockOrderId,
          title: 'Milestone 1',
          description: 'Description 1',
          amount: '100',
          status: MilestoneStatus.PENDING,
          dueDate: expect.any(Date),
          completedAt: null
        }
      ];
      
      // Mock order creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: mockOrderId }]);
      
      // Mock milestone creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: 'milestone-1' }]);
      
      // Mock order retrieval with milestones
      (db.select as jest.Mock).mockResolvedValueOnce([mockOrder]);
      (db.select as jest.Mock).mockResolvedValueOnce(mockMilestones);
      
      // Act
      const result = await orderService.createOrder(
        'customer-123',
        'Test Order',
        'Test Description',
        milestoneInputs
      );
      
      // Assert
      expect(result).toEqual({
        ...mockOrder,
        milestones: mockMilestones
      });
      expect(db.insert).toHaveBeenCalledTimes(2); // Once for order, once for milestone
      expect(db.select).toHaveBeenCalledTimes(2); // Once for order, once for milestones
    });
  });
  
  describe('createGroupOrder', () => {
    it('should create a group order with multiple customers', async () => {
      // Arrange
      const mockOrderId = 'order-group-123';
      const customerIds = ['customer-1', 'customer-2', 'customer-3'];
      
      const mockOrder = {
        id: mockOrderId,
        title: 'Group Order',
        description: 'Group Description',
        status: OrderStatus.CREATED,
        isGroup: true,
        createdAt: expect.any(Date)
      };
      
      const milestoneInputs: IMilestoneInputData[] = [
        {
          description: 'Group Milestone Description',
          amount: '300',
          deadline: new Date()
        }
      ];
      
      // Mock order creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: mockOrderId }]);
      
      // Mock customer-order relations creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ success: true }]);
      
      // Mock representative assignment
      (db.insert as jest.Mock).mockResolvedValueOnce([{ success: true }]);
      
      // Mock milestone creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: 'milestone-group-1' }]);
      
      // Mock order retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockOrder]);
      
      // Mock milestones retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([
        {
          id: 'milestone-group-1',
          orderId: mockOrderId,
          title: 'Group Milestone',
          description: 'Group Milestone Description',
          amount: '300',
          status: MilestoneStatus.PENDING,
          dueDate: expect.any(Date),
          completedAt: null
        }
      ]);
      
      // Mock customers retrieval
      (db.select as jest.Mock).mockResolvedValueOnce(
        customerIds.map(id => ({ id, name: `Customer ${id}` }))
      );
      
      // Act
      const result = await orderService.createGroupOrder(
        customerIds,
        'Group Order',
        'Group Description',
        milestoneInputs,
        'customer-1'
      );
      
      // Assert
      expect(result).toEqual({
        ...mockOrder,
        milestones: expect.any(Array),
        customers: expect.any(Array),
        representativeId: 'customer-1'
      });
      
      expect(db.insert).toHaveBeenCalledTimes(4); // Order, customer relations, representative, milestones
    });
  });
  
  describe('assignContractor', () => {
    it('should assign a contractor to an order', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        customerId: 'customer-123',
        title: 'Test Order',
        status: OrderStatus.CREATED,
        isGroup: false
      };
      
      const mockUpdatedOrder = {
        ...mockOrder,
        contractorId: 'contractor-123',
        status: OrderStatus.IN_PROGRESS
      };
      
      // Mock order retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockOrder]);
      
      // Mock order update
      (db.update as jest.Mock).mockResolvedValueOnce({ success: true });
      
      // Mock updated order retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockUpdatedOrder]);
      
      // Mock empty milestones
      (db.select as jest.Mock).mockResolvedValueOnce([]);
      
      // Act
      const result = await orderService.assignContractor('order-123', 'contractor-123', 'platform-123');
      
      // Assert
      expect(result).toEqual({
        ...mockUpdatedOrder,
        milestones: []
      });
      expect(db.update).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error if order not found', async () => {
      // Arrange
      (db.select as jest.Mock).mockResolvedValueOnce([]);
      
      // Act & Assert
      await expect(
        orderService.assignContractor('non-existent-order', 'contractor-123', 'platform-user-123')
      ).rejects.toThrow('Order not found: non-existent-order');
    });
  });
});
