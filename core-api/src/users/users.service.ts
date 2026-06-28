import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class UsersService {
  constructor(private readonly firebase: FirebaseService) {}

  async mettreAJourPosition(uid: string, latitude: number, longitude: number): Promise<void> {
    await this.firebase.db.collection('positions_utilisateurs').doc(uid).set({
      id_utilisateur: uid,
      latitude,
      longitude,
      derniereMiseAJour: new Date().toISOString(),
    });
  }

  async supprimerPosition(uid: string): Promise<void> {
    await this.firebase.db.collection('positions_utilisateurs').doc(uid).delete();
  }
}
