/**
 * Main export file for escrow-lib
 * Exports all interfaces, services, and the main EscrowManager
 */

// Export interfaces
export * from './interfaces';
export * from './interfaces/index';

// Export services
export { UserService } from './services/user-service';
export { OrderService } from './services/order-service';
export type { IMilestoneInputData } from './services/order-service';
export { DocumentService } from './services/document-service';

// Export main manager
export { EscrowManager, EscrowEvents } from './escrow-manager';
