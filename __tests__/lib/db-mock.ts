/**
 * Mock implementation for database interactions in tests
 * This allows us to avoid actual DB connections during tests
 */

// No need to import jest from @jest/globals as it's globally available in Jest environment

// Mock basic DB operations
export const db = {
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockResolvedValue({ insertId: 'mock-id' })
  }),
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([])
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affectedRows: 1 })
  }),
  delete: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affectedRows: 1 })
  }),
  transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
    const tx = { ...db };
    return await callback(tx);
  }),
  // Mock Drizzle query builder
  query: {
    users: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([])
    },
    orders: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([])
    },
    milestones: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([])
    },
    documents: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([])
    },
    acts: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([])
    }
  }
};

// Mock schema
export const schema = {
  users: {
    id: 'id',
    name: 'name',
    email: 'email',
    type: 'type',
    balance: 'balance',
    createdAt: 'createdAt'
  },
  orders: {
    id: 'id',
    customerIds: 'customerIds',
    contractorId: 'contractorId',
    representativeId: 'representativeId',
    isGroupOrder: 'isGroupOrder',
    title: 'title',
    description: 'description',
    status: 'status',
    totalAmount: 'totalAmount',
    fundedAmount: 'fundedAmount',
    createdAt: 'createdAt',
    votes: 'votes'
  },
  milestones: {
    id: 'id',
    orderId: 'orderId',
    description: 'description',
    amount: 'amount',
    status: 'status',
    deadline: 'deadline'
  },
  documents: {
    id: 'id',
    orderId: 'orderId',
    type: 'type',
    name: 'name',
    content: 'content',
    createdBy: 'createdBy',
    createdAt: 'createdAt',
    approvedBy: 'approvedBy'
  },
  acts: {
    id: 'id',
    documentId: 'documentId',
    orderId: 'orderId',
    milestoneId: 'milestoneId',
    deliverableIds: 'deliverableIds',
    status: 'status',
    signedBy: 'signedBy',
    rejectionReason: 'rejectionReason'
  }
};

// Mock operators
export const eq = jest.fn().mockImplementation((field: string, value: any) => ({ field, value, operator: 'eq' }));
export const and = jest.fn().mockImplementation((...conditions: any[]) => ({ conditions, operator: 'and' }));
export const or = jest.fn().mockImplementation((...conditions: any[]) => ({ conditions, operator: 'or' }));
export const desc = jest.fn().mockImplementation((field: string) => ({ field, direction: 'desc' }));
export const asc = jest.fn().mockImplementation((field: string) => ({ field, direction: 'asc' }));

// Mock UUID generator
export const uuidv4 = jest.fn().mockReturnValue('mocked-uuid');
