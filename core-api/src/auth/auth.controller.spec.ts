import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, UserProfile } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { StorageService } from '../storage/storage.service';

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
    emailVerified: true,
    twoFactorEnabled: true,
    provider: 'local',
    hasPassword: true,
  };

  const mockAuthService = {
    createUser: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    login: jest.fn(),
    verifyTwoFactor: jest.fn(),
    resendTwoFactor: jest.fn(),
    googleLogin: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
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
    it('returns the verification flow result', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
        nom: 'Test',
      };
      const registerResult = {
        requiresEmailVerification: true,
        email: dto.email,
        emailSent: true,
        message: 'Code envoyé',
      };
      mockAuthService.createUser.mockResolvedValue(registerResult);

      const result = await controller.register(dto);

      expect(service.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, ...registerResult });
    });
  });

  describe('verifyEmail', () => {
    it('returns the verification result', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({
        verified: true,
        message: 'Vérifié',
      });

      const result = await controller.verifyEmail({
        email: 'test@example.com',
        code: '123456',
      });

      expect(service.verifyEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
      expect(result).toEqual({
        success: true,
        verified: true,
        message: 'Vérifié',
      });
    });
  });

  describe('resendVerification', () => {
    it('returns the generic resend result', async () => {
      const resendResult = {
        success: true,
        resendAfterSeconds: 60,
        message: 'Si un compte non vérifié existe...',
      };
      mockAuthService.resendVerification.mockResolvedValue(resendResult);

      const result = await controller.resendVerification({
        email: 'test@example.com',
      });

      expect(service.resendVerification).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result).toEqual(resendResult);
    });
  });

  describe('forgotPassword', () => {
    it('returns the generic message without revealing account existence', async () => {
      const forgotResult = {
        success: true,
        message: 'Si un compte existe...',
      };
      mockAuthService.forgotPassword.mockResolvedValue(forgotResult);

      const result = await controller.forgotPassword({
        email: 'unknown@example.com',
      });

      expect(service.forgotPassword).toHaveBeenCalledWith(
        'unknown@example.com',
      );
      expect(result).toEqual(forgotResult);
    });
  });

  describe('login', () => {
    it('passes request metadata to the service', async () => {
      const loginBody = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      const loginResponse = {
        token: 'jwt-token',
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: mockUserProfile,
      };
      mockAuthService.login.mockResolvedValue(loginResponse);

      const result = await controller.login(
        loginBody,
        'jest-agent',
        '127.0.0.1',
      );

      expect(service.login).toHaveBeenCalledWith(
        loginBody.email,
        loginBody.password,
        { userAgent: 'jest-agent', ip: '127.0.0.1' },
      );
      expect(result).toEqual({ success: true, ...loginResponse });
    });

    it('returns a 2FA challenge', async () => {
      const challenge = {
        requiresTwoFactor: true,
        challengeToken: 'challenge-token',
        email: 'test@example.com',
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      };
      mockAuthService.login.mockResolvedValue(challenge);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toEqual({ success: true, ...challenge });
    });
  });

  describe('verifyTwoFactor', () => {
    it('returns auth tokens', async () => {
      const tokens = {
        token: 'jwt-token',
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: mockUserProfile,
      };
      mockAuthService.verifyTwoFactor.mockResolvedValue(tokens);

      const result = await controller.verifyTwoFactor(
        { challengeToken: 'challenge', code: '123456' },
        'jest-agent',
        '127.0.0.1',
      );

      expect(service.verifyTwoFactor).toHaveBeenCalledWith(
        'challenge',
        '123456',
        { userAgent: 'jest-agent', ip: '127.0.0.1' },
      );
      expect(result).toEqual({ success: true, ...tokens });
    });
  });

  describe('resendTwoFactor', () => {
    it('returns the resend result', async () => {
      const resendResult = {
        success: true,
        emailSent: true,
        resendAfterSeconds: 60,
        message: 'Code envoyé',
      };
      mockAuthService.resendTwoFactor.mockResolvedValue(resendResult);

      const result = await controller.resendTwoFactor({
        challengeToken: 'challenge',
      });

      expect(result).toEqual(resendResult);
    });
  });

  describe('googleLogin', () => {
    it('returns auth tokens', async () => {
      const tokens = {
        token: 'jwt-token',
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: { ...mockUserProfile, provider: 'google' as const },
      };
      mockAuthService.googleLogin.mockResolvedValue(tokens);

      const result = await controller.googleLogin(
        { idToken: 'google-id-token' },
        'jest-agent',
        '127.0.0.1',
      );

      expect(service.googleLogin).toHaveBeenCalledWith('google-id-token', {
        userAgent: 'jest-agent',
        ip: '127.0.0.1',
      });
      expect(result).toEqual({ success: true, ...tokens });
    });
  });

  describe('refresh', () => {
    it('returns rotated tokens', async () => {
      const tokens = {
        token: 'jwt-token',
        accessToken: 'jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        user: mockUserProfile,
      };
      mockAuthService.refresh.mockResolvedValue(tokens);

      const result = await controller.refresh(
        { refreshToken: 'old-refresh-token' },
        'jest-agent',
        '127.0.0.1',
      );

      expect(service.refresh).toHaveBeenCalledWith('old-refresh-token', {
        userAgent: 'jest-agent',
        ip: '127.0.0.1',
      });
      expect(result).toEqual({ success: true, ...tokens });
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout({
        refreshToken: 'refresh-token',
      });

      expect(service.logout).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual({ success: true });
    });
  });

  describe('me', () => {
    it('returns the current user', async () => {
      const result = await controller.me(mockUserProfile);
      expect(result).toEqual({ user: mockUserProfile });
    });
  });

  describe('updateProfile', () => {
    it('returns the updated profile and verification flag', async () => {
      const updateDto = { nom: 'Updated Nom' };
      const updatedProfile = {
        ...mockUserProfile,
        nom: 'Updated Nom',
      };
      mockAuthService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUserProfile, updateDto);

      expect(service.updateProfile).toHaveBeenCalledWith(
        mockUserProfile.uid,
        updateDto,
      );
      expect(result).toEqual({
        success: true,
        user: updatedProfile,
        requiresEmailVerification: false,
      });
    });
  });

  describe('promote', () => {
    it('promotes the user and returns a success message', async () => {
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
