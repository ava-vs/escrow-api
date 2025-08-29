import { Hono } from 'hono';
import { jwtAuth } from './auth';
import { getUserFromContext } from '../utils/auth';
import { EscrowService } from '../services/escrow-service';
import type { Env } from '../index';

const documentsRoutes = new Hono<{ Bindings: Env }>();

// Get documents for an order
documentsRoutes.get('/order/:orderId', jwtAuth, async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const escrowService = new EscrowService(c.env);
    
    const documents = await escrowService.getDocumentService().getDocumentsByOrderId(orderId);
    
    return c.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return c.json({ error: 'Failed to fetch documents' }, 500);
  }
});

// Create new document
documentsRoutes.post('/', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    const body = await c.req.json();
    
    const { orderId, type, name, content } = body;
    
    if (!orderId || !type || !name || !content) {
      return c.json({ error: 'Missing required fields: orderId, type, name, content' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    
    const document = await escrowService.createDocument(orderId, user.sub, {
      type,
      name,
      content
    });
    
    return c.json({ document }, 201);
  } catch (error) {
    console.error('Error creating document:', error);
    return c.json({ error: 'Failed to create document' }, 500);
  }
});

// Get document by ID
documentsRoutes.get('/:id', jwtAuth, async (c) => {
  try {
    const documentId = c.req.param('id');
    const escrowService = new EscrowService(c.env);
    
    const document = await escrowService.getDocumentService().getDocumentById(documentId);
    
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }
    
    return c.json({ document });
  } catch (error) {
    console.error('Error fetching document:', error);
    return c.json({ error: 'Failed to fetch document' }, 500);
  }
});

// Approve document
documentsRoutes.post('/:id/approve', jwtAuth, async (c) => {
  try {
    const documentId = c.req.param('id');
    const user = getUserFromContext(c);
    
    const escrowService = new EscrowService(c.env);
    const document = await escrowService.approveDocument(documentId, user.sub);
    
    return c.json({ document });
  } catch (error) {
    console.error('Error approving document:', error);
    return c.json({ error: 'Failed to approve document' }, 500);
  }
});

// Create act for document
documentsRoutes.post('/:id/acts', jwtAuth, async (c) => {
  try {
    const documentId = c.req.param('id');
    const user = getUserFromContext(c);
    const body = await c.req.json();
    
    const { type, description, signatories } = body;
    
    if (!type || !description || !signatories || !Array.isArray(signatories)) {
      return c.json({ error: 'Missing required fields: type, description, signatories' }, 400);
    }
    
    const escrowService = new EscrowService(c.env);
    
    const act = await escrowService.createAct(documentId, user.sub, {
      type,
      description,
      signatories
    });
    
    return c.json({ act }, 201);
  } catch (error) {
    console.error('Error creating act:', error);
    return c.json({ error: 'Failed to create act' }, 500);
  }
});

// Get acts for document
documentsRoutes.get('/:id/acts', jwtAuth, async (c) => {
  try {
    const documentId = c.req.param('id');
    const escrowService = new EscrowService(c.env);
    
    const acts = await escrowService.getDocumentService().getActsByDocumentId(documentId);
    
    return c.json({ acts });
  } catch (error) {
    console.error('Error fetching acts:', error);
    return c.json({ error: 'Failed to fetch acts' }, 500);
  }
});

// Sign act
documentsRoutes.post('/acts/:actId/sign', jwtAuth, async (c) => {
  try {
    const actId = c.req.param('actId');
    const user = getUserFromContext(c);
    const body = await c.req.json();
    
    const { signature } = body;
    
    const escrowService = new EscrowService(c.env);
    const act = await escrowService.signAct(actId, user.sub, signature || {});
    
    return c.json({ act });
  } catch (error) {
    console.error('Error signing act:', error);
    return c.json({ error: (error as Error).message || 'Failed to sign act' }, 500);
  }
});

// Get pending acts for current user
documentsRoutes.get('/acts/pending', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    const escrowService = new EscrowService(c.env);
    
    const pendingActs = await escrowService.getDocumentService().getPendingActsForUser(user.sub);
    
    return c.json({ pendingActs });
  } catch (error) {
    console.error('Error fetching pending acts:', error);
    return c.json({ error: 'Failed to fetch pending acts' }, 500);
  }
});

export { documentsRoutes };