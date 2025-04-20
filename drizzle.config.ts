import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// При генерации схемы не требуем наличия переменной окружения
// Она будет использоваться только при реальном подключении к БД

// @ts-ignore - игнорируем ошибки типизации в конфигурации
export default defineConfig({
  schema: './lib/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  driver: 'pg',
  dbCredentials: {
    // We use an empty string as a fallback for generation only
    // The actual connection string will be used at runtime
    connectionString: process.env.POSTGRES_URL || '',
  },
  verbose: true,
  strict: true,
});
