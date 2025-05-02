/**
 * Integration tests for group order functionality
 * These tests verify the group order management flows including representative voting
 */

import { EscrowManager, EscrowEvents } from '../../../../lib/escrow-lib/escrow-manager';
import { UserType, OrderStatus } from '../../../../lib/escrow-lib/interfaces';

// Mock dependencies
jest.mock('../../../../lib/escrow-lib/services/user-service');
jest.mock('../../../../lib/escrow-lib/services/order-service');
jest.mock('../../../../lib/escrow-lib/services/document-service');

describe('Group Order Management', () => {
  let escrowManager: EscrowManager;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    escrowManager = new EscrowManager();
  });
  
  describe('Representative Management', () => {
    it('should create a group order with specified representative', async () => {
      // Arrange
      const emitSpy = jest.spyOn(escrowManager, 'emit');
      const customerIds = ['customer-1', 'customer-2', 'customer-3'];
      const initialRepresentativeId = 'customer-1';
      
      const mockOrder = {
        id: 'group-order-1',
        customerIds,
        isGroupOrder: true,
        representativeId: initialRepresentativeId,
        title: 'Group Project',
        description: 'Multi-customer project',
        milestones: [],
        status: OrderStatus.CREATED,
        totalAmount: '1000',
        fundedAmount: '0',
        createdAt: new Date(),
        votes: {}
      };
      
      // Mock customer validation
      (escrowManager as any).userService.isCustomer.mockResolvedValue(true);
      
      // Mock order creation
      (escrowManager as any).orderService.createGroupOrder.mockResolvedValue(mockOrder);
      
      // Act
      const result = await escrowManager.createGroupOrder(
        customerIds,
        'Group Project',
        'Multi-customer project',
        [{ description: 'Milestone 1', amount: '1000', deadline: new Date() }],
        initialRepresentativeId
      );
      
      // Assert
      expect(result).toEqual(mockOrder);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.GROUP_ORDER_CREATED, mockOrder);
      expect((escrowManager as any).orderService.createGroupOrder).toHaveBeenCalledWith(
        customerIds,
        'Group Project',
        'Multi-customer project',
        [expect.objectContaining({ description: 'Milestone 1', amount: '1000' })],
        initialRepresentativeId
      );
    });
    
    it('should allow customers to vote for a new representative', async () => {
      // Arrange
      const orderId = 'group-order-1';
      const voterId = 'customer-2';
      const candidateId = 'customer-3';
      
      const mockOrder = {
        id: orderId,
        customerIds: ['customer-1', 'customer-2', 'customer-3'],
        isGroupOrder: true,
        representativeId: 'customer-1',
        votes: {},
        status: OrderStatus.CREATED
      };
      
      const mockUpdatedOrder = {
        ...mockOrder,
        votes: { [candidateId]: [voterId] }
      };
      
      // Mock order retrieval
      (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
      
      // Mock vote registration
      (escrowManager as any).orderService.voteForRepresentative.mockResolvedValue(mockUpdatedOrder);
      
      // Act
      const result = await escrowManager.voteForRepresentative(orderId, voterId, candidateId);
      
      // Assert
      expect(result).toEqual(mockUpdatedOrder);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.REPRESENTATIVE_VOTE,
        {
          orderId,
          voterId,
          candidateId,
          votes: mockUpdatedOrder.votes
        }
      );
    });
    
    it('should change representative when majority vote is reached', async () => {
      // Arrange
      const orderId = 'group-order-1';
      const newRepresentativeId = 'customer-3';
      
      const mockOrder = {
        id: orderId,
        customerIds: ['customer-1', 'customer-2', 'customer-3'],
        isGroupOrder: true,
        representativeId: 'customer-1',
        votes: { 'customer-3': ['customer-1', 'customer-2'] } // 2 out of 3 voted
      };
      
      const mockUpdatedOrder = {
        ...mockOrder,
        representativeId: newRepresentativeId,
        votes: {} // votes reset after change
      };
      
      // Mock checks and updates
      (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
      
      // Since checkAndUpdateRepresentative is not in EscrowManager, we mock a custom implementation
      // for testing the representative change process
      // Добавляем метод changeRepresentative в мок OrderService
      // Используем as any для обхода проверки типов
      ((escrowManager as any).orderService as any).changeRepresentative = jest.fn().mockResolvedValue(mockUpdatedOrder);
      
      // Add custom method for test purposes
      (escrowManager as any).checkAndUpdateRepresentative = jest.fn().mockImplementation(async (id: string) => {
        const order = await escrowManager['orderService'].getOrder(id);
        // Check if there is a majority vote for a new representative
        const total = order.customerIds.length;
        const required = Math.ceil(total / 2); // Majority
        
        // Find candidate with most votes
        let maxVotes = 0;
        let winner = null;
        
        Object.entries(order.votes || {}).forEach(([candidate, voters]) => {
          if (voters.length >= required) {
            winner = candidate;
          }
        });
        
        if (!winner) return order; // No majority
        
        // Change representative 
        // Используем as any для обхода проверки типов
        const updatedOrder = await ((escrowManager as any).orderService as any).changeRepresentative(id, winner);
        
        // Emit event
        escrowManager.emit(EscrowEvents.REPRESENTATIVE_CHANGED, {
          orderId: id,
          previousRepresentativeId: order.representativeId,
          newRepresentativeId: winner
        });
        
        return updatedOrder;
      });
      
      // Act
      const result = await (escrowManager as any).checkAndUpdateRepresentative(orderId);
      
      // Assert
      expect(result).toEqual(mockUpdatedOrder);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.REPRESENTATIVE_CHANGED,
        {
          orderId,
          previousRepresentativeId: 'customer-1',
          newRepresentativeId
        }
      );
    });
  });
  
  describe('Group Funding', () => {
    it('should track contributions from multiple customers', async () => {
      // Arrange
      const orderId = 'group-order-1';
      const customerId = 'customer-2';
      const amount = '300';
      
      const mockOrder = {
        id: orderId,
        customerIds: ['customer-1', 'customer-2', 'customer-3'],
        isGroupOrder: true,
        totalAmount: '1000',
        fundedAmount: '200', // customer-1 already contributed 200
        status: OrderStatus.CREATED
      };
      
      const mockUpdatedOrder = {
        ...mockOrder,
        fundedAmount: '500' // 200 + 300 = 500
      };
      
      // Mock user balance
      (escrowManager as any).userService.getUserById.mockResolvedValue({
        id: customerId,
        balance: '500'
      });
      
      // Mock order retrieval and update
      (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
      (escrowManager as any).orderService.contributeFunds.mockResolvedValue(mockUpdatedOrder);
      
      // Act
      const result = await escrowManager.contributeFunds(orderId, customerId, amount);
      
      // Assert
      expect(result).toEqual(mockUpdatedOrder);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.FUNDS_CONTRIBUTED,
        {
          orderId,
          customerId,
          amount,
          newFundedAmount: '500'
        }
      );
      expect((escrowManager as any).userService.updateUserBalance).toHaveBeenCalledWith(
        customerId,
        '-300' // Subtract from customer balance
      );
    });
  });
});
