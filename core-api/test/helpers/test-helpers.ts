import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Create a test user
 */
export async function createTestUser(overrides: Partial<any> = {}) {
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  return prisma.utilisateur.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      pseudo: overrides.pseudo || `TestUser${Date.now()}`,
      passwordHash,
      role: overrides.role || 'user',
      scoreReputation: overrides.scoreReputation || 0,
      ...overrides,
    },
  });
}

/**
 * Create an admin user
 */
export async function createTestAdmin(overrides: Partial<any> = {}) {
  const passwordHash = await bcrypt.hash('AdminPassword123!', 10);

  return prisma.utilisateur.create({
    data: {
      email: overrides.email || `admin-${Date.now()}@example.com`,
      pseudo: overrides.pseudo || `TestAdmin${Date.now()}`,
      passwordHash,
      role: 'admin',
      scoreReputation: overrides.scoreReputation || 0,
      ...overrides,
    },
  });
}

/**
 * Create a test category
 */
export async function createTestCategory(overrides: Partial<any> = {}) {
  return prisma.categorie.create({
    data: {
      nom: overrides.nom || `TestCategory${Date.now()}`,
      icone: overrides.icone || 'test',
      couleur: overrides.couleur || '#000000',
      ordre: overrides.ordre || 1,
      ...overrides,
    },
  });
}

/**
 * Create a test incident
 */
export async function createTestIncident(overrides: Partial<any> = {}) {
  const user = overrides.idRapporteur || (await createTestUser());

  return prisma.incident.create({
    data: {
      type: overrides.type || 'INONDATION',
      description: overrides.description || 'Test incident',
      idRapporteur: typeof user === 'string' ? user : user.id,
      latitude: overrides.latitude || 3.8488,
      longitude: overrides.longitude || 11.5021,
      statut: overrides.statut || 'non_confirme',
      ...overrides,
    },
  });
}

/**
 * Create a test shortcut
 */
export async function createTestShortcut(overrides: Partial<any> = {}) {
  const user = overrides.idUtilisateurCreateur || (await createTestUser());

  return prisma.raccourciCommunautaire.create({
    data: {
      nom: overrides.nom || `TestShortcut${Date.now()}`,
      description: overrides.description || 'Test shortcut',
      pointDepartLat: overrides.pointDepartLat || 3.8488,
      pointDepartLng: overrides.pointDepartLng || 11.5021,
      pointArriveeLat: overrides.pointArriveeLat || 3.85,
      pointArriveeLng: overrides.pointArriveeLng || 11.505,
      trace: overrides.trace || { type: 'LineString', coordinates: [] },
      idUtilisateurCreateur: typeof user === 'string' ? user : user.id,
      ...overrides,
    },
  });
}

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
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
        // Ignore errors for tables that might not exist
      }
    }
  }
}
