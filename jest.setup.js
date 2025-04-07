/**
 * Jest setup file for escrow-api-1
 * This file is executed before each test file
 */

// Import and configure testing libraries
try {
  require('@testing-library/jest-dom');
} catch (e) {
  console.warn('Warning: @testing-library/jest-dom is not installed');
}

// Setup global Jest mocks
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid')
}));

// Add console mock to avoid polluting test output
global.console = {
  ...console,
  // You can comment these out to see the actual console output
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
