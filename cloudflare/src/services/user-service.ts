import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { users, type User, type NewUser } from '../db/schema/users';
import type { Env } from '../index';

export class UserService {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  async createUser(userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const userId = crypto.randomUUID();
    
    const newUser: NewUser = {
      id: userId,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(users).values(newUser);
    
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }
    
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return result[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0] || null;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async updateUserBalance(userId: string, amount: number): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const newBalance = user.balance + amount;
    
    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    await this.db
      .update(users)
      .set({ 
        balance: newBalance,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to update user balance');
    }

    return updatedUser;
  }

  async updateUserProfile(
    userId: string, 
    updateData: Partial<Pick<User, 'name' | 'email' | 'bio' | 'preferences'>>
  ): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    await this.db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to update user profile');
    }

    return updatedUser;
  }

  async isCustomer(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === 'CUSTOMER';
  }

  async isContractor(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === 'CONTRACTOR';
  }

  async isPlatform(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.type === 'PLATFORM';
  }

  async hasBalance(userId: string, requiredAmount: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user ? user.balance >= requiredAmount : false;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, userId));
    
    return result.success;
  }

  async updatePassword(userId: string, passwordHash: string, passwordSalt: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        passwordHash,
        passwordSalt,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async incrementLoginAttempts(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;

    const attempts = (user.loginAttempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // Lock for 15 minutes after 5 attempts

    await this.db
      .update(users)
      .set({
        loginAttempts: attempts,
        lockedUntil,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        loginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }
}