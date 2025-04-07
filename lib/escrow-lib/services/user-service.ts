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
    if (!email) throw new Error('User email is required');
    
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
      name,
      email,
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
   * @param userId User ID
   * @returns User object or null if not found
   */
  async getUserById(userId: string): Promise<IUser | null> {
    if (!userId) throw new Error('User ID is required');
    
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
   * @param email User email
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    if (!email) throw new Error('Email is required');
    
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email)
    });
    
    if (!user) return null;
    
    // Convert string type to UserType enum
    return {
      ...user,
      type: user.type as unknown as UserType // Explicit type conversion
    };
  }
  
  /**
   * Update user balance
   * @param userId User ID
   * @param amount Amount to add (positive) or subtract (negative)
   * @returns Updated user
   */
  async updateUserBalance(userId: string, amount: string): Promise<IUser> {
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
