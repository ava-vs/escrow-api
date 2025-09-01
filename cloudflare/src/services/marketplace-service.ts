import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, like } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env } from '../index';

export interface PublishProductData {
  name: string;
  description?: string;
  price: number;
  orderId: string; // ID of the original order
}

export class MarketplaceService {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(env.DB);
  }

  private async createOriginalProduct(data: PublishProductData, sellerId: string): Promise<schema.Product> {
    const newProduct: schema.NewProduct = {
      id: crypto.randomUUID(),
      orderId: data.orderId,
      name: data.name,
      description: data.description,
      createdBy: sellerId,
    };
    const result = await this.db.insert(schema.products).values(newProduct).returning();
    if (!result || result.length === 0 || !result[0]) {
      throw new Error('Failed to create original product.');
    }
    return result[0];
  }

  async getAvailableProducts(searchQuery?: string): Promise<schema.MarketplaceProduct[]> {
    try {
      const conditions = [eq(schema.marketplaceProducts.isActive, true)];
      if (searchQuery) {
        const searchCondition = or(
          like(schema.marketplaceProducts.name, `%${searchQuery}%`),
          like(schema.marketplaceProducts.description, `%${searchQuery}%`)
        );
        conditions.push(searchCondition as any);
      }

      const products = await this.db
        .select()
        .from(schema.marketplaceProducts)
        .where(and(...conditions));

      return products;
    } catch (error) {
      console.error('Error getting available products:', error);
      throw new Error('Failed to get available products');
    }
  }

  async publishProduct(productData: PublishProductData, sellerId: string): Promise<schema.MarketplaceProduct> {
    try {
      // 1. Create the original product first
      const originalProduct = await this.createOriginalProduct(productData, sellerId);

      // 2. Create the marketplace product that references the original product
      const newMarketplaceProduct: schema.NewMarketplaceProduct = {
        id: crypto.randomUUID(),
        sellerId: sellerId,
        originalProductId: originalProduct.id,
        name: productData.name,
        description: productData.description,
        price: productData.price,
      };

      const result = await this.db
        .insert(schema.marketplaceProducts)
        .values(newMarketplaceProduct)
        .returning();
      
      if (!result || result.length === 0 || !result[0]) {
        throw new Error('Failed to create marketplace product.');
      }

      return result[0];
    } catch (error) {
      console.error('Error publishing product:', error);
      throw new Error('Failed to publish product');
    }
  }

  async purchaseProduct(productId: string, buyerId: string): Promise<schema.ProductSale> {
    try {
      // For simplicity, we assume the product exists and is active.
      // A real implementation would add checks.
      const product = (await this.db
        .select()
        .from(schema.marketplaceProducts)
        .where(eq(schema.marketplaceProducts.id, productId)))[0];

      if (!product) {
        throw new Error('Product not found');
      }

      const sale: schema.NewProductSale = {
        id: crypto.randomUUID(),
        marketplaceProductId: productId,
        buyerId: buyerId,
        salePrice: product.price,
        platformCommission: product.price * product.commissionRate,
        sellerAmount: product.price * (1 - product.commissionRate),
        status: 'COMPLETED', // Assume payment is instant
        completedAt: new Date(),
      };

      const result = await this.db.insert(schema.productSales).values(sale).returning();
      if (!result || result.length === 0 || !result[0]) {
        throw new Error('Failed to process purchase.');
      }

      return result[0];
    } catch (error) {
      console.error('Error purchasing product:', error);
      throw new Error('Failed to purchase product');
    }
  }
}
