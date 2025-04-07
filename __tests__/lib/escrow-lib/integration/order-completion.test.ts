/**
 * Integration tests for order completion flow
 * These tests verify the entire lifecycle of an order from creation to completion
 */

import { EscrowManager, EscrowEvents } from '../../../../lib/escrow-lib/escrow-manager';
import { 
  UserType, 
  OrderStatus,
  MilestoneStatus,
  DocumentType, 
  ActStatus 
} from '../../../../lib/escrow-lib/interfaces';

// Mock dependencies
jest.mock('../../../../lib/escrow-lib/services/user-service');
jest.mock('../../../../lib/escrow-lib/services/order-service');
jest.mock('../../../../lib/escrow-lib/services/document-service');

describe('Order Completion Flow', () => {
  let escrowManager: EscrowManager;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    escrowManager = new EscrowManager();
  });
  
  it('should complete the full order lifecycle', async () => {
    // STEP 1: Create users (customer and contractor)
    const mockCustomer = {
      id: 'customer-1',
      name: 'Test Customer',
      email: 'customer@example.com',
      type: UserType.CUSTOMER,
      balance: '1000'
    };
    
    const mockContractor = {
      id: 'contractor-1',
      name: 'Test Contractor',
      email: 'contractor@example.com',
      type: UserType.CONTRACTOR,
      balance: '0'
    };
    
    (escrowManager as any).userService.createUser
      .mockResolvedValueOnce(mockCustomer)
      .mockResolvedValueOnce(mockContractor);
    
    const customer = await escrowManager.createUser(
      'Test Customer',
      'customer@example.com',
      UserType.CUSTOMER,
      '1000'
    );
    
    const contractor = await escrowManager.createUser(
      'Test Contractor',
      'contractor@example.com',
      UserType.CONTRACTOR
    );
    
    expect(customer).toEqual(mockCustomer);
    expect(contractor).toEqual(mockContractor);
    
    // STEP 2: Create an order with milestone
    const milestoneData = [
      {
        description: 'Complete project implementation',
        amount: '500',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    ];
    
    const mockOrder = {
      id: 'order-1',
      customerIds: [customer.id],
      isGroupOrder: false,
      title: 'Test Project',
      description: 'Project description',
      status: OrderStatus.CREATED,
      totalAmount: '500',
      fundedAmount: '0',
      createdAt: expect.any(Date),
      milestones: [
        {
          id: 'milestone-1',
          orderId: 'order-1',
          description: 'Complete project implementation',
          amount: '500',
          status: MilestoneStatus.PENDING,
          deadline: expect.any(Date)
        }
      ]
    };
    
    // Mock validation and creation
    (escrowManager as any).userService.isCustomer.mockResolvedValue(true);
    (escrowManager as any).orderService.createOrder.mockResolvedValue(mockOrder);
    
    const order = await escrowManager.createOrder(
      customer.id,
      'Test Project',
      'Project description',
      milestoneData
    );
    
    expect(order).toEqual(mockOrder);
    expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.ORDER_CREATED, mockOrder);
    
    // STEP 3: Customer funds the order
    const mockFundedOrder = {
      ...mockOrder,
      fundedAmount: '500',
      status: OrderStatus.FUNDED
    };
    
    (escrowManager as any).orderService.getOrder.mockResolvedValue(mockOrder);
    (escrowManager as any).orderService.contributeFunds.mockResolvedValue(mockFundedOrder);
    (escrowManager as any).userService.getUserById.mockResolvedValue(mockCustomer);
    
    const fundedOrder = await escrowManager.contributeFunds(order.id, customer.id, '500');
    
    expect(fundedOrder).toEqual(mockFundedOrder);
    expect(escrowManager.emit).toHaveBeenCalledWith(
      EscrowEvents.FUNDS_CONTRIBUTED, 
      expect.objectContaining({
        orderId: order.id,
        amount: '500'
      })
    );
    
    // STEP 4: Assign contractor to the order
    const mockAssignedOrder = {
      ...mockFundedOrder,
      contractorId: contractor.id,
      status: OrderStatus.IN_PROGRESS
    };
    
    (escrowManager as any).orderService.getOrder.mockResolvedValue(mockFundedOrder);
    (escrowManager as any).orderService.assignContractor.mockResolvedValue(mockAssignedOrder);
    
    const assignedOrder = await escrowManager.assignContractor(
      order.id, 
      contractor.id,
      'platform-user-1' // Platform user making the assignment
    );
    
    expect(assignedOrder).toEqual(mockAssignedOrder);
    expect(escrowManager.emit).toHaveBeenCalledWith(
      EscrowEvents.CONTRACTOR_ASSIGNED,
      expect.objectContaining({
        orderId: order.id,
        contractorId: contractor.id
      })
    );
    
    // STEP 5: Contractor completes work and creates deliverable
    const mockDeliverable = {
      id: 'doc-1',
      orderId: order.id,
      type: DocumentType.DELIVERABLE,
      name: 'Project Implementation',
      createdBy: contractor.id,
      content: 'Project implementation details and GitHub repo link',
      createdAt: expect.any(Date)
    };
    
    (escrowManager as any).documentService.createDocument.mockResolvedValue(mockDeliverable);
    
    const deliverable = await escrowManager.createDocument(
      order.id,
      DocumentType.DELIVERABLE,
      'Project Implementation',
      contractor.id,
      'Project implementation details and GitHub repo link'
    );
    
    expect(deliverable).toEqual(mockDeliverable);
    expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.DOCUMENT_CREATED, mockDeliverable);
    
    // STEP 6: Contractor submits act for milestone completion
    const mockMilestone = {
      ...mockOrder.milestones[0],
      status: MilestoneStatus.AWAITING_ACCEPTANCE
    };
    
    const mockAct = {
      id: 'act-1',
      orderId: order.id,
      milestoneId: 'milestone-1',
      type: DocumentType.ACT_OF_WORK,
      name: 'Project Completion Act',
      content: 'Acceptance of project deliverables',
      createdBy: contractor.id,
      status: ActStatus.CREATED,
      createdAt: expect.any(Date),
      signedBy: [],
      deliverableIds: ['doc-1']
    };
    
    (escrowManager as any).orderService.getMilestone.mockResolvedValue(mockMilestone);
    (escrowManager as any).documentService.createAct.mockResolvedValue(mockAct);
    
    const act = await escrowManager.createAct(
      'milestone-1',
      'Project Completion Act',
      'Acceptance of project deliverables',
      contractor.id,
      ['doc-1']
    );
    
    expect(act).toEqual(mockAct);
    expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.ACT_CREATED, mockAct);
    
    // STEP 7: Customer signs the act
    const mockSignedAct = {
      ...mockAct,
      status: ActStatus.COMPLETED,
      signedBy: [
        {
          userId: customer.id,
          signedAt: expect.any(Date)
        }
      ]
    };
    
    const mockCompletedMilestone = {
      ...mockMilestone,
      status: MilestoneStatus.COMPLETED
    };
    
    const mockUpdatedContractor = {
      ...mockContractor,
      balance: '500' // Paid for the milestone
    };
    
    (escrowManager as any).documentService.getAct.mockResolvedValue(mockAct);
    (escrowManager as any).documentService.signAct.mockResolvedValue(mockSignedAct);
    (escrowManager as any).orderService.completeMilestone.mockResolvedValue(mockCompletedMilestone);
    (escrowManager as any).userService.updateUserBalance.mockResolvedValue(mockUpdatedContractor);
    
    const signedAct = await escrowManager.signAct(act.id, customer.id);
    
    expect(signedAct).toEqual(mockSignedAct);
    expect(escrowManager.emit).toHaveBeenCalledWith(EscrowEvents.ACT_SIGNED, mockSignedAct);
    expect(escrowManager.emit).toHaveBeenCalledWith(
      EscrowEvents.ACT_COMPLETED, 
      expect.objectContaining({
        actId: act.id,
        milestoneId: 'milestone-1'
      })
    );
    expect(escrowManager.emit).toHaveBeenCalledWith(
      EscrowEvents.MILESTONE_STATUS_CHANGED,
      expect.objectContaining({
        milestoneId: 'milestone-1',
        status: MilestoneStatus.COMPLETED
      })
    );
    
    // Verify contractor payment
    expect((escrowManager as any).userService.updateUserBalance).toHaveBeenCalledWith(
      contractor.id,
      '500'
    );
  });
});
