import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  nom: string;
  telephone?: string;
  role: UserRole;
  dateCreation: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // -------------------------------------------------------------------------
  // Inscription : crée le compte Firebase Auth + profil Prisma + rôle par défaut
  // -------------------------------------------------------------------------
  async createUser(input: {
    email: string;
    password: string;
    nom: string;
    telephone?: string;
  }): Promise<UserProfile> {
    const { email, password, nom, telephone } = input;

    try {
      const userRecord = await this.firebase.auth.createUser({
        email,
        password,
        displayName: nom,
      });

      await this.firebase.auth.setCustomUserClaims(userRecord.uid, { role: 'user' });

      const utilisateur = await this.prisma.utilisateur.create({
        data: {
          id: userRecord.uid,
          pseudo: nom,
          email: email,
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
        telephone: utilisateur.telephone || undefined,
        role: utilisateur.role as UserRole,
        dateCreation: utilisateur.dateCreation.toISOString(),
      };
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      if (error?.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Vérification du token (utilisée par le Guard, voir auth.guard.ts)
  // -------------------------------------------------------------------------
  async verifyToken(idToken: string) {
    return this.firebase.auth.verifyIdToken(idToken);
  }

  // -------------------------------------------------------------------------
  // Changement de rôle (réservé admin, voir RolesGuard)
  // -------------------------------------------------------------------------
  async setUserRole(uid: string, role: UserRole): Promise<void> {
    await this.firebase.auth.setCustomUserClaims(uid, { role });
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
      telephone: utilisateur.telephone || undefined,
      role: utilisateur.role as UserRole,
      dateCreation: utilisateur.dateCreation.toISOString(),
    };
  }
}
