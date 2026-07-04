import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdresseFavorite {
  id?: string;
  nom: string;
  adresse: string;
  latitude: number;
  longitude: number;
  categorieId?: string;
  categorie?: any;
  id_utilisateur: string;
}

@Injectable()
export class AdressesFavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async createAdresseFavorite(data: {
    nom: string;
    adresse: string;
    latitude: number;
    longitude: number;
    categorieId?: string;
    id_utilisateur: string;
  }): Promise<AdresseFavorite> {
    const adresse = await this.prisma.adresseFavorite.create({
      data: {
        nom: data.nom,
        adresse: data.adresse,
        latitude: data.latitude,
        longitude: data.longitude,
        categorieId: data.categorieId,
        utilisateurId: data.id_utilisateur,
      },
      include: { categorie: true },
    });
    return {
      id: adresse.id,
      nom: adresse.nom,
      adresse: adresse.adresse,
      latitude: adresse.latitude,
      longitude: adresse.longitude,
      categorieId: adresse.categorieId || undefined,
      categorie: adresse.categorie ? {
        id: adresse.categorie.id,
        nom: adresse.categorie.nom,
        icone: adresse.categorie.icone,
        couleur: adresse.categorie.couleur,
      } : null,
      id_utilisateur: adresse.utilisateurId,
    };
  }

  async getAdressesFavorites(uid: string): Promise<AdresseFavorite[]> {
    const adresses = await this.prisma.adresseFavorite.findMany({
      where: { utilisateurId: uid },
      include: { categorie: true },
    });

    return adresses.map((a) => ({
      id: a.id,
      nom: a.nom,
      adresse: a.adresse,
      latitude: a.latitude,
      longitude: a.longitude,
      categorieId: a.categorieId || undefined,
      categorie: a.categorie ? {
        id: a.categorie.id,
        nom: a.categorie.nom,
        icone: a.categorie.icone,
        couleur: a.categorie.couleur,
      } : null,
      id_utilisateur: a.utilisateurId,
    }));
  }

  async deleteAdresseFavorite(id: string): Promise<void> {
    await this.prisma.adresseFavorite.delete({
      where: { id },
    });
  }
}
