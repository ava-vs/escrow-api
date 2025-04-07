/**
 * Mock for drizzle-orm to use in tests
 */

export const eq = jest.fn().mockImplementation((field, value) => ({ field, value }));
export const and = jest.fn().mockImplementation((...conditions) => ({ conditions }));
export const desc = jest.fn().mockImplementation((field) => ({ field, order: 'desc' }));
export const asc = jest.fn().mockImplementation((field) => ({ field, order: 'asc' }));
export const sql = jest.fn().mockImplementation((query) => ({ query }));
