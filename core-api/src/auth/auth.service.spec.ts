import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { GoogleAuthService } from './google-auth.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: JwtService;
  let emailService: any;
  let googleAuthService: any;

  const mockPrismaService: any = {
    utilisateur: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationCode: jest.fn(),
    sendTwoFactorCode: jest.fn(),
    sendPasswordResetCode: jest.fn(),
  };

  const mockGoogleAuthService = {
    verifyIdToken: jest.fn(),
  };

  const baseDbUser = {
    id: 'user-uuid',
    pseudo: 'Test User',
    prenom: 'Test',
    email: 'test@example.com',
    pendingEmail: null,
    passwordHash: 'hashed_password',
    telephone: '+237123',
    role: 'user',
    scoreReputation: 0,
    dateCreation: new Date('2026-07-08T12:00:00Z'),
    googleId: null,
    emailVerified: true,
    twoFactorEnabled: false,
    emailVerificationCodeHash: null,
    emailVerificationExpiresAt: null,
    emailVerificationAttempts: 0,
    emailVerificationLastSentAt: null,
    twoFactorCodeHash: null,
    twoFactorExpiresAt: null,
    twoFactorAttempts: 0,
    twoFactorLastSentAt: null,
    passwordResetCodeHash: null,
    passwordResetExpiresAt: null,
    passwordResetAttempts: 0,
    passwordResetLastSentAt: null,
    lastLoginAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: GoogleAuthService,
          useValue: mockGoogleAuthService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get(EmailService);
    googleAuthService = module.get(GoogleAuthService);

    mockPrismaService.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(mockPrismaService);
      }
      return Promise.all(arg);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const createInput = {
      email: 'New@Example.com',
      password: 'Password123!',
      nom: 'Test User',
      telephone: '+237123456789',
    };

    it('creates an unverified user and sends a verification code', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrismaService.utilisateur.create.mockResolvedValue({
        ...baseDbUser,
        email: 'new@example.com',
        pseudo: createInput.nom,
        passwordHash: 'hashed_password',
        emailVerified: false,
        twoFactorEnabled: true,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      mockEmailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.createUser(createInput);

      expect(prismaService.utilisateur.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'new@example.com' },
            { pendingEmail: 'new@example.com' },
          ],
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createInput.password, 12);
      expect(prismaService.utilisateur.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          emailVerified: false,
          twoFactorEnabled: true,
        }),
      });
      expect(emailService.sendVerificationCode).toHaveBeenCalled();
      expect(result.requiresEmailVerification).toBe(true);
      expect(result.emailSent).toBe(true);
    });

    it('throws ConflictException if email is already taken', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(service.createUser(createInput)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.utilisateur.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns access and refresh tokens when 2FA is disabled', async () => {
      const dbUser = { ...baseDbUser };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...dbUser,
        lastLoginAt: new Date(),
      });
      mockJwtService.sign.mockReturnValue('access-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result: any = await service.login(
        'test@example.com',
        'password123',
        { userAgent: 'jest', ip: '127.0.0.1' },
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed_password',
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
        },
        { expiresIn: 900 },
      );
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          utilisateurId: dbUser.id,
          userAgent: 'jest',
          ip: '127.0.0.1',
        }),
      });
      expect(result.token).toBe('access-token');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.expiresIn).toBe(900);
      expect(result.user).toEqual(
        expect.objectContaining({
          uid: dbUser.id,
          email: dbUser.email,
          emailVerified: true,
          provider: 'local',
          hasPassword: true,
        }),
      );
    });

    it('returns a 2FA challenge when enabled', async () => {
      const dbUser = {
        ...baseDbUser,
        twoFactorEnabled: true,
        twoFactorLastSentAt: null,
      };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.utilisateur.update.mockResolvedValue(dbUser);
      mockEmailService.sendTwoFactorCode.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValue('challenge-token');

      const result: any = await service.login(
        'test@example.com',
        'password123',
      );

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.challengeToken).toBe('challenge-token');
      expect(result.email).toBe(dbUser.email);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: expect.objectContaining({
          twoFactorCodeHash: expect.any(String),
          twoFactorAttempts: 0,
        }),
      });
      expect(emailService.sendTwoFactorCode).toHaveBeenCalled();
    });

    it('reuses the active 2FA code instead of sending another email', async () => {
      const dbUser = {
        ...baseDbUser,
        twoFactorEnabled: true,
        twoFactorCodeHash: 'aabb',
        twoFactorExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorLastSentAt: new Date(),
      };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('challenge-token');

      const result: any = await service.login(
        'test@example.com',
        'password123',
      );

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.resendAfterSeconds).toBeGreaterThan(0);
      expect(emailService.sendTwoFactorCode).not.toHaveBeenCalled();
      expect(prismaService.utilisateur.update).not.toHaveBeenCalled();
    });

    it('refuses login when email is not verified', async () => {
      const dbUser = {
        ...baseDbUser,
        emailVerified: false,
      };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException for an invalid password', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('asks Google-only accounts to use Google sign-in', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
        passwordHash: null,
        googleId: 'google-id',
      });

      try {
        await service.login('test@example.com', 'password123');
        fail('Expected login to throw');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({ code: 'USE_GOOGLE' }),
        );
      }
    });
  });

  describe('verifyEmail', () => {
    it('marks the email as verified when the code matches', async () => {
      const dbUser = {
        ...baseDbUser,
        emailVerified: false,
        emailVerificationCodeHash: 'aabb',
        emailVerificationExpiresAt: new Date(Date.now() + 60000),
      };
      mockPrismaService.utilisateur.findFirst.mockResolvedValue(dbUser);
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...dbUser,
        emailVerified: true,
      });
      (service as any).hashCode = jest.fn().mockReturnValue('aabb');

      const result = await service.verifyEmail('test@example.com', '123456');

      expect(result.verified).toBe(true);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: expect.objectContaining({
          emailVerified: true,
          emailVerificationCodeHash: null,
        }),
      });
    });

    it('applies a pending email after verification', async () => {
      const dbUser = {
        ...baseDbUser,
        pendingEmail: 'new@example.com',
        emailVerificationCodeHash: 'aabb',
        emailVerificationExpiresAt: new Date(Date.now() + 60000),
      };
      mockPrismaService.utilisateur.findFirst.mockResolvedValue(dbUser);
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...dbUser,
        email: 'new@example.com',
        pendingEmail: null,
      });
      (service as any).hashCode = jest.fn().mockReturnValue('aabb');

      const result = await service.verifyEmail('new@example.com', '123456');

      expect(result.verified).toBe(true);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: expect.objectContaining({
          email: 'new@example.com',
          pendingEmail: null,
          emailVerified: true,
        }),
      });
    });

    it('rejects an invalid code', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue({
        ...baseDbUser,
        emailVerified: false,
        emailVerificationCodeHash: 'aabb',
        emailVerificationExpiresAt: new Date(Date.now() + 60000),
      });
      (service as any).hashCode = jest.fn().mockReturnValue('ccdd');

      await expect(
        service.verifyEmail('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for an unknown account', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyEmail('unknown@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns early when the email is already verified', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue({
        ...baseDbUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('test@example.com', '123456');

      expect(result.verified).toBe(true);
      expect(prismaService.utilisateur.update).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('returns a generic response for unknown accounts', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue(null);

      const result = await service.resendVerification('unknown@example.com');

      expect(result.success).toBe(true);
      expect(result.resendAfterSeconds).toBe(60);
      expect(result.message).toContain('Si un compte non vérifié');
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('sends a new code for an unverified account', async () => {
      mockPrismaService.utilisateur.findFirst.mockResolvedValue({
        ...baseDbUser,
        emailVerified: false,
        emailVerificationLastSentAt: null,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      mockEmailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.resendVerification('test@example.com');

      expect(result.success).toBe(true);
      expect(result.resendAfterSeconds).toBe(60);
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        10,
      );
    });
  });

  describe('verifyTwoFactor', () => {
    it('issues tokens after a valid 2FA code', async () => {
      const dbUser = {
        ...baseDbUser,
        twoFactorEnabled: true,
        twoFactorCodeHash: 'aabb',
        twoFactorExpiresAt: new Date(Date.now() + 60000),
      };
      mockJwtService.verify.mockReturnValue({
        sub: dbUser.id,
        email: dbUser.email,
        purpose: '2fa',
      });
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...dbUser,
        twoFactorCodeHash: null,
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('access-token');
      (service as any).hashCode = jest.fn().mockReturnValue('aabb');

      const result = await service.verifyTwoFactor('challenge-token', '123456');

      expect(result.accessToken).toBe('access-token');
      expect(result.user.uid).toBe(dbUser.id);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: expect.objectContaining({
          twoFactorCodeHash: null,
          twoFactorAttempts: 0,
        }),
      });
    });

    it('rejects an invalid challenge token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(
        service.verifyTwoFactor('bad-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    const identity = {
      googleId: 'google-123',
      email: 'Google@Example.com',
      emailVerified: true,
      name: 'Google User',
      givenName: 'Google',
      picture: 'https://example.com/pic.jpg',
    };

    it('creates a Google account and issues tokens', async () => {
      googleAuthService.verifyIdToken.mockResolvedValue(identity);
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      mockPrismaService.utilisateur.create.mockResolvedValue({
        ...baseDbUser,
        email: 'google@example.com',
        googleId: identity.googleId,
        passwordHash: null,
        emailVerified: true,
        twoFactorEnabled: false,
        photoUrl: identity.picture,
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.googleLogin('id-token');

      expect(prismaService.utilisateur.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'google@example.com',
          googleId: identity.googleId,
          passwordHash: null,
          emailVerified: true,
          twoFactorEnabled: false,
        }),
      });
      expect(result.user.provider).toBe('google');
      expect(result.user.twoFactorEnabled).toBe(false);
    });

    it('links Google to an existing local account', async () => {
      googleAuthService.verifyIdToken.mockResolvedValue(identity);
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
        email: 'google@example.com',
        googleId: null,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...baseDbUser,
        email: 'google@example.com',
        googleId: identity.googleId,
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.googleLogin('id-token');

      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: expect.objectContaining({
          googleId: identity.googleId,
          emailVerified: true,
        }),
      });
      expect(result.user.provider).toBe('google');
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token', async () => {
      const stored = {
        id: 'token-id',
        tokenHash: 'old-hash',
        utilisateurId: baseDbUser.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        utilisateur: baseDbUser,
      };
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(stored);
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('old-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).not.toBe('old-refresh-token');
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: stored.id, revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          replacedByTokenHash: expect.any(String),
        }),
      });
      expect(prismaService.refreshToken.create).toHaveBeenCalled();
    });

    it('revokes all sessions when a used token is replayed', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        tokenHash: 'old-hash',
        utilisateurId: baseDbUser.id,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        utilisateur: baseDbUser,
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });

      await expect(service.refresh('used-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          utilisateurId: baseDbUser.id,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('logout', () => {
    it('revokes the provided refresh token', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });

      await expect(service.logout('refresh-token')).resolves.toEqual({
        success: true,
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: expect.any(String),
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('forgotPassword', () => {
    it('returns the same generic response for unknown accounts', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Si un compte existe');
      expect(emailService.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    it('stores a reset code and sends it to local accounts', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
        passwordResetLastSentAt: null,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      mockEmailService.sendPasswordResetCode.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('Si un compte existe');
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: expect.objectContaining({
          passwordResetCodeHash: expect.any(String),
          passwordResetAttempts: 0,
        }),
      });
      expect(emailService.sendPasswordResetCode).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password, verifies the email and revokes sessions', async () => {
      const dbUser = {
        ...baseDbUser,
        emailVerified: false,
        passwordResetCodeHash: 'aabb',
        passwordResetExpiresAt: new Date(Date.now() + 60000),
      };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      (service as any).hashCode = jest.fn().mockReturnValue('aabb');

      const result = await service.resetPassword(
        'test@example.com',
        '123456',
        'NewPassword123!',
      );

      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: expect.objectContaining({
          passwordHash: 'new-hash',
          emailVerified: true,
        }),
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('updates the password and revokes sessions', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      await service.changePassword(
        baseDbUser.id,
        'old-password',
        'NewPassword123!',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: { passwordHash: 'new-hash' },
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns the user without passwordHash when credentials are valid', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: baseDbUser.id,
          email: baseDbUser.email,
        }),
      );
      expect(result.passwordHash).toBeUndefined();
    });

    it('returns null for an invalid password', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrong'),
      ).resolves.toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('unknown@example.com', 'password'),
      ).resolves.toBeNull();
    });
  });

  describe('setUserRole', () => {
    it('updates the role', async () => {
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      await service.setUserRole('user-uuid', 'admin');
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: { role: 'admin' },
      });
    });
  });

  describe('getUserProfile', () => {
    it('returns the profile', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });

      const result = await service.getUserProfile(baseDbUser.id);

      expect(result).toEqual(
        expect.objectContaining({
          uid: baseDbUser.id,
          email: baseDbUser.email,
          nom: baseDbUser.pseudo,
          emailVerified: true,
          provider: 'local',
          hasPassword: true,
        }),
      );
    });

    it('throws when the user is missing', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      await expect(service.getUserProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates names without requiring email verification', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...baseDbUser,
        pseudo: 'New Nom',
      });

      const result = await service.updateProfile(baseDbUser.id, {
        nom: 'New Nom',
      });

      expect(result.nom).toBe('New Nom');
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: { pseudo: 'New Nom' },
      });
    });

    it('requires the current password before changing email', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
      });

      await expect(
        service.updateProfile(baseDbUser.id, {
          email: 'new@example.com',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('stores a pending email instead of changing it immediately', async () => {
      mockPrismaService.utilisateur.findUnique
        .mockResolvedValueOnce({ ...baseDbUser })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...baseDbUser,
        pendingEmail: 'new@example.com',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockEmailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.updateProfile(baseDbUser.id, {
        email: 'new@example.com',
        currentPassword: 'password123',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.pendingEmail).toBe('new@example.com');
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: expect.objectContaining({
          pendingEmail: 'new@example.com',
        }),
      });
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        10,
      );
    });

    it('cancels a pending email when the current one is submitted again', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValueOnce({
        ...baseDbUser,
        pendingEmail: 'new@example.com',
      });
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...baseDbUser,
        pendingEmail: null,
      });

      const result = await service.updateProfile(baseDbUser.id, {
        email: 'test@example.com',
      });

      expect(result.pendingEmail).toBeUndefined();
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: baseDbUser.id },
        data: expect.objectContaining({ pendingEmail: null }),
      });
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('throws when the new email belongs to another account', async () => {
      mockPrismaService.utilisateur.findUnique
        .mockResolvedValueOnce({ ...baseDbUser })
        .mockResolvedValueOnce({ id: 'other-user' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateProfile(baseDbUser.id, {
          email: 'taken@example.com',
          currentPassword: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('does not allow Google-managed accounts to change email', async () => {
      mockPrismaService.utilisateur.findUnique.mockReset();
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({
        ...baseDbUser,
        googleId: 'google-id',
      });

      await expect(
        service.updateProfile(baseDbUser.id, {
          email: 'new@example.com',
          currentPassword: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
