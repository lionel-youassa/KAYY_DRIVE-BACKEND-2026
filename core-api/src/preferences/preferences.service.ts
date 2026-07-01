import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

export interface PreferencesUtilisateur {
  id_utilisateur: string;
  modeDeplacement: 'voiture' | 'moto' | 'pied' | 'transport_commun';
  notificationsIncidents: boolean;
  notificationsRaccourcis: boolean;
  eviterZonesRisque: boolean;
  unite: 'km' | 'miles';
  langue: 'fr' | 'en';
  dateMiseAJour: string;
}

const PREFERENCES_PAR_DEFAUT: Omit<
  PreferencesUtilisateur,
  'id_utilisateur' | 'dateMiseAJour'
> = {
  modeDeplacement: 'voiture',
  notificationsIncidents: true,
  notificationsRaccourcis: true,
  eviterZonesRisque: true,
  unite: 'km',
  langue: 'fr',
};

@Injectable()
export class PreferencesService {
  constructor(private readonly firebase: FirebaseService) {}

  async getPreferences(uid: string): Promise<PreferencesUtilisateur> {
    const doc = await this.firebase.db.collection('preferences').doc(uid).get();

    if (!doc.exists) {
      return {
        id_utilisateur: uid,
        ...PREFERENCES_PAR_DEFAUT,
        dateMiseAJour: new Date().toISOString(),
      };
    }

    return doc.data() as PreferencesUtilisateur;
  }

  async updatePreferences(
    uid: string,
    updates: Partial<
      Omit<PreferencesUtilisateur, 'id_utilisateur' | 'dateMiseAJour'>
    >,
  ): Promise<PreferencesUtilisateur> {
    const actuelles = await this.getPreferences(uid);

    const nouvelles: PreferencesUtilisateur = {
      ...actuelles,
      ...updates,
      id_utilisateur: uid,
      dateMiseAJour: new Date().toISOString(),
    };

    await this.firebase.db.collection('preferences').doc(uid).set(nouvelles);
    return nouvelles;
  }
}
