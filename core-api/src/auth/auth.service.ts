import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly firebase: FirebaseService) {}

  // -------------------------------------------------------------------------
  // Inscription : crée le compte Firebase Auth + profil Firestore + rôle par défaut
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

      const profile: UserProfile = {
        uid: userRecord.uid,
        email,
        nom,
        telephone,
        role: 'user',
        dateCreation: new Date().toISOString(),
      };

      await this.firebase.db.collection('users').doc(userRecord.uid).set(profile);

      return profile;
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
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
    await this.firebase.db.collection('users').doc(uid).update({ role });
  }

  // -------------------------------------------------------------------------
  // Récupération du profil complet
  // -------------------------------------------------------------------------
  async getUserProfile(uid: string): Promise<UserProfile> {
    const doc = await this.firebase.db.collection('users').doc(uid).get();
    if (!doc.exists) {
      throw new NotFoundException('Profil introuvable');
    }
    return doc.data() as UserProfile;
  }
}
