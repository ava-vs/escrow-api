import type { Env } from '../index';

interface WebSocketSession {
  webSocket: WebSocket;
  userId: string;
  chatId: string;
  joinedAt: Date;
}

export class ChatDurableObject {
  private sessions: Map<string, WebSocketSession> = new Map();
  private chatId: string;

  constructor(private state: DurableObjectState, private env: Env) {
    // Extract chat ID from the Durable Object ID
    this.chatId = state.id.toString();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade requests
    if (url.pathname === '/websocket') {
      return this.handleWebSocketUpgrade(request);
    }
    
    // Handle new message notifications
    if (request.method === 'POST') {
      return this.handleNewMessage(request);
    }
    
    // Handle session management
    if (url.pathname === '/sessions') {
      return this.handleSessionsRequest(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    // Extract user ID from query parameters or headers
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || request.headers.get('X-User-Id');
    
    if (!userId) {
      return new Response('Missing user ID', { status: 400 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = [webSocketPair[0], webSocketPair[1]];
    
    // Accept the WebSocket connection
    server.accept();
    
    // Create session
    const sessionId = crypto.randomUUID();
    const session: WebSocketSession = {
      webSocket: server,
      userId,
      chatId: this.chatId,
      joinedAt: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    
    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(sessionId, event);
    });
    
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
      console.log(`User ${userId} disconnected from chat ${this.chatId}`);
    });
    
    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.sessions.delete(sessionId);
    });
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'CONNECTED',
      data: {
        sessionId,
        chatId: this.chatId,
        connectedAt: session.joinedAt.toISOString(),
      },
    }));
    
    console.log(`User ${userId} connected to chat ${this.chatId}`);
    
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleWebSocketMessage(sessionId: string, event: MessageEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    try {
      const message = JSON.parse(event.data as string);
      
      switch (message.type) {
        case 'PING':
          session.webSocket.send(JSON.stringify({ type: 'PONG' }));
          break;
          
        case 'TYPING_START':
          this.broadcastToOthers(sessionId, {
            type: 'USER_TYPING',
            data: {
              userId: session.userId,
              isTyping: true,
            },
          });
          break;
          
        case 'TYPING_STOP':
          this.broadcastToOthers(sessionId, {
            type: 'USER_TYPING',
            data: {
              userId: session.userId,
              isTyping: false,
            },
          });
          break;
          
        case 'MESSAGE_READ':
          // Handle message read acknowledgment
          this.broadcastToOthers(sessionId, {
            type: 'MESSAGE_READ',
            data: {
              messageId: message.messageId,
              userId: session.userId,
              readAt: new Date().toISOString(),
            },
          });
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private async handleNewMessage(request: Request): Promise<Response> {
    try {
      const body = await request.json() as any;
      
      if (body.type === 'NEW_MESSAGE') {
        // Fetch message details from database
        const messageData = await this.getMessageFromDatabase(body.messageId);
        
        if (messageData) {
          // Broadcast to all connected sessions
          this.broadcastToAll({
            type: 'NEW_MESSAGE',
            data: messageData,
          });
        }
      }
      
      return new Response('OK');
    } catch (error) {
      console.error('Error handling new message notification:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleSessionsRequest(request: Request): Promise<Response> {
    const activeSessions = Array.from(this.sessions.values()).map(session => ({
      userId: session.userId,
      joinedAt: session.joinedAt.toISOString(),
    }));
    
    return new Response(JSON.stringify({
      chatId: this.chatId,
      activeUsers: activeSessions.length,
      sessions: activeSessions,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private broadcastToAll(message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const session of this.sessions.values()) {
      try {
        session.webSocket.send(messageStr);
      } catch (error) {
        console.error(`Failed to send message to user ${session.userId}:`, error);
      }
    }
  }

  private broadcastToOthers(excludeSessionId: string, message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId !== excludeSessionId) {
        try {
          session.webSocket.send(messageStr);
        } catch (error) {
          console.error(`Failed to send message to user ${session.userId}:`, error);
        }
      }
    }
  }

  private async getMessageFromDatabase(messageId: string): Promise<any> {
    try {
      // This would typically use the database to fetch message details
      // For now, return a placeholder
      return {
        id: messageId,
        chatId: this.chatId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching message from database:', error);
      return null;
    }
  }

  // Cleanup method called when the Durable Object is being shut down
  async cleanup(): Promise<void> {
    // Close all WebSocket connections
    for (const session of this.sessions.values()) {
      try {
        session.webSocket.close(1001, 'Server shutting down');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    }
    
    this.sessions.clear();
  }
}