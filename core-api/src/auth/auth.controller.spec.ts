import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, UserProfile } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockUserProfile: UserProfile = {
    uid: 'user-123',
    email: 'test@example.com',
    nom: 'Test',
    prenom: 'User',
    telephone: '+237123456',
    role: 'user',
    dateCreation: '2026-07-09T10:00:00Z',
  };

  const mockAuthService = {
    createUser: jest.fn(),
    checkUserExists: jest.fn(),
    login: jest.fn(),
    updateProfile: jest.fn(),
    setUserRole: jest.fn(),
    changePassword: jest.fn(),
    updatePhoto: jest.fn(),
  };

  const mockStorageService = {
    uploadFile: jest
      .fn()
      .mockResolvedValue('http://localhost:9000/kayydrive/photo.jpg'),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
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

  describe('register', () => {
    it('should create and return user profile', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        nom: 'Test',
      };
      mockAuthService.createUser.mockResolvedValue(mockUserProfile);

      const result = await controller.register(dto);

      expect(service.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, user: mockUserProfile });
    });
  });

  describe('forgotPassword', () => {
    it('should throw BadRequestException if email not provided', async () => {
      await expect(controller.forgotPassword('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockAuthService.checkUserExists.mockResolvedValue(false);
      await expect(
        controller.forgotPassword('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return success message if user exists', async () => {
      mockAuthService.checkUserExists.mockResolvedValue(true);
      const result = await controller.forgotPassword('test@example.com');
      expect(result).toEqual({
        success: true,
        message: 'Un e-mail de réinitialisation de mot de passe a été envoyé.',
      });
    });
  });

  describe('login', () => {
    it('should return token and user profile on success', async () => {
      const loginBody = { email: 'test@example.com', password: 'password123' };
      const loginResponse = { token: 'jwt-token', user: mockUserProfile };
      mockAuthService.login.mockResolvedValue(loginResponse);

      const result = await controller.login(loginBody);

      expect(service.login).toHaveBeenCalledWith(
        loginBody.email,
        loginBody.password,
      );
      expect(result).toEqual({ success: true, ...loginResponse });
    });
  });

  describe('me', () => {
    it('should return the current user', async () => {
      const result = await controller.me(mockUserProfile);
      expect(result).toEqual({ user: mockUserProfile });
    });
  });

  describe('updateProfile', () => {
    it('should update and return updated user profile', async () => {
      const updateDto = { nom: 'Updated Nom' };
      const updatedProfile = { ...mockUserProfile, nom: 'Updated Nom' };
      mockAuthService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUserProfile, updateDto);

      expect(service.updateProfile).toHaveBeenCalledWith(
        mockUserProfile.uid,
        updateDto,
      );
      expect(result).toEqual({ success: true, user: updatedProfile });
    });
  });

  describe('promote', () => {
    it('should promote user and return success message', async () => {
      const promoteDto = { uid: 'user-123', role: 'admin' as const };
      mockAuthService.setUserRole.mockResolvedValue(undefined);

      const result = await controller.promote(promoteDto);

      expect(service.setUserRole).toHaveBeenCalledWith(
        promoteDto.uid,
        promoteDto.role,
      );
      expect(result).toEqual({
        success: true,
        message: 'Rôle mis à jour : admin',
      });
    });
  });
});
