import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    utilisateur: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const createInput = {
      email: 'test@example.com',
      password: 'password123',
      nom: 'Test User',
      telephone: '+237123456789',
    };

    it('should create a new user successfully', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      
      const createdDbUser = {
        id: 'user-uuid',
        pseudo: createInput.nom,
        email: createInput.email,
        passwordHash: 'hashed_password',
        telephone: createInput.telephone,
        role: 'user',
        prenom: '',
        scoreReputation: 0,
        dateCreation: new Date('2026-07-08T12:00:00Z'),
      };
      mockPrismaService.utilisateur.create.mockResolvedValue(createdDbUser);

      const result = await service.createUser(createInput);

      expect(prismaService.utilisateur.findUnique).toHaveBeenCalledWith({
        where: { email: createInput.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createInput.password, 10);
      expect(prismaService.utilisateur.create).toHaveBeenCalled();
      expect(result).toEqual({
        uid: 'user-uuid',
        email: 'test@example.com',
        nom: 'Test User',
        prenom: '',
        telephone: '+237123456789',
        role: 'user',
        dateCreation: createdDbUser.dateCreation.toISOString(),
      });
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createUser(createInput)).rejects.toThrow(ConflictException);
      expect(prismaService.utilisateur.create).not.toHaveBeenCalled();
    });
  });

  describe('checkUserExists', () => {
    it('should return true if user exists', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue({ id: 'exists' });
      const result = await service.checkUserExists('test@example.com');
      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      const result = await service.checkUserExists('test@example.com');
      expect(result).toBe(false);
    });
  });

  describe('login', () => {
    const loginEmail = 'test@example.com';
    const loginPass = 'password123';
    const dbUser = {
      id: 'user-uuid',
      pseudo: 'Test User',
      email: loginEmail,
      passwordHash: 'hashed_password',
      role: 'user',
      prenom: 'Test',
      telephone: '+237123',
      dateCreation: new Date('2026-07-08T12:00:00Z'),
    };

    it('should return token and user profile on successful login', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login(loginEmail, loginPass);

      expect(prismaService.utilisateur.findUnique).toHaveBeenCalledWith({
        where: { email: loginEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginPass, 'hashed_password');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
      });
      expect(result).toEqual({
        token: 'jwt_token',
        user: {
          uid: 'user-uuid',
          email: loginEmail,
          nom: 'Test User',
          prenom: 'Test',
          telephone: '+237123',
          role: 'user',
          dateCreation: dbUser.dateCreation.toISOString(),
        },
      });
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginEmail, loginPass)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);

      await expect(service.login(loginEmail, loginPass)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    const dbUser = {
      id: 'user-uuid',
      pseudo: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      role: 'user',
    };

    it('should return user object without passwordHash if credentials are valid', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'pass');

      expect(result).toEqual({
        id: 'user-uuid',
        pseudo: 'Test User',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('should return null if password invalid', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'pass');
      expect(result).toBeNull();
    });
  });

  describe('setUserRole', () => {
    it('should call prisma.utilisateur.update to change role', async () => {
      mockPrismaService.utilisateur.update.mockResolvedValue({});
      await service.setUserRole('user-uuid', 'admin');
      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: { role: 'admin' },
      });
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile if found', async () => {
      const dbUser = {
        id: 'user-uuid',
        pseudo: 'Nom',
        prenom: 'Prenom',
        email: 'test@example.com',
        telephone: '+2379',
        role: 'user',
        dateCreation: new Date('2026-07-08T12:00:00Z'),
      };
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(dbUser);

      const result = await service.getUserProfile('user-uuid');

      expect(result).toEqual({
        uid: 'user-uuid',
        email: 'test@example.com',
        nom: 'Nom',
        prenom: 'Prenom',
        telephone: '+2379',
        role: 'user',
        dateCreation: dbUser.dateCreation.toISOString(),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValue(null);
      await expect(service.getUserProfile('user-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const dbUser = {
      id: 'user-uuid',
      pseudo: 'Nom',
      prenom: 'Prenom',
      email: 'test@example.com',
      telephone: '+2379',
      role: 'user',
      dateCreation: new Date('2026-07-08T12:00:00Z'),
    };

    it('should update profile fields successfully', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValueOnce(dbUser); // for checking existance
      mockPrismaService.utilisateur.findUnique.mockResolvedValueOnce(null); // for email availability
      mockPrismaService.utilisateur.update.mockResolvedValue({
        ...dbUser,
        pseudo: 'New Nom',
        email: 'new@example.com',
      });

      const result = await service.updateProfile('user-uuid', {
        nom: 'New Nom',
        email: 'new@example.com',
      });

      expect(result.nom).toBe('New Nom');
      expect(result.email).toBe('new@example.com');
      expect(prismaService.utilisateur.update).toHaveBeenCalled();
    });

    it('should throw ConflictException if new email is already taken by someone else', async () => {
      mockPrismaService.utilisateur.findUnique.mockResolvedValueOnce(dbUser);
      mockPrismaService.utilisateur.findUnique.mockResolvedValueOnce({ id: 'other-user-uuid' });

      await expect(service.updateProfile('user-uuid', { email: 'taken@example.com' }))
        .rejects.toThrow(ConflictException);
    });
  });
});
