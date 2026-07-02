import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdatePositionDto } from './dto/update-position.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('UsersController', () => {
    let controller: UsersController;
    let service: UsersService;

    // Mock de l'utilisateur extrait par Firebase Auth
    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-driver-456',
        email: 'driver@kayydrive.cm',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: {
                        mettreAJourPosition: jest.fn().mockResolvedValue(undefined),
                        supprimerPosition: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        })
            // Court-circuit du guard d'authentification pour isoler le contrôleur
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('POST /users/position (updatePosition)', () => {
        it('devrait appeler mettreAJourPosition avec l\'UID de l\'utilisateur et les coordonnées fournies', async () => {
            const dto: UpdatePositionDto = {
                latitude: 4.0511,
                longitude: 9.7679,
            };

            const result = await controller.updatePosition(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.mettreAJourPosition).toHaveBeenCalledWith(
                mockFirebaseUser.uid,
                dto.latitude,
                dto.longitude,
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('DELETE /users/position (deletePosition)', () => {
        it('devrait appeler supprimerPosition avec l\'UID de l\'utilisateur connecté', async () => {
            const result = await controller.deletePosition(mockFirebaseUser as DecodedIdToken);

            expect(service.supprimerPosition).toHaveBeenCalledWith(mockFirebaseUser.uid);
            expect(result).toEqual({ success: true });
        });
    });
});