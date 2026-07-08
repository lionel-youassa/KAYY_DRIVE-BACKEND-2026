import { PrismaClient } from '@prisma/client';

const hasDatabase = !!process.env.DATABASE_URL;
const prisma = hasDatabase ? new PrismaClient() : null;

beforeAll(async () => {
  if (prisma) {
    await prisma.$connect();
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!prisma) return;

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
