import { pgEnum } from 'drizzle-orm/pg-core';

// User type enum
export const userTypeEnum = pgEnum('user_type', [
  'CUSTOMER',
  'CONTRACTOR',
  'PLATFORM',
]);

// Order status enum
export const orderStatusEnum = pgEnum('order_status', [
  'CREATED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
]);

// Milestone status enum
export const milestoneStatusEnum = pgEnum('milestone_status', [
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_ACCEPTANCE',
  'COMPLETED',
  'REJECTED',
]);

// Document type enum
export const documentTypeEnum = pgEnum('document_type', [
  'DEFINITION_OF_READY',
  'ROADMAP',
  'DEFINITION_OF_DONE',
  'SPECIFICATION',
  'DELIVERABLE',
  'ACT_OF_WORK',
]);

// Act status enum
export const actStatusEnum = pgEnum('act_status', [
  'CREATED',
  'SIGNED_CONTRACTOR',
  'SIGNED_CUSTOMER',
  'COMPLETED',
  'REJECTED',
]);
