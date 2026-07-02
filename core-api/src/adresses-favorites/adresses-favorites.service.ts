import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

export interface AdresseFavorite {
  id?: string;
  nom: string;
  latitude: number;
  longitude: number;
  categorieId?: string;
  id_utilisateur: string;
}

@Injectable()
export class AdressesFavoritesService {
  constructor(private readonly firebase: FirebaseService) {}

  async createAdresseFavorite(data: {
    nom: string;
    latitude: number;
    longitude: number;
    categorieId?: string;
    id_utilisateur: string;
  }): Promise<string> {
    if (!this.firebase.db) {
      console.warn(
        '⚠️ Firebase non initialisé - adresse favorite non enregistrée',
      );
      return 'simulated-id';
    }

    const docRef = await this.firebase.db
      .collection('adresses_favorites')
      .add(data);
    return docRef.id;
  }

  async getAdressesFavorites(uid: string): Promise<AdresseFavorite[]> {
    if (!this.firebase.db) {
      console.warn('⚠️ Firebase non initialisé - retour de liste vide');
      return [];
    }

    const snapshot = await this.firebase.db
      .collection('adresses_favorites')
      .where('id_utilisateur', '==', uid)
      .get();

    return snapshot.docs.map(
      (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
        ...(doc.data() as AdresseFavorite),
        id: doc.id,
      }),
    );
  }

  async deleteAdresseFavorite(id: string): Promise<void> {
    if (!this.firebase.db) {
      console.warn('⚠️ Firebase non initialisé - suppression ignorée');
      return;
    }
    await this.firebase.db.collection('adresses_favorites').doc(id).delete();
  }
}
