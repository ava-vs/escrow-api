import { Hono } from 'hono';
import { ChatService } from '../services/chat-service';
import { jwtAuth } from './auth';
import { getUserFromContext } from '../utils/auth';
import type { Env } from '../index';

const chatRoutes = new Hono<{ Bindings: Env }>();

// Create chat for order
chatRoutes.post('/orders/:orderId', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const chatService = new ChatService(c.env);
    
    // Check if chat already exists for this order
    const existingChat = await chatService.getChatByOrderId(orderId);
    if (existingChat) {
      return c.json(existingChat);
    }
    
    const chat = await chatService.createOrderChat(orderId);
    
    return c.json(chat, 201);
    
  } catch (error) {
    console.error('Error creating chat:', error);
    return c.json({ error: 'Failed to create chat' }, 500);
  }
});

// Get chat by order ID
chatRoutes.get('/orders/:orderId', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const chatService = new ChatService(c.env);
    
    const chat = await chatService.getChatByOrderId(orderId);
    
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }
    
    return c.json(chat);
    
  } catch (error) {
    console.error('Error fetching chat:', error);
    return c.json({ error: 'Failed to fetch chat' }, 500);
  }
});

// WebSocket endpoint for real-time chat
chatRoutes.get('/:chatId/websocket', async (c) => {
  const chatId = c.req.param('chatId');
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }
  
  // Get the Durable Object for this chat
  const chatDO = c.env.CHAT_DO.get(c.env.CHAT_DO.idFromName(chatId));
  
  // Forward the WebSocket upgrade request to the Durable Object
  const url = new URL(c.req.url);
  url.pathname = '/websocket';
  url.searchParams.set('userId', userId);
  
  return chatDO.fetch(new Request(url.toString(), {
    headers: c.req.raw.headers,
  }));
});

// Send message to chat
chatRoutes.post('/:chatId/messages', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const senderId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(senderId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    const messageData = await c.req.json();
    
    if (!messageData.content) {
      return c.json({ error: 'Message content is required' }, 400);
    }
    
    const message = await chatService.sendMessage(
      chatId,
      senderId,
      messageData.content,
      messageData.messageType || 'TEXT',
      messageData.fileUrl,
      messageData.fileName,
      messageData.fileSize,
      messageData.replyToId
    );
    
    return c.json(message, 201);
    
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// Get chat messages
chatRoutes.get('/:chatId/messages', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const messages = await chatService.getChatMessages(chatId, limit, offset);
    
    return c.json(messages);
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// Upload file for chat
chatRoutes.post('/:chatId/upload', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    const formData = await c.req.formData();
    const file = formData.get('file');
    
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No valid file provided' }, 400);
    }
    

    
    // Type assertion for File
    const uploadFile = file as File;
    
    // Validate file size (max 10MB)
    if (uploadFile.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 10MB' }, 400);
    }
    
    const uploadResult = await chatService.uploadFile(uploadFile);
    
    return c.json(uploadResult);
    
  } catch (error) {
    console.error('Error uploading file:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// Mark message as read
chatRoutes.post('/:chatId/messages/:messageId/read', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const messageId = c.req.param('messageId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    await chatService.markMessageAsRead(messageId, userId);
    
    return c.json({ message: 'Message marked as read' });
    
  } catch (error) {
    console.error('Error marking message as read:', error);
    return c.json({ error: 'Failed to mark message as read' }, 500);
  }
});

// Get unread messages count
chatRoutes.get('/:chatId/unread-count', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    const unreadCount = await chatService.getUnreadMessagesCount(chatId, userId);
    
    return c.json({ unreadCount });
    
  } catch (error) {
    console.error('Error getting unread count:', error);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

// Get chat participants
chatRoutes.get('/:chatId/participants', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    const participants = await chatService.getChatParticipants(chatId);
    
    return c.json(participants);
    
  } catch (error) {
    console.error('Error fetching participants:', error);
    return c.json({ error: 'Failed to fetch participants' }, 500);
  }
});

// Get chat session info (active users)
chatRoutes.get('/:chatId/sessions', jwtAuth, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const user = getUserFromContext(c);
    const userId = user.sub;
    
    const chatService = new ChatService(c.env);
    
    // Verify user is a participant in this chat
    const isParticipant = await chatService.isParticipant(userId, chatId);
    if (!isParticipant) {
      return c.json({ error: 'Unauthorized: Not a chat participant' }, 403);
    }
    
    // Get the Durable Object for this chat
    const chatDO = c.env.CHAT_DO.get(c.env.CHAT_DO.idFromName(chatId));
    
    // Request session info from the Durable Object
    const response = await chatDO.fetch(new Request('https://chat/sessions'));
    const sessionInfo = await response.json() as any;
    
    return c.json(sessionInfo);
    
  } catch (error) {
    console.error('Error fetching session info:', error);
    return c.json({ error: 'Failed to fetch session info' }, 500);
  }
});

export { chatRoutes };