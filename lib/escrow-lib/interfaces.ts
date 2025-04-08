// Core types for Escrow system

// Enums
export enum UserType {
  CUSTOMER = 'CUSTOMER',
  CONTRACTOR = 'CONTRACTOR',
  PLATFORM = 'PLATFORM',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED', // Assume sufficient funds are locked
  IN_PROGRESS = 'IN_PROGRESS', // Contractor assigned, work started
  COMPLETED = 'COMPLETED', // All milestones completed and paid
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS', // Optional: if work on milestone started
  AWAITING_ACCEPTANCE = 'AWAITING_ACCEPTANCE', // Deliverables submitted, Act generated
  COMPLETED = 'COMPLETED', // Act signed, payment potentially released
  REJECTED = 'REJECTED', // Act rejected
}

export enum DocumentType {
  // AI Generated / Planning
  DEFINITION_OF_READY = 'DEFINITION_OF_READY', // DoR
  ROADMAP = 'ROADMAP',
  DEFINITION_OF_DONE = 'DEFINITION_OF_DONE', // DoD
  SPECIFICATION = 'SPECIFICATION',
  // Execution & Acceptance
  DELIVERABLE = 'DELIVERABLE',
  ACT_OF_WORK = 'ACT_OF_WORK', // Acceptance Act
}

export enum ActStatus {
  CREATED = 'CREATED', // Generated, awaiting signatures
  SIGNED_CONTRACTOR = 'SIGNED_CONTRACTOR', // Signed by contractor
  SIGNED_CUSTOMER = 'SIGNED_CUSTOMER', // Signed by customer (maybe only one signed)
  COMPLETED = 'COMPLETED', // Requires necessary signatures (e.g., Customer + Contractor)
  REJECTED = 'REJECTED', // Rejected by customer or platform
}

// Core Interfaces
export interface IUser {
  id: string;
  name: string;
  email: string;
  type: UserType;
  balance: string; // Simplified balance tracking - stored as string in DB
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMilestone {
  id: string;
  orderId: string;
  description: string;
  amount: string; // Money values stored as string in DB
  deadline: Date;
  status: MilestoneStatus;
  // Поле paid удалено, так как отсутствует в базе данных
  // Optional link to a phase in a Roadmap document
  roadmapPhaseId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrder {
  id: string;
  customerIds: string[]; // List of customer IDs participating
  isGroupOrder: boolean; // Flag to easily identify group orders
  representativeId?: string; // Optional: ID of the designated representative for group orders
  contractorId?: string; // Assigned later
  title: string;
  description: string;
  milestones: IMilestone[];
  status: OrderStatus;
  totalAmount: string; // Money values stored as string in DB
  fundedAmount: string; // Amount currently locked in escrow
  createdAt: Date;
  updatedAt?: Date;
  // votes field removed as it doesn't exist in the DB schema
}

// Document Interfaces
export interface IDocument {
  id: string;
  orderId: string;
  type: DocumentType;
  name: string; // Mandatory name
  createdBy: string; // User ID
  createdAt: Date;
  approvedBy?: string[]; // List of user IDs who approved (for documents needing approval)
  // Content structure depends on the specific document type
  content: unknown;
}

export interface IAct extends IDocument {
  type: DocumentType.ACT_OF_WORK;
  milestoneId: string; // The specific milestone this act accepts
  deliverableIds: string[]; // IDs of deliverables being accepted
  status: ActStatus;
  signedBy: {
    userId: string;
    signedAt: Date;
  }[];
  rejectionReason?: string;
}
