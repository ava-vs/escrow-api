/**
 * Tests for the User Service
 * These tests verify the functionality of the user management service
 */

import { UserService } from '../../../../lib/escrow-lib/services/user-service';
import { UserType } from '../../../../lib/escrow-lib/interfaces';
import { db } from '../../../../lib/db';

// Mock the database
jest.mock('../../../../lib/db', () => ({
  db: {
    transaction: jest.fn(),
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

describe('UserService', () => {
  let userService: UserService;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    userService = new UserService();
    
    // Setup transaction mock to execute the callback
    (db.transaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(db);
    });
  });
  
  describe('createUser', () => {
    it('should create a user with correct data', async () => {
      // Arrange
      const mockUserId = 'user-123';
      const mockUser = {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '0'
      };
      
      // Mock insert to return the user ID
      (db.insert as jest.Mock).mockResolvedValue([{ id: mockUserId }]);
      
      // Mock select to return the created user
      (db.select as jest.Mock).mockResolvedValue([mockUser]);
      
      // Act
      const result = await userService.createUser(
        'Test User',
        'test@example.com',
        UserType.CUSTOMER
      );
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error if user with the same email already exists', async () => {
      // Arrange
      const existingUsers = [
        {
          id: 'existing-user',
          name: 'Existing User',
          email: 'test@example.com',
          type: UserType.CUSTOMER,
          balance: '0'
        }
      ];
      
      // Mock select to simulate that a user with the same email already exists
      (db.select as jest.Mock).mockResolvedValue(existingUsers);
      
      // Act & Assert
      await expect(
        userService.createUser('Test User', 'test@example.com', UserType.CUSTOMER)
      ).rejects.toThrow('User with email test@example.com already exists');
    });
  });
  
  describe('getUserById', () => {
    it('should return user by ID', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '0'
      };
      
      (db.select as jest.Mock).mockResolvedValue([mockUser]);
      
      // Act
      const result = await userService.getUserById('user-123');
      
      // Assert
      expect(result).toEqual(mockUser);
      expect(db.select).toHaveBeenCalledTimes(1);
    });
    
    it('should return null if user not found', async () => {
      // Arrange
      (db.select as jest.Mock).mockResolvedValue([]);
      
      // Act
      const result = await userService.getUserById('non-existent-user');
      
      // Assert
      expect(result).toBeNull();
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('updateUserBalance', () => {
    it('should update user balance correctly', async () => {
      // Arrange
      const initialUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CUSTOMER,
        balance: '100'
      };
      
      const updatedUser = {
        ...initialUser,
        balance: '150'
      };
      
      // First select returns the initial user
      (db.select as jest.Mock).mockResolvedValueOnce([initialUser]);
      
      // After update, second select returns the updated user
      (db.select as jest.Mock).mockResolvedValueOnce([updatedUser]);
      
      // Mock update to succeed
      (db.update as jest.Mock).mockResolvedValue({ success: true });
      
      // Act
      const result = await userService.updateUserBalance('user-123', '50');
      
      // Assert
      expect(result).toEqual(updatedUser);
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
    
    it('should throw error if user not found', async () => {
      // Arrange
      (db.select as jest.Mock).mockResolvedValue([]);
      
      // Act & Assert
      await expect(
        userService.updateUserBalance('non-existent-user', '50')
      ).rejects.toThrow('User not found: non-existent-user');
    });
  });
});
