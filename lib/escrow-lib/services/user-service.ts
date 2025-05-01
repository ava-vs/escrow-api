/**
 * User service for managing users in the escrow system
 * Handles creation, retrieval, and validation of users
 */

import { db } from '../../db';
import { eq } from 'drizzle-orm';
import * as schema from '../../schema';
import { IUser, UserType } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  /**
   * Create a new user in the system
   * @param name User name
   * @param email User email
   * @param type User type (CUSTOMER, CONTRACTOR, PLATFORM)
   * @param initialBalance Optional initial balance
   * @returns Created user
   */
  async createUser(
    name: string,
    email: string,
    type: UserType,
    initialBalance = '0'
  ): Promise<IUser> {
    // Validate user input
    if (!name) throw new Error('User name is required');
    if (name.trim().length < 2) throw new Error('User name must be at least 2 characters long');
    if (name.trim().length > 100) throw new Error('User name must be less than 100 characters long');
    
    if (!email) throw new Error('User email is required');
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) throw new Error('Invalid email format');
    
    // Validate user type
    if (!Object.values(UserType).includes(type)) {
      throw new Error(`Invalid user type: ${type}. Must be one of: ${Object.values(UserType).join(', ')}`);
    }
    
    // Validate initial balance
    if (isNaN(Number(initialBalance))) {
      throw new Error('Initial balance must be a valid number');
    }
    
    if (Number(initialBalance) < 0) {
      throw new Error('Initial balance cannot be negative');
    }
    
    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email)
    });
    
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }
    
    // Create new user
    const newUser = {
      id: uuidv4(),
      name: name.trim(), // Trim whitespace from name
      email: email.toLowerCase().trim(), // Normalize email
      type,
      balance: initialBalance,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(schema.users).values(newUser);
    
    return newUser;
  }
  
  /**
   * Get user by ID
   * @param userId User ID (must be UUID)
   * @returns User object or null if not found
   */
  async getUserById(userId: string): Promise<IUser | null> {
    if (!userId) throw new Error('User ID is required');
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format. Must be a valid UUID.');
    }
    
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });
    
    if (!user) return null;
    
    // Convert string type to UserType enum
    return {
      ...user,
      type: user.type as unknown as UserType // Explicit type conversion
    };
  }
  
  /**
   * Get user by email
   * @param email User email (must be valid email format)
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    if (!email) throw new Error('Email is required');
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail)
    });
    
    if (!user) return null;
    
    // Convert string type to UserType enum
    return {
      ...user,
      type: user.type as unknown as UserType // Explicit type conversion
    };
  }
  
  /**
   * Get all users in the system
   * @returns Array of all users
   */
  async getAllUsers(): Promise<IUser[]> {
    const users = await db.query.users.findMany();
    
    // Convert string type to UserType enum for each user
    return users.map((user: any) => ({
      ...user,
      type: user.type as unknown as UserType // Explicit type conversion
    }));
  }
  
  /**
   * Update user balance
   * @param userId User ID (must be UUID)
   * @param amount Amount to add (positive) or subtract (negative)
   * @returns Updated user
   */
  async updateUserBalance(userId: string, amount: string): Promise<IUser> {
    // Validate userId
    if (!userId) throw new Error('User ID is required');
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format. Must be a valid UUID.');
    }
    
    // Validate amount
    if (!amount) throw new Error('Amount is required');
    if (isNaN(parseFloat(amount))) {
      throw new Error('Amount must be a valid number');
    }
    
    const user = await this.getUserById(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Calculate new balance
    const currentBalance = parseFloat(user.balance);
    const amountValue = parseFloat(amount);
    const newBalance = currentBalance + amountValue;
    
    // Prevent negative balance
    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }
    
    // Update user balance
    await db
      .update(schema.users)
      .set({ balance: newBalance.toString(), updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
    
    // Return updated user
    return {
      ...user,
      balance: newBalance.toString() // Ensure balance is returned as string
    };
  }
  
  /**
   * Update user profile information
   * @param userId User ID
   * @param updateData Object containing fields to update (name, email, bio, preferences)
   * @returns Updated user
   */
  async updateUserProfile(userId: string, updateData: Partial<IUser> & { bio?: string, preferences?: any }): Promise<IUser> {
    // Validate userId
    if (!userId) throw new Error('User ID is required');
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format. Must be a valid UUID.');
    }
    
    // Get current user data
    const user = await this.getUserById(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Prepare update data
    const updateFields: any = {};
    
    // Update name if provided
    if (updateData.name !== undefined) {
      if (updateData.name.trim().length < 2) {
        throw new Error('User name must be at least 2 characters long');
      }
      if (updateData.name.trim().length > 100) {
        throw new Error('User name must be less than 100 characters long');
      }
      updateFields.name = updateData.name.trim();
    }
    
    // Update email if provided
    if (updateData.email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        throw new Error('Invalid email format');
      }
      
      // Check if email is different from current one
      if (updateData.email.toLowerCase().trim() !== user.email.toLowerCase()) {
        // Check if email already exists for another user
        const existingUser = await this.getUserByEmail(updateData.email);
        if (existingUser && existingUser.id !== userId) {
          throw new Error(`Email ${updateData.email} is already in use by another account`);
        }
        updateFields.email = updateData.email.toLowerCase().trim();
      }
    }
    
    // Update bio if provided
    if (updateData.bio !== undefined) {
      // Bio can be empty, but if it's not, limit its length
      if (updateData.bio && updateData.bio.length > 500) {
        throw new Error('Bio must be less than 500 characters long');
      }
      updateFields.bio = updateData.bio;
    }
    
    // Always update updatedAt timestamp
    updateFields.updatedAt = new Date();
    
    // Only update if there are fields to update
    if (Object.keys(updateFields).length > 0) {
      await db
        .update(schema.users)
        .set(updateFields)
        .where(eq(schema.users.id, userId));
    }
    
    // Get and return updated user
    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      throw new Error(`Failed to retrieve updated user with ID ${userId}`);
    }
    
    // Return updated user with any additional fields from the input data
    // that might not be stored in the database (like preferences)
    return {
      ...updatedUser,
      bio: updateFields.bio !== undefined ? updateFields.bio : (user.bio || ''),
      preferences: updateData.preferences !== undefined ? updateData.preferences : (user.preferences || {})
    };
  }
  
  /**
   * Validate if user is a customer
   * @param userId User ID
   * @returns True if user is a customer, false otherwise
   */
  async isCustomer(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === UserType.CUSTOMER;
  }
  
  /**
   * Validate if user is a contractor
   * @param userId User ID
   * @returns True if user is a contractor, false otherwise
   */
  async isContractor(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === UserType.CONTRACTOR;
  }
  
  /**
   * Validate if user is a platform representative
   * @param userId User ID
   * @returns True if user is a platform representative, false otherwise
   */
  async isPlatformUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === UserType.PLATFORM;
  }
}
