import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(uid: string): Promise<PreferencesUtilisateur> {
    const preferences = await this.prisma.preferencesUtilisateur.findUnique({
      where: { utilisateurId: uid },
    });

    if (!preferences) {
      return {
        id_utilisateur: uid,
        ...PREFERENCES_PAR_DEFAUT,
        dateMiseAJour: new Date().toISOString(),
      };
    }

    return {
      id_utilisateur: preferences.utilisateurId,
      modeDeplacement: 'voiture',
      notificationsIncidents: preferences.prioriserRoutesSecu,
      notificationsRaccourcis: true,
      eviterZonesRisque: preferences.eviterZonesInondables,
      unite: 'km',
      langue: 'fr',
      dateMiseAJour: new Date().toISOString(),
    };
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

    await this.prisma.preferencesUtilisateur.upsert({
      where: { utilisateurId: uid },
      update: {
        eviterPeages: updates.modeDeplacement === 'transport_commun',
        prioriserRoutesSecu: updates.notificationsIncidents ?? true,
        eviterZonesInondables: updates.eviterZonesRisque ?? true,
      },
      create: {
        utilisateurId: uid,
        eviterPeages: updates.modeDeplacement === 'transport_commun',
        prioriserRoutesSecu: updates.notificationsIncidents ?? true,
        eviterZonesInondables: updates.eviterZonesRisque ?? true,
        modeHorsLigneActif: false,
      },
    });

    return nouvelles;
  }
}
