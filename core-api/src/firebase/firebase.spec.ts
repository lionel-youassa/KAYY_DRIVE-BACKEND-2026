import { Test, type TestingModule } from '@nestjs/testing';
import { FirebaseModule } from './firebase.module';
import { FirebaseService } from './firebase.service';
import * as firebaseAdminApp from 'firebase-admin/app';
import * as firebaseAdminFirestore from 'firebase-admin/firestore';
import * as firebaseAdminAuth from 'firebase-admin/auth';
import * as firebaseAdminMessaging from 'firebase-admin/messaging';

// --- MOCKS DU SDK FIREBASE ADMIN ---
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
    getApps: jest.fn(() => []),
    cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({ type: 'firestore-mock' })),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: jest.fn(() => ({ type: 'auth-mock' })),
}));

jest.mock('firebase-admin/messaging', () => ({
    getMessaging: jest.fn(() => ({ type: 'messaging-mock' })),
}));

describe('Firebase (Module & Service)', () => {
    let service: FirebaseService;
    let module: TestingModule;
    let originalEnv: string | undefined;

    beforeEach(() => {
        // Sauvegarde de l'environnement originel
        originalEnv = process.env.FIREBASE_ADMIN_CONFIG;
        jest.clearAllMocks();

        // Espionnage des logs consoles pour éviter de polluer le terminal de test
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        process.env.FIREBASE_ADMIN_CONFIG = originalEnv;
        if (module) {
            await module.close();
        }
    });

    // --- LOGIQUE DE COMPILATION DU MODULE ---
    const createTestingModule = async () => {
        module = await Test.createTestingModule({
            imports: [FirebaseModule],
        }).compile();

        service = module.get<FirebaseService>(FirebaseService);
    };

    // --- TESTS ---

    it('should be defined and export FirebaseService', async () => {
        process.env.FIREBASE_ADMIN_CONFIG = JSON.stringify({ project_id: 'test' });
        await createTestingModule();

        expect(module).toBeDefined();
        expect(service).toBeDefined();
    });

    it('should log a warning and skip initialization if FIREBASE_ADMIN_CONFIG is missing', async () => {
        delete process.env.FIREBASE_ADMIN_CONFIG;

        await createTestingModule();

        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('FIREBASE_ADMIN_CONFIG non défini'),
        );
        expect(firebaseAdminApp.initializeApp).not.toHaveBeenCalled();
        expect(service.db).toBeUndefined();
    });

    it('should initialize Firebase successfully when config is valid', async () => {
        const validConfig = { project_id: 'kayydrive-2026', private_key: 'test-key' };
        process.env.FIREBASE_ADMIN_CONFIG = JSON.stringify(validConfig);

        await createTestingModule();

        // Vérifie que l'app s'initialise avec les bonnes méthodes
        expect(firebaseAdminApp.cert).toHaveBeenCalled();
        expect(firebaseAdminApp.initializeApp).toHaveBeenCalled();

        // Vérifie l'injection des sous-services exposés publiquement
        expect(firebaseAdminFirestore.getFirestore).toHaveBeenCalled();
        expect(firebaseAdminAuth.getAuth).toHaveBeenCalled();
        expect(firebaseAdminMessaging.getMessaging).toHaveBeenCalled();

        expect(service.db).toEqual({ type: 'firestore-mock' });
        expect(service.auth).toEqual({ type: 'auth-mock' });
        expect(service.messaging).toEqual({ type: 'messaging-mock' });

        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Firebase initialisé avec succès'),
        );
    });

    it('should not call initializeApp if an instance is already initialized', async () => {
        process.env.FIREBASE_ADMIN_CONFIG = JSON.stringify({ project_id: 'test' });

        // Simuler qu'une app Firebase existe déjà au runtime
        jest.spyOn(firebaseAdminApp, 'getApps').mockReturnValue([{ name: '[DEFAULT]' } as any]);

        await createTestingModule();

        expect(firebaseAdminApp.initializeApp).not.toHaveBeenCalled();
        expect(firebaseAdminFirestore.getFirestore).toHaveBeenCalled();
    });

    it('should catch and log errors if JSON parsing or initialization fails', async () => {
        // Fournir un JSON invalide pour forcer un crash dans le bloc try-catch
        process.env.FIREBASE_ADMIN_CONFIG = '{ invalid-json }';

        await createTestingModule();

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("Erreur lors de l'initialisation Firebase:"),
            expect.any(String),
        );
        // S'assurer que les variables n'ont pas été peuplées indûment
        expect(service.db).toBeUndefined();
    });
});