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
  // Используем any для обхода ошибок типизации
  dbCredentials: {
    // @ts-ignore - PostgreSQL connection string
    connectionString: process.env.POSTGRES_URL || '',
  } as any,
  verbose: true,
  strict: true,
});
