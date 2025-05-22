import { NextRequest } from 'next/server';
import { AuthenticatedRequest } from '@/lib/escrow-lib/interfaces';
import { corsResponse, withCors } from '@/lib/cors';
import { EscrowManager } from '@/lib/escrow-lib';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/user/profile - Get profile data for the current user
export const GET = withCors(withApiAuth(async function GET(request: AuthenticatedRequest) {
  try {
    // Get user from auth middleware context
    const user = request.auth;
    
    if (!user) {
      return corsResponse(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get basic user data from escrow system
    const userData = await escrowManager.getUser(user.id);
    
    if (!userData) {
      return corsResponse(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Extended profile info would typically be fetched from storage
    // In this demo we use mock data instead of actual DB queries
    
    // For now, we'll create a mock extended profile
    // In a real implementation, this would come from a database
    const extendedProfile = {
      // Basic user data
      id: userData.id,
      name: userData.name,
      email: userData.email,
      type: userData.type,
      balance: userData.balance,
      createdAt: userData.createdAt,
      
      // Extended profile data
      bio: userData.bio || '',
      xp: 0,
      level: 1,
      
      // User stats
      stats: {
        investments: 0, // Mock data, would be from DB in production
        nfts: 0,        // Mock data, would be from DB in production
        totalEarnings: userData.balance || 0
      },
      
      // User preferences
      preferences: {
        notifications: {
          investmentNotifications: true,
          paymentNotifications: true,
          marketingNotifications: false
        }
      }
    };
    
    return corsResponse(extendedProfile);
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return corsResponse(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}));

// PATCH /api/user/profile - Update profile data for the current user
export const PATCH = withCors(withApiAuth(async function PATCH(request: AuthenticatedRequest) {
  try {
    // Get user from auth middleware context
    const user = request.auth;
    
    if (!user) {
      return corsResponse(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get update data from request body
    const updateData = await request.json();
    
    // Validate update data
    // Only allow certain fields to be updated
    const allowedFields = ['name', 'email', 'bio', 'preferences'];
    const filteredData: any = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });
    
    // TODO: В текущей реализации EscrowManager отсутствует метод updateUser
    // В реальной системе здесь должен быть вызов API или БД для обновления данных пользователя
    // Имитируем успешное обновление пользователя для демонстрационных целей
    console.log(`Мок-обновление данных пользователя ${user.id}:`, filteredData);
    // В реальной системе updatedUser был бы результатом вызова escrowManager.updateUser
    const updatedUser = { success: true };
    
    // Get updated user data
    const userData = await escrowManager.getUser(user.id);
    // User stats would be fetched from DB in production environment
    
    // Проверяем, что userData не null
    if (!userData) {
      return corsResponse(
        { error: 'User not found after update' },
        { status: 404 }
      );
    }
    
    // Construct response with updated data
    const extendedProfile = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      type: userData.type,
      balance: userData.balance,
      createdAt: userData.createdAt,
      bio: userData.bio || '',
      xp: 0,
      level: 1,
      stats: {
        investments: 0, // Mock data, would be from DB in production
        nfts: 0,        // Mock data, would be from DB in production
        totalEarnings: userData.balance || 0
      },
      preferences: updateData.preferences || {
        notifications: {
          investmentNotifications: true,
          paymentNotifications: true,
          marketingNotifications: false
        }
      }
    };
    
    return corsResponse(extendedProfile);
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return corsResponse(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}));
