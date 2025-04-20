/**
 * Mock for database module to use in tests
 */

export const db = {
  transaction: jest.fn(),
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

export const schema = {
  users: {
    id: 'id',
    name: 'name',
    email: 'email',
    type: 'type',
    balance: 'balance'
  },
  orders: {
    id: 'id',
    customerId: 'customerId',
    contractorId: 'contractorId',
    title: 'title',
    description: 'description',
    status: 'status',
    isGroup: 'isGroup',
    createdAt: 'createdAt'
  },
  milestones: {
    id: 'id',
    orderId: 'orderId',
    title: 'title',
    description: 'description',
    amount: 'amount',
    status: 'status',
    dueDate: 'dueDate',
    completedAt: 'completedAt'
  },
  documents: {
    id: 'id',
    orderId: 'orderId',
    type: 'type',
    name: 'name',
    content: 'content',
    status: 'status',
    createdAt: 'createdAt',
    approvedBy: 'approvedBy',
    approvedAt: 'approvedAt'
  },
  acts: {
    id: 'id',
    orderId: 'orderId',
    milestoneId: 'milestoneId',
    name: 'name',
    description: 'description',
    amount: 'amount',
    status: 'status',
    createdAt: 'createdAt',
    signedBy: 'signedBy',
    signedAt: 'signedAt'
  }
};
