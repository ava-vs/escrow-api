import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './migrations',
  dialect: 'sqlite', // D1 uses SQLite
  driver: 'd1-http',
  dbCredentials: {
    // These will be set by wrangler for local development
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
  verbose: true,
  strict: true,
});