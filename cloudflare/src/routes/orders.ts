import { Hono } from 'hono';
import { jwtAuth } from '../middleware/auth-middleware';
import { getUserFromContext } from '../utils/auth';
import { EscrowService } from '../services/escrow-service';
import type { Env } from '../index';

const ordersRoutes = new Hono<{ Bindings: Env }>();

// Get all orders for current user
ordersRoutes.get('/', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    const escrowService = new EscrowService(c.env);
    
    const orders = await escrowService.getOrderService().getOrdersForUser(user.sub);
    
    return c.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// Create new order
ordersRoutes.post('/', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    console.log('Creating order for user:', user.sub);
    
    const body = await c.req.json();
    console.log('Order data received:', body);
    
    const { title, description, isGroupOrder, milestones } = body;
    
    if (!title || !description || !milestones || !Array.isArray(milestones)) {
      console.log('Validation failed - missing fields');
      return c.json({ error: 'Missing required fields: title, description, milestones' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    
    console.log('Calling escrowService.createOrder...');
    const order = await escrowService.createOrder(user.sub, {
      title,
      description,
      isGroupOrder: isGroupOrder || false,
      milestones: milestones.map(m => ({
        description: m.description,
        amount: parseFloat(m.amount),
        deadline: new Date(m.deadline)
      }))
    });
    
    console.log('Order created successfully:', order.id);
    return c.json({ order }, 201);
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ 
      error: 'Failed to create order',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get order by ID with details
ordersRoutes.get('/:id', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('id');
    const escrowService = new EscrowService(c.env);
    
    const orderDetails = await escrowService.getOrderWithDetails(orderId);
    
    return c.json(orderDetails);
  } catch (error) {
    console.error('Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

// Assign contractor to order
ordersRoutes.post('/:id/assign-contractor', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const { contractorId } = body;
    
    if (!contractorId) {
      return c.json({ error: 'Contractor ID is required' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    const order = await escrowService.assignContractor(orderId, contractorId);
    
    return c.json({ order });
  } catch (error) {
    console.error('Error assigning contractor:', error);
    return c.json({ error: 'Failed to assign contractor' }, 500);
  }
});

// Fund order
ordersRoutes.post('/:id/fund', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('id');
    const user = getUserFromContext(c);
    const body = await c.req.json();
    const { amount } = body;
    
    if (!amount || amount <= 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    await escrowService.fundOrder(orderId, user.sub, parseFloat(amount));
    
    return c.json({ message: 'Order funded successfully' });
  } catch (error) {
    console.error('Error funding order:', error);
    return c.json({ error: (error as Error).message || 'Failed to fund order' }, 500);
  }
});

// Create document for order
ordersRoutes.post('/:id/documents', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    const orderId = c.req.param('id');
    const body = await c.req.json();
    
    const { type, name, content } = body;
    
    if (!type || !name) {
      return c.json({ error: 'Document type and name are required' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    const document = await escrowService.createDocument(orderId, user.sub, {
      type,
      name,
      content: content || {}
    });
    
    return c.json({ document }, 201);
  } catch (error) {
    console.error('Error creating document:', error);
    return c.json({ 
      error: 'Failed to create document',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Complete milestone
ordersRoutes.post('/:id/milestones/:milestoneId/complete', jwtAuth, async (c) => {
  try {
    const milestoneId = c.req.param('milestoneId');
    const user = getUserFromContext(c);
    
    const escrowService = new EscrowService(c.env);
    await escrowService.completeMilestone(milestoneId, user.sub);
    
    return c.json({ message: 'Milestone completed successfully' });
  } catch (error) {
    console.error('Error completing milestone:', error);
    return c.json({ error: 'Failed to complete milestone' }, 500);
  }
});

export { ordersRoutes };