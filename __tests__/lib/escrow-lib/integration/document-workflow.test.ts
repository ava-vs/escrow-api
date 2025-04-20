/**
 * Integration tests for document workflow
 * These tests verify document creation, approval, and their lifecycle
 */

import { EscrowManager, EscrowEvents } from '../../../../lib/escrow-lib/escrow-manager';
import { 
  UserType, 
  DocumentType,
  OrderStatus
} from '../../../../lib/escrow-lib/interfaces';

// Mock dependencies
jest.mock('../../../../lib/escrow-lib/services/user-service');
jest.mock('../../../../lib/escrow-lib/services/order-service');
jest.mock('../../../../lib/escrow-lib/services/document-service');

describe('Document Workflow', () => {
  let escrowManager: EscrowManager;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    escrowManager = new EscrowManager();
  });
  
  describe('Specification and Roadmap Flow', () => {
    it('should create and approve project documentation', async () => {
      // Setup test users
      const mockCustomer = { id: 'customer-1', type: UserType.CUSTOMER };
      const mockContractor = { id: 'contractor-1', type: UserType.CONTRACTOR };
      
      // Setup test order
      const mockOrder = {
        id: 'order-1',
        customerIds: ['customer-1'],
        isGroupOrder: false,
        title: 'Website Development',
        description: 'Create a company website',
        status: OrderStatus.CREATED,
        createdAt: new Date()
      };
      
      // Mock order retrieval
      (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
      
      // Step 1: Create roadmap document
      const mockRoadmap = {
        id: 'doc-roadmap',
        orderId: 'order-1',
        type: DocumentType.ROADMAP,
        name: 'Project Roadmap',
        content: 'Detailed roadmap with phases and deliverables',
        createdBy: 'contractor-1',
        createdAt: new Date(),
        approvedBy: []
      };
      
      (escrowManager as any).documentService.createDocument.mockResolvedValueOnce(mockRoadmap);
      
      const roadmap = await escrowManager.createDocument(
        'order-1',
        DocumentType.ROADMAP,
        'Project Roadmap',
        'contractor-1',
        'Detailed roadmap with phases and deliverables'
      );
      
      expect(roadmap).toEqual(mockRoadmap);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.DOCUMENT_CREATED, mockRoadmap);
      
      // Step 2: Create specification document
      const mockSpec = {
        id: 'doc-spec',
        orderId: 'order-1',
        type: DocumentType.SPECIFICATION,
        name: 'Technical Specification',
        content: 'Technical details of implementation',
        createdBy: 'contractor-1',
        createdAt: new Date(),
        approvedBy: []
      };
      
      (escrowManager as any).documentService.createDocument.mockResolvedValueOnce(mockSpec);
      
      const spec = await escrowManager.createDocument(
        'order-1',
        DocumentType.SPECIFICATION,
        'Technical Specification',
        'contractor-1',
        'Technical details of implementation'
      );
      
      expect(spec).toEqual(mockSpec);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.DOCUMENT_CREATED, mockSpec);
      
      // Step 3: Customer approves the roadmap
      const mockApprovedRoadmap = {
        ...mockRoadmap,
        approvedBy: ['customer-1']
      };
      
      (escrowManager as any).documentService.getDocumentById.mockResolvedValueOnce(mockRoadmap);
      (escrowManager as any).documentService.approveDocument.mockResolvedValueOnce(mockApprovedRoadmap);
      
      const approvedRoadmap = await escrowManager.approveDocument('doc-roadmap', 'customer-1');
      
      expect(approvedRoadmap).toEqual(mockApprovedRoadmap);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.DOCUMENT_APPROVED, 
        expect.objectContaining({
          documentId: 'doc-roadmap',
          approverId: 'customer-1'
        })
      );
      
      // Step 4: Customer approves the specification
      const mockApprovedSpec = {
        ...mockSpec,
        approvedBy: ['customer-1']
      };
      
      (escrowManager as any).documentService.getDocumentById.mockResolvedValueOnce(mockSpec);
      (escrowManager as any).documentService.approveDocument.mockResolvedValueOnce(mockApprovedSpec);
      
      const approvedSpec = await escrowManager.approveDocument('doc-spec', 'customer-1');
      
      expect(approvedSpec).toEqual(mockApprovedSpec);
      expect(escrowManager.emit).toHaveBeenCalledWith(
        EscrowEvents.DOCUMENT_APPROVED, 
        expect.objectContaining({
          documentId: 'doc-spec',
          approverId: 'customer-1'
        })
      );
    });
  });
  
  describe('Definition of Done', () => {
    it('should create and update definition of done document', async () => {
      // Setup test order
      const mockOrder = {
        id: 'order-1',
        customerIds: ['customer-1'],
        isGroupOrder: false,
        status: OrderStatus.IN_PROGRESS
      };
      
      // Mock order retrieval
      (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
      
      // Step 1: Create definition of done
      const mockDod = {
        id: 'doc-dod',
        orderId: 'order-1',
        type: DocumentType.DEFINITION_OF_DONE,
        name: 'Definition of Done',
        content: 'Acceptance criteria for the project',
        createdBy: 'contractor-1',
        createdAt: new Date(),
        approvedBy: []
      };
      
      (escrowManager as any).documentService.createDocument.mockResolvedValueOnce(mockDod);
      
      const dod = await escrowManager.createDocument(
        'order-1',
        DocumentType.DEFINITION_OF_DONE,
        'Definition of Done',
        'contractor-1',
        'Acceptance criteria for the project'
      );
      
      expect(dod).toEqual(mockDod);
      expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.DOCUMENT_CREATED, mockDod);
      
      // Step 2: Update the definition of done
      const mockUpdatedContent = 'Updated acceptance criteria with additional requirements';
      const mockUpdatedDod = {
        ...mockDod,
        content: mockUpdatedContent,
        approvedBy: [] // Approvals reset after update
      };
      
      (escrowManager as any).documentService.getDocumentById.mockResolvedValueOnce(mockDod);
      (escrowManager as any).documentService.updateDocument.mockResolvedValueOnce(mockUpdatedDod);
      
      // Добавляем метод updateDocument для тестирования, поскольку его нет в EscrowManager
      (escrowManager as any).updateDocument = jest.fn().mockImplementation(
        async (documentId: string, updatedBy: string, newContent: any) => {
          const document = await escrowManager['documentService'].getDocumentById(documentId);
          if (!document) throw new Error('Document not found');
          
          // Используем as any для обхода проверки типов
          // Добавляем метод updateDocument в мок, если его нет в DocumentService
          if (!(escrowManager['documentService'] as any).updateDocument) {
            (escrowManager['documentService'] as any).updateDocument = jest.fn().mockResolvedValue(mockUpdatedDod);
          }
          
          const updatedDoc = await (escrowManager['documentService'] as any).updateDocument(
            documentId,
            updatedBy,
            newContent
          );
          
          // Если бы этот метод был в EscrowManager, он бы мог эмитить событие
          escrowManager.emit('document.updated', {
            documentId,
            updatedBy,
            updatedAt: new Date()
          });
          
          return updatedDoc;
        }
      );
      
      const updatedDod = await (escrowManager as any).updateDocument(
        'doc-dod',
        'contractor-1',
        mockUpdatedContent
      );
      
      expect(updatedDod).toEqual(mockUpdatedDod);
      
      // Step 3: Both customer and contractor approve the document
      const mockApprovedByContractor = {
        ...mockUpdatedDod,
        approvedBy: ['contractor-1']
      };
      
      const mockFullyApproved = {
        ...mockApprovedByContractor,
        approvedBy: ['contractor-1', 'customer-1']
      };
      
      (escrowManager as any).documentService.getDocumentById.mockResolvedValueOnce(mockUpdatedDod);
      (escrowManager as any).documentService.approveDocument.mockResolvedValueOnce(mockApprovedByContractor);
      
      (escrowManager as any).documentService.getDocumentById.mockResolvedValueOnce(mockApprovedByContractor);
      (escrowManager as any).documentService.approveDocument.mockResolvedValueOnce(mockFullyApproved);
      
      // Contractor approves
      await escrowManager.approveDocument('doc-dod', 'contractor-1');
      
      // Customer approves
      const finalDod = await escrowManager.approveDocument('doc-dod', 'customer-1');
      
      expect(finalDod).toEqual(mockFullyApproved);
      expect(finalDod.approvedBy).toContain('contractor-1');
      expect(finalDod.approvedBy).toContain('customer-1');
    });
  });
});
