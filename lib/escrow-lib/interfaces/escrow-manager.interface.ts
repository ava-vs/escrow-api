/**
 * Interface for EscrowManager class
 * Defines public methods available to consumers
 */

import { 
  IUser, 
  IOrder, 
  IMilestone, 
  IDocument, 
  IAct, 
  UserType, 
  DocumentType 
} from '../interfaces';

import { IMilestoneInputData } from '../services/order-service';

export interface IEscrowManager {
  // User methods
  createUser(name: string, email: string, type: UserType, initialBalance?: string): Promise<IUser>;
  getUser(userId: string): Promise<IUser | null>;
  getUserByEmail(email: string): Promise<IUser | null>;
  getAllUsers(): Promise<IUser[]>;
  updateUserBalance(userId: string, amount: string): Promise<IUser>;
  
  // Order methods
  createOrder(customerId: string, title: string, description: string, milestones: IMilestoneInputData[]): Promise<IOrder>;
  createGroupOrder(customerIds: string[], title: string, description: string, milestones: IMilestoneInputData[], initialRepresentativeId?: string): Promise<IOrder>;
  getOrder(orderId: string): Promise<IOrder>;
  getAllOrders(): Promise<IOrder[]>;
  getOrdersByCustomer(customerId: string): Promise<IOrder[]>;
  assignContractor(orderId: string, contractorId: string, assignerUserId: string): Promise<IOrder>;
  contributeFunds(orderId: string, contributingUserId: string, amount: string): Promise<IOrder>;
  voteForRepresentative(orderId: string, voterId: string, candidateId: string): Promise<void>;
  getVotesForOrder(orderId: string): Promise<Array<{ voterId: string; candidateId: string; createdAt: Date; }>>;
  
  // Document methods
  createDocument(orderId: string, type: DocumentType, name: string, createdBy: string, content: any): Promise<IDocument>;
  getDocument(documentId: string): Promise<IDocument | null>;
  getDocumentsByOrder(orderId: string): Promise<IDocument[]>;
  approveDocument(documentId: string, approverId: string): Promise<IDocument>;
  
  // Act methods
  createAct(orderId: string, milestoneId: string, deliverableIds: string[], createdBy: string, name: string): Promise<IAct>;
  signAct(actId: string, userId: string): Promise<IAct>;
  rejectAct(actId: string, userId: string, reason: string): Promise<IAct>;
  getAct(actId: string): Promise<IAct | null>;
  
  // Funded amount method
  updateOrderFundedAmount(orderId: string, amount: number, isDebit?: boolean): Promise<IOrder>;
}
