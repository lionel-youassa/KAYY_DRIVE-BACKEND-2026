import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, UserProfile } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockUserProfile: UserProfile = {
    uid: 'user-uuid-123',
    email: 'jean@kayydrive.cm',
    nom: 'Jean Dupont',
    telephone: '690000000',
    role: 'user',
    dateCreation: '2026-07-01T12:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            createUser: jest.fn(),
            login: jest.fn(),
            setUserRole: jest.fn(),
          },
        },
      ],
    })
        .overrideGuard(AuthGuard)
        .useValue({ canActivate: jest.fn(() => true) })
        .overrideGuard(AdminGuard)
        .useValue({ canActivate: jest.fn(() => true) })
        .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/register', () => {
    it('devrait enregistrer un utilisateur et retourner son profil', async () => {
      const dto = { email: 'jean@kayydrive.cm', password: 'password123', nom: 'Jean Dupont', telephone: '690000000' };
      jest.spyOn(service, 'createUser').mockResolvedValue(mockUserProfile);

      const result = await controller.register(dto);

      expect(service.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, user: mockUserProfile });
    });
  });

  describe('POST /auth/login', () => {
    it('devrait connecter l\'utilisateur et retourner le token d\'accès', async () => {
      const loginResult = { access_token: 'jwt-token-xyz', user: mockUserProfile };
      jest.spyOn(service, 'login').mockResolvedValue(loginResult);

      const result = await controller.login({ email: 'jean@kayydrive.cm', password: 'password123' });

      expect(service.login).toHaveBeenCalledWith('jean@kayydrive.cm', 'password123');
      expect(result).toEqual({ success: true, ...loginResult });
    });
  });

  describe('GET /auth/me', () => {
    it('devrait renvoyer les informations de l\'utilisateur actuellement connecté', async () => {
      const result = await controller.me(mockUserProfile);
      expect(result).toEqual({ user: mockUserProfile });
    });
  });

  describe('POST /auth/promote', () => {
    it('devrait changer le rôle d\'un utilisateur et renvoyer un message de succès', async () => {
      const dto = { uid: 'user-uuid-123', role: 'admin' as const };
      jest.spyOn(service, 'setUserRole').mockResolvedValue(undefined);

      const result = await controller.promote(dto);

      expect(service.setUserRole).toHaveBeenCalledWith(dto.uid, dto.role);
      expect(result).toEqual({ success: true, message: 'Rôle mis à jour : admin' });
    });
  });
});