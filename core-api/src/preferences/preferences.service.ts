import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PreferencesUtilisateur {
  eviterPeages: boolean;
  prioriserRoutesSecu: boolean;
  eviterZonesInondables: boolean;
  modeHorsLigneActif: boolean;
}

const PREFERENCES_PAR_DEFAUT: PreferencesUtilisateur = {
  eviterPeages: false,
  prioriserRoutesSecu: true,
  eviterZonesInondables: true,
  modeHorsLigneActif: false,
};

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(uid: string): Promise<PreferencesUtilisateur> {
    const preferences = await this.prisma.preferencesUtilisateur.findUnique({
      where: { utilisateurId: uid },
    });

    if (!preferences) {
      return PREFERENCES_PAR_DEFAUT;
    }

    return {
      eviterPeages: preferences.eviterPeages,
      prioriserRoutesSecu: preferences.prioriserRoutesSecu,
      eviterZonesInondables: preferences.eviterZonesInondables,
      modeHorsLigneActif: preferences.modeHorsLigneActif,
    };
  }

  async updatePreferences(
    uid: string,
    updates: Partial<PreferencesUtilisateur>,
  ): Promise<PreferencesUtilisateur> {
    const preferences = await this.prisma.preferencesUtilisateur.upsert({
      where: { utilisateurId: uid },
      update: updates,
      create: {
        utilisateurId: uid,
        eviterPeages:
          updates.eviterPeages ?? PREFERENCES_PAR_DEFAUT.eviterPeages,
        prioriserRoutesSecu:
          updates.prioriserRoutesSecu ??
          PREFERENCES_PAR_DEFAUT.prioriserRoutesSecu,
        eviterZonesInondables:
          updates.eviterZonesInondables ??
          PREFERENCES_PAR_DEFAUT.eviterZonesInondables,
        modeHorsLigneActif:
          updates.modeHorsLigneActif ??
          PREFERENCES_PAR_DEFAUT.modeHorsLigneActif,
      },
    });

    return {
      eviterPeages: preferences.eviterPeages,
      prioriserRoutesSecu: preferences.prioriserRoutesSecu,
      eviterZonesInondables: preferences.eviterZonesInondables,
      modeHorsLigneActif: preferences.modeHorsLigneActif,
    };
  }
}
