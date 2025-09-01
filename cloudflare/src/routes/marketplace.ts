import { Hono } from 'hono';
import { jwtAuth } from '../middleware/auth-middleware';
import { MarketplaceService, PublishProductData } from '../services/marketplace-service';
import type { Env } from '../index';

interface Variables {
  user: any;
}

const marketplaceRoutes = new Hono<{ Bindings: Env, Variables: Variables }>();

marketplaceRoutes.get('/products', async (c) => {
  try {
    const { search } = c.req.query();
    const marketplaceService = new MarketplaceService(c.env);
    const products = await marketplaceService.getAvailableProducts(search);
    return c.json({ products });
  } catch (error) {
    console.error('Error fetching marketplace products:', error);
    return c.json({ error: 'Failed to fetch marketplace products' }, 500);
  }
});

marketplaceRoutes.post('/products', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const sellerId = user.sub; // Use 'sub' from JWT payload as user ID
    const body = await c.req.json<PublishProductData>();

    const marketplaceService = new MarketplaceService(c.env);
    const newProduct = await marketplaceService.publishProduct(body, sellerId);

    return c.json({ product: newProduct }, 201);
  } catch (error) {
    console.error('Error publishing product:', error);
    return c.json({ error: 'Failed to publish product' }, 500);
  }
});

marketplaceRoutes.post('/products/:id/purchase', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const buyerId = user.sub;
    const productId = c.req.param('id');

    const marketplaceService = new MarketplaceService(c.env);
    const purchase = await marketplaceService.purchaseProduct(productId, buyerId);

    return c.json({ purchase });
  } catch (error) {
    console.error('Error purchasing product:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to purchase product';
    return c.json({ error: errorMessage }, 500);
  }
});

export { marketplaceRoutes };