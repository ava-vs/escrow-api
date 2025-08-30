import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { 
  orderChats, 
  chatParticipants, 
  chatMessages, 
  messageReadStatus,
  type OrderChat,
  type ChatMessage,
  type ChatParticipant,
  type NewOrderChat,
  type NewChatMessage
} from '../db/schema/chat';
import type { Env } from '../index';

export type MessageType = 'TEXT' | 'FILE' | 'PRODUCT_DELIVERY' | 'SYSTEM';

export class ChatService {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  async createOrderChat(orderId: string): Promise<OrderChat> {
    const chatId = crypto.randomUUID();
    
    const newChat: NewOrderChat = {
      id: chatId,
      orderId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(orderChats).values(newChat);
    
    // Add participants from the order
    await this.addOrderParticipants(chatId, orderId);
    
    const chat = await this.getChatById(chatId);
    if (!chat) {
      throw new Error('Failed to create chat');
    }
    
    return chat;
  }

  async getChatById(chatId: string): Promise<OrderChat | null> {
    const result = await this.db
      .select()
      .from(orderChats)
      .where(eq(orderChats.id, chatId))
      .limit(1);
    
    return result[0] || null;
  }

  async getChatByOrderId(orderId: string): Promise<OrderChat | null> {
    const result = await this.db
      .select()
      .from(orderChats)
      .where(eq(orderChats.orderId, orderId))
      .limit(1);
    
    return result[0] || null;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    messageType: MessageType = 'TEXT',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number,
    replyToId?: string
  ): Promise<ChatMessage> {
    const messageId = crypto.randomUUID();
    
    const newMessage: NewChatMessage = {
      id: messageId,
      chatId,
      senderId,
      messageType,
      content,
      fileUrl,
      fileName,
      fileSize,
      replyToId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(chatMessages).values(newMessage);
    
    // Notify via Durable Object
    await this.notifyNewMessage(chatId, messageId);
    
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Failed to create message');
    }
    
    return message;
  }

  async getMessageById(messageId: string): Promise<ChatMessage | null> {
    const result = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);
    
    return result[0] || null;
  }

  async getChatMessages(
    chatId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ChatMessage[]> {
    return await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getChatParticipants(chatId: string): Promise<ChatParticipant[]> {
    return await this.db
      .select()
      .from(chatParticipants)
      .where(eq(chatParticipants.chatId, chatId));
  }

  async addParticipant(
    chatId: string, 
    userId: string, 
    role: 'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM'
  ): Promise<void> {
    await this.db.insert(chatParticipants).values({
      chatId,
      userId,
      role,
      joinedAt: new Date(),
    });
  }

  async removeParticipant(chatId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatParticipants)
      .where(and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      ));
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await this.db.insert(messageReadStatus).values({
      messageId,
      userId,
      readAt: new Date(),
    });
  }

  async getUnreadMessagesCount(chatId: string, userId: string): Promise<number> {
    // Get all messages in chat
    const messages = await this.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId));
    
    // Get read messages for user
    const readMessages = await this.db
      .select({ messageId: messageReadStatus.messageId })
      .from(messageReadStatus)
      .where(eq(messageReadStatus.userId, userId));
    
    const readMessageIds = new Set(readMessages.map(rm => rm.messageId));
    
    return messages.filter(m => !readMessageIds.has(m.id)).length;
  }

  async isParticipant(userId: string, chatId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(chatParticipants)
      .where(and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      ))
      .limit(1);
    
    return result.length > 0;
  }

  private async addOrderParticipants(chatId: string, orderId: string): Promise<void> {
    try {
      // Import order schema to query order details
      const { orders, customerOrders } = await import('../db/schema/orders');
      
      // Get order details
      const order = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      
      if (order.length === 0) {
        console.warn(`Order ${orderId} not found for chat participants`);
        return;
      }
      
      const orderData = order[0];
      
      // Add representative (order creator) as customer
      if (orderData.representativeId) {
        await this.addParticipant(chatId, orderData.representativeId, 'CUSTOMER');
      }
      
      // Add contractor if assigned
      if (orderData.contractorId) {
        await this.addParticipant(chatId, orderData.contractorId, 'CONTRACTOR');
      }
      
      // Add all customers who funded the order
      const customers = await this.db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.orderId, orderId));
      
      for (const customer of customers) {
        await this.addParticipant(chatId, customer.customerId, 'CUSTOMER');
      }
      
      console.log(`Added ${customers.length + (orderData.representativeId ? 1 : 0) + (orderData.contractorId ? 1 : 0)} participants to chat ${chatId}`);
    } catch (error) {
      console.error('Failed to add order participants to chat:', error);
      // Don't throw - chat creation should not fail if participant addition fails
    }
  }

  private async notifyNewMessage(chatId: string, messageId: string): Promise<void> {
    try {
      // Get the Durable Object for this chat
      const chatDO = this.env.CHAT_DO.get(
        this.env.CHAT_DO.idFromName(chatId)
      );
      
      // Notify the Durable Object about the new message
      await chatDO.fetch(new Request(`https://chat/${messageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'NEW_MESSAGE', messageId }),
      }));
    } catch (error) {
      console.error('Failed to notify Durable Object:', error);
      // Don't throw - message was saved successfully
    }
  }

  async uploadFile(file: File): Promise<{ url: string; fileName: string; fileSize: number }> {
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    
    // Upload to R2
    await this.env.FILES.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    return {
      url: `https://files.escrow.com/${fileName}`,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  async generateFileDownloadUrl(fileUrl: string): Promise<string> {
    // Generate a signed URL for file download
    // This is a simplified version - in production you'd implement proper signed URLs
    return fileUrl;
  }
}