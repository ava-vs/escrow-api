/**
 * Tests for the Document Service
 * These tests verify the functionality of the document management service
 */

import { DocumentService } from '../../../../lib/escrow-lib/services/document-service';
import { OrderService } from '../../../../lib/escrow-lib/services/order-service';
import { DocumentType, ActStatus, OrderStatus } from '../../../../lib/escrow-lib/interfaces';
import { db } from '../../../../lib/db';

// Mock dependencies
jest.mock('../../../../lib/db', () => ({
  db: {
    transaction: jest.fn(),
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

// Создаем мок-класс для OrderService с дополнительными методами
class MockOrderService {
  getOrder = jest.fn();
  getMilestone = jest.fn();
  createOrder = jest.fn();
  getOrderMilestone = jest.fn();
}

jest.mock('../../../../lib/escrow-lib/services/order-service', () => ({
  OrderService: jest.fn().mockImplementation(() => new MockOrderService())
}));

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockOrderService: jest.Mocked<OrderService>;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a mock OrderService
    mockOrderService = new OrderService() as any;
    
    // Create DocumentService with the mock OrderService
    documentService = new DocumentService(mockOrderService);
    
    // Setup transaction mock to execute the callback
    (db.transaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(db);
    });
  });
  
  describe('createDocument', () => {
    it('should create a document with correct data', async () => {
      // Arrange
      const mockDocumentId = 'doc-123';
      const mockDocument = {
        id: mockDocumentId,
        orderId: 'order-123',
        type: DocumentType.ROADMAP,
        name: 'Test Document',
        content: 'Test content',
        createdBy: 'user-123',
        createdAt: expect.any(Date)
      };
      
      // Mock order exists check
      mockOrderService.getOrder.mockResolvedValue({
        id: 'order-123',
        customerIds: ['customer-1'],
        isGroupOrder: false,
        title: 'Test Order',
        description: 'Test Order Description',
        milestones: [],
        status: OrderStatus.CREATED,
        totalAmount: '0',
        fundedAmount: '0',
        createdAt: new Date()
      });
      
      // Mock document creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: mockDocumentId }]);
      
      // Mock document retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockDocument]);
      
      // Act
      const result = await documentService.createDocument(
        'order-123',
        DocumentType.ROADMAP,
        'Test Document',
        'user-123',
        'Test content'
      );
      
      // Assert
      expect(result).toEqual(mockDocument);
      expect(mockOrderService.getOrder).toHaveBeenCalledWith('order-123');
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error if order not found', async () => {
      // Arrange
      // Возвращаем null без Promise.resolve, так как mockResolvedValue уже возвращает Promise
      mockOrderService.getOrder.mockResolvedValue(null as any);
      
      // Act & Assert
      await expect(
        documentService.createDocument(
          'non-existent-order',
          DocumentType.ROADMAP,
          'Test Document',
          'user-123',
          'Test content'
        )
      ).rejects.toThrow('Order not found: non-existent-order');
    });
  });
  
  describe('approveDocument', () => {
    it('should approve a document', async () => {
      // Arrange
      const mockDocument = {
        id: 'doc-123',
        orderId: 'order-123',
        type: DocumentType.ROADMAP,
        name: 'Test Document',
        content: 'Test content',
        createdBy: 'creator-123',
        createdAt: new Date(),
        approvedBy: []
      };
      
      const mockUpdatedDocument = {
        ...mockDocument,
        approvedBy: ['user-123']
      };
      
      // Mock document retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockDocument]);
      
      // Mock document update
      (db.update as jest.Mock).mockResolvedValueOnce({ success: true });
      
      // Mock updated document retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockUpdatedDocument]);
      
      // Act
      const result = await documentService.approveDocument('doc-123', 'user-123');
      
      // Assert
      expect(result).toEqual(mockUpdatedDocument);
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
    
    it('should throw error if document not found', async () => {
      // Arrange
      (db.select as jest.Mock).mockResolvedValueOnce([]);
      
      // Act & Assert
      await expect(
        documentService.approveDocument('non-existent-doc', 'user-123')
      ).rejects.toThrow('Document not found: non-existent-doc');
    });
  });
  
  describe('createAct', () => {
    it('should create an act for a milestone', async () => {
      // Arrange
      const mockActId = 'act-123';
      const mockAct = {
        id: mockActId,
        orderId: 'order-123',
        milestoneId: 'milestone-123',
        type: DocumentType.ACT_OF_WORK,
        name: 'Test Act',
        content: {
          description: 'Test act description',
          amount: '100'
        },
        status: ActStatus.CREATED,
        createdBy: 'user-123',
        createdAt: expect.any(Date)
      };
      
      // Используем метод getMilestone из OrderService (добавим его, если его нет)
      // Для tests мы можем просто добавить этот метод на mock объект
      (mockOrderService as any).getMilestone = jest.fn().mockResolvedValue({
        id: 'milestone-123',
        orderId: 'order-123',
        description: 'Test Milestone',
        amount: '100',
        status: 'PENDING'
      });
      
      // Mock act creation
      (db.insert as jest.Mock).mockResolvedValueOnce([{ id: mockActId }]);
      
      // Mock act retrieval
      (db.select as jest.Mock).mockResolvedValueOnce([mockAct]);
      
      // Act
      // В реальной реализации этот метод может требовать orderId, milestoneId, userId, name и description
      // Адаптируем вызов под актуальную сигнатуру
      // Используем as any, чтобы обойти проблемы с типизацией в аргументах
      const result = await documentService.createAct(
        'order-123',
        'milestone-123',
        ['user-123'],
        'Test Act',
        'Test act description'
      ) as any;
      
      // Assert
      expect(result).toEqual(mockAct);
      // Используем as any, чтобы обойти проблемы с типизацией в тестах
      expect((mockOrderService as any).getMilestone).toHaveBeenCalledWith('milestone-123');
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });
});
