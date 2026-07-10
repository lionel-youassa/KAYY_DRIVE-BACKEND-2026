import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  photoUrl?: string;
  role: UserRole;
  dateCreation: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // -------------------------------------------------------------------------
  // Inscription : crée le compte PostgreSQL avec mot de passe hashé
  // -------------------------------------------------------------------------
  async createUser(input: {
    email: string;
    password: string;
    nom: string;
    telephone?: string;
  }): Promise<UserProfile> {
    const { email, password, nom, telephone } = input;

    // Vérifier si l'email existe déjà
    const existingUser = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        pseudo: nom,
        email: email,
        passwordHash: passwordHash,
        telephone: telephone,
        role: 'user',
        scoreReputation: 0,
        dateCreation: new Date(),
      },
    });

    return {
      uid: utilisateur.id,
      email: utilisateur.email,
      nom: utilisateur.pseudo,
      prenom: utilisateur.prenom || '',
      telephone: utilisateur.telephone || undefined,
      photoUrl: utilisateur.photoUrl || undefined,
      role: utilisateur.role as UserRole,
      dateCreation: utilisateur.dateCreation.toISOString(),
    };
  }

  async checkUserExists(email: string): Promise<boolean> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    return !!user;
  }

  // -------------------------------------------------------------------------
  // Connexion : valide les identifiants et retourne un JWT
  // -------------------------------------------------------------------------
  async login(email: string, password: string): Promise<LoginResponse> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload = {
      sub: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        uid: utilisateur.id,
        email: utilisateur.email,
        nom: utilisateur.pseudo,
        prenom: utilisateur.prenom || '',
        telephone: utilisateur.telephone || undefined,
        photoUrl: utilisateur.photoUrl || undefined,
        role: utilisateur.role as UserRole,
        dateCreation: utilisateur.dateCreation.toISOString(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Validation utilisateur (pour stratégie locale)
  // -------------------------------------------------------------------------
  async validateUser(email: string, password: string): Promise<any> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    const { passwordHash, ...result } = utilisateur;
    return result;
  }

  // -------------------------------------------------------------------------
  // Changement de rôle (réservé admin, voir RolesGuard)
  // -------------------------------------------------------------------------
  async setUserRole(uid: string, role: UserRole): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id: uid },
      data: { role },
    });
  }

  // -------------------------------------------------------------------------
  // Récupération du profil complet
  // -------------------------------------------------------------------------
  async getUserProfile(uid: string): Promise<UserProfile> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur) {
      throw new NotFoundException('Profil introuvable');
    }

    return {
      uid: utilisateur.id,
      email: utilisateur.email,
      nom: utilisateur.pseudo,
      prenom: utilisateur.prenom || '',
      telephone: utilisateur.telephone || undefined,
      photoUrl: utilisateur.photoUrl || undefined,
      role: utilisateur.role as UserRole,
      dateCreation: utilisateur.dateCreation.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Mise à jour du profil utilisateur
  // -------------------------------------------------------------------------
  async updateProfile(
    uid: string,
    updateData: {
      nom?: string;
      prenom?: string;
      email?: string;
      telephone?: string;
    },
  ): Promise<UserProfile> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur) {
      throw new NotFoundException('Profil introuvable');
    }

    const updatePayload: any = {};

    if (updateData.nom) {
      updatePayload.pseudo = updateData.nom;
    }

    if (updateData.prenom !== undefined) {
      updatePayload.prenom = updateData.prenom;
    }

    if (updateData.email) {
      // Vérifier si l'email est déjà utilisé par un autre utilisateur
      const existingUser = await this.prisma.utilisateur.findUnique({
        where: { email: updateData.email },
      });

      if (existingUser && existingUser.id !== uid) {
        throw new ConflictException('Cet email est déjà utilisé');
      }

      updatePayload.email = updateData.email;
    }

    if (updateData.telephone !== undefined) {
      updatePayload.telephone = updateData.telephone;
    }

    const updatedUser = await this.prisma.utilisateur.update({
      where: { id: uid },
      data: updatePayload,
    });

    return {
      uid: updatedUser.id,
      email: updatedUser.email,
      nom: updatedUser.pseudo,
      prenom: updatedUser.prenom || '',
      telephone: updatedUser.telephone || undefined,
      photoUrl: updatedUser.photoUrl || undefined,
      role: updatedUser.role as UserRole,
      dateCreation: updatedUser.dateCreation.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Modification sécurisée de mot de passe
  // -------------------------------------------------------------------------
  async changePassword(
    uid: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier l'ancien mot de passe
    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('L\'ancien mot de passe est incorrect');
    }

    // Hasher et mettre à jour le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.utilisateur.update({
      where: { id: uid },
      data: { passwordHash: newPasswordHash },
    });
  }

  // -------------------------------------------------------------------------
  // Mise à jour de la photo de profil
  // -------------------------------------------------------------------------
  async updatePhoto(uid: string, photoUrl: string): Promise<UserProfile> {
    const updatedUser = await this.prisma.utilisateur.update({
      where: { id: uid },
      data: { photoUrl },
    });

    return {
      uid: updatedUser.id,
      email: updatedUser.email,
      nom: updatedUser.pseudo,
      prenom: updatedUser.prenom || '',
      telephone: updatedUser.telephone || undefined,
      photoUrl: updatedUser.photoUrl || undefined,
      role: updatedUser.role as UserRole,
      dateCreation: updatedUser.dateCreation.toISOString(),
    };
  }
}
