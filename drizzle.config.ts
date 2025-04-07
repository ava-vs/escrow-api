import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is required');
}

export default defineConfig({
  schema: './lib/schema/*.ts',
  out: './drizzle',
  // @ts-ignore - корректный тип для PostgreSQL
  driver: 'pg',
  // @ts-ignore - корректная конфигурация для PostgreSQL
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL || '',
  },
  verbose: true,
  strict: true,
});
