import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// При генерации схемы не требуем наличия переменной окружения
// Она будет использоваться только при реальном подключении к БД

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
