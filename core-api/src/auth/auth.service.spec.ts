import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, UserRole } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockDate = new Date('2026-07-01T12:00:00.000Z');

  const mockDbUser = {
    id: 'user-uuid-123',
    pseudo: 'Jean Dupont',
    email: 'jean@kayydrive.cm',
    passwordHash: 'hashedPassword123',
    telephone: '690000000',
    role: 'user',
    scoreReputation: 0,
    dateCreation: mockDate,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            utilisateur: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
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
    const registerInput = {
      email: 'jean@kayydrive.cm',
      password: 'password123',
      nom: 'Jean Dupont',
      telephone: '690000000',
    };

    it('devrait créer un utilisateur avec succès si l\'email est disponible', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedPassword123');
      jest.spyOn(prismaService.utilisateur, 'create').mockResolvedValue(mockDbUser);

      const result = await service.createUser(registerInput);

      expect(prismaService.utilisateur.findUnique).toHaveBeenCalledWith({ where: { email: registerInput.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, 10);
      expect(prismaService.utilisateur.create).toHaveBeenCalled();
      expect(result).toEqual({
        uid: mockDbUser.id,
        email: mockDbUser.email,
        nom: mockDbUser.pseudo,
        telephone: mockDbUser.telephone,
        role: mockDbUser.role as UserRole,
        dateCreation: mockDbUser.dateCreation.toISOString(),
      });
    });

    it('devrait lever une exception ConflictException si l\'email existe déjà', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(mockDbUser);

      await expect(service.createUser(registerInput)).rejects.toThrow(ConflictException);
      expect(prismaService.utilisateur.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('devrait retourner un access_token et le profil si les identifiants sont valides', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(mockDbUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token-xyz');

      const result = await service.login('jean@kayydrive.cm', 'password123');

      expect(result).toHaveProperty('access_token', 'jwt-token-xyz');
      expect(result.user.uid).toBe(mockDbUser.id);
    });

    it('devrait lever une exception UnauthorizedException si le mot de passe est incorrect', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(mockDbUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(service.login('jean@kayydrive.cm', 'mauvais-pass')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('devrait retourner l\'utilisateur sans le passwordHash si valide', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(mockDbUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const result = await service.validateUser('jean@kayydrive.cm', 'password123');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(mockDbUser.id);
    });

    it('devrait retourner null si l\'utilisateur n\'existe pas', async () => {
      jest.spyOn(prismaService.utilisateur, 'findUnique').mockResolvedValue(null);

      const result = await service.validateUser('inconnu@kayydrive.cm', 'password123');

      expect(result).toBeNull();
    });
  });

  describe('setUserRole', () => {
    it('devrait mettre à jour le rôle de l\'utilisateur dans la base de données', async () => {
      jest.spyOn(prismaService.utilisateur, 'update').mockResolvedValue(mockDbUser);

      await service.setUserRole('user-uuid-123', 'admin');

      expect(prismaService.utilisateur.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
        data: { role: 'admin' },
      });
    });
  });
});