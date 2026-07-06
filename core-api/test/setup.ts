import * as dotenv from 'dotenv';
// Charge les variables d'environnement du fichier .env à la racine
dotenv.config({ path: '.env' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database connection if needed
});

afterAll(async () => {
  // Cleanup test database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up database before each test
  const tablenames = await prisma.$queryRaw<
      Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(
            `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      } catch (error) {
        console.log(`Error truncating table ${tablename}:`, error);
      }
    }
  }
});