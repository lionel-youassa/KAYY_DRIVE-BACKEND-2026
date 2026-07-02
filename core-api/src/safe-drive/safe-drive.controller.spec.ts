import { Test, TestingModule } from '@nestjs/testing';
import { SafeDriveController } from './safe-drive.controller';
import { SafeDriveService } from './safe-drive.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { SecousseDto } from './dto/secousse.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('SafeDriveController', () => {
    let controller: SafeDriveController;
    let service: SafeDriveService;

    // Mock de l'utilisateur Firebase renvoyé par le Guard / Décorateur
    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-safe-driver-xyz',
        email: 'driver-test@kayydrive.cm',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SafeDriveController],
            providers: [
                {
                    provide: SafeDriveService,
                    useValue: {
                        ajouterSecousse: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        })
            // Court-circuit du guard d'authentification pour isoler le contrôleur
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<SafeDriveController>(SafeDriveController);
        service = module.get<SafeDriveService>(SafeDriveService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('POST /safe-drive/secousse (secousse)', () => {
        it('devrait appeler ajouterSecousse avec l\'UID de l\'utilisateur et un timestamp valide', async () => {
            const dto: SecousseDto = {
                latitude: 4.0511,
                longitude: 9.7679,
                intensite: 3.5,
            };

            const result = await controller.secousse(dto, mockFirebaseUser as DecodedIdToken);

            // On vérifie que le service a été appelé avec les données du DTO, l'UID injecté et un string ISO pour la date.
            expect(service.ajouterSecousse).toHaveBeenCalledWith({
                id_utilisateur: mockFirebaseUser.uid,
                latitude: dto.latitude,
                longitude: dto.longitude,
                intensite: dto.intensite,
                timestamp: expect.any(String), // Match n'importe quelle chaîne (représentant le new Date().toISOString())
            });

            expect(result).toEqual({
                success: true,
                message: 'Donnée reçue et mise en file',
            });
        });
    });
});