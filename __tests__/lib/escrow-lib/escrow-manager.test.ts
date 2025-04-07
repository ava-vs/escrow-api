/**
 * Tests for the Escrow Manager class
 * These tests verify the core functionality of the escrow system
 */

import { EscrowManager, EscrowEvents } from '../../../lib/escrow-lib/escrow-manager';
import { UserType, DocumentType } from '../../../lib/escrow-lib/interfaces';

// Mock dependencies
jest.mock('../../../lib/escrow-lib/services/user-service');
jest.mock('../../../lib/escrow-lib/services/order-service');
jest.mock('../../../lib/escrow-lib/services/document-service');

describe('EscrowManager', () => {
  let escrowManager: EscrowManager;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    escrowManager = new EscrowManager();
  });
  
  // Test user management functions
  describe('User Management', () => {
    it('should create a user and emit event', async () => {
      // Arrange
      const emitSpy = jest.spyOn(escrowManager, 'emit');
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '0'
      };
      
      // Override the implementation of userService.createUser for this test
      (escrowManager as any).userService.createUser.mockResolvedValue(mockUser);
      
      // Act
      const result = await escrowManager.createUser(
        'Test User',
        'test@example.com',
        UserType.CUSTOMER
      );
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.USER_CREATED, mockUser);
      expect((escrowManager as any).userService.createUser).toHaveBeenCalledWith(
        'Test User',
        'test@example.com',
        UserType.CUSTOMER,
        '0'
      );
    });
    
    it('should get user by ID', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '0'
      };
      
      (escrowManager as any).userService.getUserById.mockResolvedValue(mockUser);
      
      // Act
      const result = await escrowManager.getUser('user-1');
      
      // Assert
      expect(result).toEqual(mockUser);
      expect((escrowManager as any).userService.getUserById).toHaveBeenCalledWith('user-1');
    });
    
    it('should update user balance and emit event', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '100'
      };
      
      (escrowManager as any).userService.updateUserBalance.mockResolvedValue(mockUser);
      
      // Act
      const result = await escrowManager.updateUserBalance('user-1', '100');
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.USER_BALANCE_UPDATED,
        { userId: 'user-1', amount: '100', newBalance: '100' }
      );
    });
  });
  
  // Test order management functions
  describe('Order Management', () => {
    it('should create an order and emit event', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        customerId: 'user-1',
        title: 'Test Order',
        description: 'Test Description',
        milestones: [],
        status: 'CREATED',
        createdAt: new Date()
      };
      
      (escrowManager as any).userService.isCustomer.mockResolvedValue(true);
      (escrowManager as any).orderService.createOrder.mockResolvedValue(mockOrder);
      
      // Act
      const result = await escrowManager.createOrder(
        'user-1',
        'Test Order',
        'Test Description',
        []
      );
      
      // Assert
      expect(result).toEqual(mockOrder);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.ORDER_CREATED, mockOrder);
    });
    
    it('should fail to create order if user is not a customer', async () => {
      // Arrange
      (escrowManager as any).userService.isCustomer.mockResolvedValue(false);
      
      // Act & Assert
      await expect(
        escrowManager.createOrder('user-1', 'Test Order', 'Test Description', [])
      ).rejects.toThrow('User user-1 is not a Customer');
    });
  });
  
  // Test document management
  describe('Document Management', () => {
    it('should create a document and emit event', async () => {
      // Arrange
      const mockDocument = {
        id: 'doc-1',
        orderId: 'order-1',
        type: DocumentType.ROADMAP,
        name: 'Test Document',
        content: 'Test content',
        createdBy: 'user-1',
        createdAt: new Date()
      };
      
      (escrowManager as any).documentService.createDocument.mockResolvedValue(mockDocument);
      
      // Act
      const result = await escrowManager.createDocument(
        'order-1',
        DocumentType.ROADMAP,
        'Test Document',
        'user-1',
        'Test content'
      );
      
      // Assert
      expect(result).toEqual(mockDocument);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.DOCUMENT_CREATED, mockDocument);
    });
  });
});
