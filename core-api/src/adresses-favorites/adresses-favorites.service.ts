import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async createAdresseFavorite(data: {
    nom: string;
    latitude: number;
    longitude: number;
    categorieId?: string;
    id_utilisateur: string;
  }): Promise<string> {
    const adresse = await this.prisma.adresseFavorite.create({
      data: {
        nom: data.nom,
        adresse: '',
        latitude: data.latitude,
        longitude: data.longitude,
        categorieId: data.categorieId,
        utilisateurId: data.id_utilisateur,
      },
    });
    return adresse.id;
  }

  async getAdressesFavorites(uid: string): Promise<AdresseFavorite[]> {
    const adresses = await this.prisma.adresseFavorite.findMany({
      where: { utilisateurId: uid },
    });

    return adresses.map((a) => ({
      id: a.id,
      nom: a.nom,
      latitude: a.latitude,
      longitude: a.longitude,
      categorieId: a.categorieId || undefined,
      id_utilisateur: a.utilisateurId,
    }));
  }

  async deleteAdresseFavorite(id: string): Promise<void> {
    await this.prisma.adresseFavorite.delete({
      where: { id },
    });
  }
}
