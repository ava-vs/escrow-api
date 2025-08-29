import { Hono } from 'hono';
import { ChatService } from '../services/chat-service';
import { jwtAuth } from '../middleware/auth-middleware';
import { getUserFromContext } from '../middleware/auth-middleware';
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

// WebSocket endpoint for real-time chat (Free plan: Polling-based alternative)
chatRoutes.get('/:chatId/websocket', jwtAuth, async (c) => {
  const chatId = c.req.param('chatId');
  const user = getUserFromContext(c);
  const userId = user.sub;

  // For free plan, return polling endpoint information instead of WebSocket
  return c.json({
    message: 'WebSocket not available on free plan. Use polling instead.',
    pollingEndpoint: `/api/chat/${chatId}/messages`,
    recommendedInterval: 2000, // 2 seconds
    instructions: 'Poll the messages endpoint every 2 seconds for real-time updates'
  });
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

// Upload file for chat (Free plan: 1MB limit, base64 storage)
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

    // Free plan limitation: max 1MB
    if (uploadFile.size > 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 1MB for free plan' }, 400);
    }

    // Store as base64 in message content (free plan approach)
    const arrayBuffer = await uploadFile.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Create message with file
    const message = await chatService.sendMessage(
      chatId,
      userId,
      JSON.stringify({
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        fileType: uploadFile.type,
        fileContent: base64Content
      }),
      'FILE'
    );

    return c.json({ message, downloadUrl: `data:${uploadFile.type};base64,${base64Content}` });

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

// Get chat session info (active users) - Free plan alternative
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

    // For free plan, return basic session info based on recent activity
    const participants = await chatService.getChatParticipants(chatId);
    
    // Simple session simulation based on recent message activity (last 5 minutes)
    const recentMessages = await chatService.getChatMessages(chatId, 50, 0);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const activeSessions = participants.map(participant => ({
      userId: participant.userId,
      isActive: recentMessages.some(msg => 
        msg.senderId === participant.userId && 
        new Date(msg.createdAt) > fiveMinutesAgo
      ),
      lastSeen: recentMessages
        .filter(msg => msg.senderId === participant.userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || null
    }));

    return c.json({
      chatId,
      activeSessions,
      totalParticipants: participants.length,
      note: 'Free plan: Session info based on recent message activity'
    });

  } catch (error) {
    console.error('Error fetching session info:', error);
    return c.json({ error: 'Failed to fetch session info' }, 500);
  }
});

export { chatRoutes };