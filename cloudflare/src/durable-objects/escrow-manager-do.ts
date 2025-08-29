import type { Env } from '../index';

interface EscrowEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  orderId?: string;
}

interface EscrowState {
  orders: Map<string, any>;
  users: Map<string, any>;
  events: EscrowEvent[];
}

export class EscrowManagerDurableObject {
  private state: EscrowState;

  constructor(private durableState: DurableObjectState, private env: Env) {
    this.state = {
      orders: new Map(),
      users: new Map(),
      events: [],
    };
    
    // Load state from durable storage on initialization
    this.loadState();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle different types of requests
    switch (url.pathname) {
      case '/event':
        return this.handleEvent(request);
      case '/state':
        return this.handleStateRequest(request);
      case '/orders':
        return this.handleOrdersRequest(request);
      case '/users':
        return this.handleUsersRequest(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleEvent(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const event: EscrowEvent = await request.json();
      event.timestamp = new Date();
      
      // Process the event
      await this.processEvent(event);
      
      // Store the event
      this.state.events.push(event);
      
      // Persist state
      await this.saveState();
      
      // Broadcast event to interested parties
      await this.broadcastEvent(event);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      console.error('Error handling event:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleStateRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    
    let responseData: any;
    
    switch (type) {
      case 'orders':
        responseData = Array.from(this.state.orders.entries());
        break;
      case 'users':
        responseData = Array.from(this.state.users.entries());
        break;
      case 'events':
        const limit = parseInt(url.searchParams.get('limit') || '100');
        responseData = this.state.events.slice(-limit);
        break;
      default:
        responseData = {
          ordersCount: this.state.orders.size,
          usersCount: this.state.users.size,
          eventsCount: this.state.events.length,
        };
    }
    
    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleOrdersRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('id');
    
    if (orderId) {
      const order = this.state.orders.get(orderId);
      if (!order) {
        return new Response('Order not found', { status: 404 });
      }
      return new Response(JSON.stringify(order), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Return all orders
    const orders = Array.from(this.state.orders.values());
    return new Response(JSON.stringify(orders), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleUsersRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('id');
    
    if (userId) {
      const user = this.state.users.get(userId);
      if (!user) {
        return new Response('User not found', { status: 404 });
      }
      return new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Return all users
    const users = Array.from(this.state.users.values());
    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async processEvent(event: EscrowEvent): Promise<void> {
    switch (event.type) {
      case 'USER_CREATED':
        this.state.users.set(event.data.id, event.data);
        break;
        
      case 'USER_BALANCE_UPDATED':
        const user = this.state.users.get(event.data.userId);
        if (user) {
          user.balance = event.data.newBalance;
          user.updatedAt = event.timestamp;
          this.state.users.set(event.data.userId, user);
        }
        break;
        
      case 'ORDER_CREATED':
        this.state.orders.set(event.data.id, event.data);
        break;
        
      case 'ORDER_UPDATED':
        const order = this.state.orders.get(event.data.id);
        if (order) {
          Object.assign(order, event.data);
          order.updatedAt = event.timestamp;
          this.state.orders.set(event.data.id, order);
        }
        break;
        
      case 'FUNDS_CONTRIBUTED':
        const contributedOrder = this.state.orders.get(event.orderId!);
        if (contributedOrder) {
          contributedOrder.fundedAmount += event.data.amount;
          contributedOrder.updatedAt = event.timestamp;
          this.state.orders.set(event.orderId!, contributedOrder);
        }
        break;
        
      case 'CONTRACTOR_ASSIGNED':
        const assignedOrder = this.state.orders.get(event.orderId!);
        if (assignedOrder) {
          assignedOrder.contractorId = event.data.contractorId;
          assignedOrder.status = 'IN_PROGRESS';
          assignedOrder.updatedAt = event.timestamp;
          this.state.orders.set(event.orderId!, assignedOrder);
        }
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async broadcastEvent(event: EscrowEvent): Promise<void> {
    // In a real implementation, you might:
    // 1. Send webhooks to external systems
    // 2. Notify other Durable Objects
    // 3. Send real-time updates to connected clients
    // 4. Trigger analytics events
    
    console.log(`Broadcasting event: ${event.type}`, event.data);
    
    // Example: Send to analytics (disabled for now)
    // Analytics can be added later when needed
  }

  private async loadState(): Promise<void> {
    try {
      // Load orders
      const ordersData = await this.durableState.storage.get('orders');
      if (ordersData) {
        this.state.orders = new Map(ordersData as [string, any][]);
      }
      
      // Load users
      const usersData = await this.durableState.storage.get('users');
      if (usersData) {
        this.state.users = new Map(usersData as [string, any][]);
      }
      
      // Load recent events (keep only last 1000)
      const eventsData = await this.durableState.storage.get('events');
      if (eventsData) {
        this.state.events = (eventsData as EscrowEvent[]).slice(-1000);
      }
      
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      // Save orders
      await this.durableState.storage.put('orders', Array.from(this.state.orders.entries()));
      
      // Save users
      await this.durableState.storage.put('users', Array.from(this.state.users.entries()));
      
      // Save recent events (keep only last 1000)
      await this.durableState.storage.put('events', this.state.events.slice(-1000));
      
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  // Method to get order statistics
  async getOrderStatistics(): Promise<any> {
    const orders = Array.from(this.state.orders.values());
    
    const stats = {
      total: orders.length,
      byStatus: {} as Record<string, number>,
      totalValue: 0,
      totalFunded: 0,
    };
    
    for (const order of orders) {
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
      stats.totalValue += order.totalAmount || 0;
      stats.totalFunded += order.fundedAmount || 0;
    }
    
    return stats;
  }

  // Method to get user statistics
  async getUserStatistics(): Promise<any> {
    const users = Array.from(this.state.users.values());
    
    const stats = {
      total: users.length,
      byType: {} as Record<string, number>,
      totalBalance: 0,
    };
    
    for (const user of users) {
      stats.byType[user.type] = (stats.byType[user.type] || 0) + 1;
      stats.totalBalance += user.balance || 0;
    }
    
    return stats;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    // Save final state
    await this.saveState();
    
    // Clear in-memory state
    this.state.orders.clear();
    this.state.users.clear();
    this.state.events = [];
  }
}