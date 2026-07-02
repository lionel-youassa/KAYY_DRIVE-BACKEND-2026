import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from './firebase.service';
import * as firebaseApp from 'firebase-admin/app';
import * as firebaseFirestore from 'firebase-admin/firestore';
import * as firebaseAuth from 'firebase-admin/auth';
import * as firebaseMessaging from 'firebase-admin/messaging';

// Mock complet et propre des sous-modules firebase-admin
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
    getApps: jest.fn().mockReturnValue([]),
    cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn().mockReturnValue({ type: 'firestore-mock' }),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: jest.fn().mockReturnValue({ type: 'auth-mock' }),
}));

jest.mock('firebase-admin/messaging', () => ({
    getMessaging: jest.fn().mockReturnValue({ type: 'messaging-mock' }),
}));

describe('FirebaseService', () => {
    let service: FirebaseService;
    const originalEnv = process.env.FIREBASE_ADMIN_CONFIG;

    beforeEach(async () => {
        // On s'assure qu'une variable par défaut est présente pour éviter le crash au chargement initial du module NestJS
        process.env.FIREBASE_ADMIN_CONFIG = originalEnv || JSON.stringify({
            project_id: 'default',
            private_key: 'mock-key',
            client_email: 'mock-email'
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [FirebaseService],
        }).compile();

        service = module.get<FirebaseService>(FirebaseService);
    });

    afterEach(() => {
        process.env.FIREBASE_ADMIN_CONFIG = originalEnv;
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('devrait afficher un avertissement si FIREBASE_ADMIN_CONFIG n est pas défini', () => {
            delete process.env.FIREBASE_ADMIN_CONFIG;
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const initializeAppSpy = jest.spyOn(firebaseApp, 'initializeApp');

            service.onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('FIREBASE_ADMIN_CONFIG non défini')
            );
            expect(initializeAppSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('devrait initialiser Firebase avec succès si la configuration est valide', () => {
            const mockConfig = {
                project_id: 'kayy-drive-test',
                private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----',
                client_email: 'firebase-adminsdk@kayy-drive.iam.gserviceaccount.com',
            };
            process.env.FIREBASE_ADMIN_CONFIG = JSON.stringify(mockConfig);

            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const initializeAppSpy = jest.spyOn(firebaseApp, 'initializeApp').mockImplementation();

            service.onModuleInit();

            // Vérifie que l'initialisation a bien eu lieu via l'espion explicite
            expect(initializeAppSpy).toHaveBeenCalled();

            // Vérifie que les instances associées ont été rattachées
            expect(service.db).toEqual({ type: 'firestore-mock' });
            expect(service.auth).toEqual({ type: 'auth-mock' });
            expect(service.messaging).toEqual({ type: 'messaging-mock' });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Firebase initialisé avec succès')
            );
            logSpy.mockRestore();
        });

        it('devrait intercepter l erreur si le JSON de configuration est invalide', () => {
            process.env.FIREBASE_ADMIN_CONFIG = 'JSON-INVALID';
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const initializeAppSpy = jest.spyOn(firebaseApp, 'initializeApp');

            service.onModuleInit();

            expect(errorSpy).toHaveBeenCalled();
            expect(initializeAppSpy).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});