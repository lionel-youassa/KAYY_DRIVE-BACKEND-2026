// jest-setup.js
require('dotenv').config({ path: '.env.test' });

// 1. Mock global de Prisma pour éviter les tentatives de connexions $connect()
jest.mock('./src/prisma/prisma.service', () => {
    return {
        PrismaService: jest.fn().mockImplementation(() => ({
            onModuleInit: jest.fn().mockResolvedValue(true),
            onModuleDestroy: jest.fn().mockResolvedValue(true),
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
            publicite: { create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
            recompense: { create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
            positionUtilisateur: { upsert: jest.fn(), delete: jest.fn() },
        })),
    };
});

// 2. Mock global de Firebase (Firestore) pour éviter les appels réseau
jest.mock('firebase-admin', () => ({
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
                set: jest.fn().mockResolvedValue(true),
                delete: jest.fn().mockResolvedValue(true),
            })),
            add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
            where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: [] }),
            })),
        })),
    })),
}));