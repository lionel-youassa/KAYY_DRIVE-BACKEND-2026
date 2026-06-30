import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Categorie {
  id?: string;
  nom: string;
  icone: string;
  couleur: string;
  ordre: number;
}

export const CATEGORIES_PAR_DEFAUT: Omit<Categorie, 'id'>[] = [
  { nom: 'Domicile', icone: 'home', couleur: '#4F46E5', ordre: 1 },
  { nom: 'Travail', icone: 'briefcase', couleur: '#0EA5E9', ordre: 2 },
  { nom: 'École', icone: 'graduation-cap', couleur: '#F59E0B', ordre: 3 },
  { nom: 'Famille', icone: 'users', couleur: '#EC4899', ordre: 4 },
  { nom: 'Restaurant', icone: 'utensils', couleur: '#EF4444', ordre: 5 },
  { nom: 'Santé', icone: 'plus-square', couleur: '#10B981', ordre: 6 },
  { nom: 'Autre', icone: 'map-pin', couleur: '#6B7280', ordre: 99 },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(): Promise<Categorie[]> {
    const categories = await this.prisma.categorie.findMany({
      orderBy: { ordre: 'asc' },
    });
    return categories.map((cat) => ({
      id: cat.id,
      nom: cat.nom,
      icone: cat.icone,
      couleur: cat.couleur,
      ordre: cat.ordre,
    }));
  }

  async createCategorie(data: Omit<Categorie, 'id'>): Promise<Categorie> {
    const categorie = await this.prisma.categorie.create({
      data: {
        nom: data.nom,
        icone: data.icone,
        couleur: data.couleur,
        ordre: data.ordre,
      },
    });
    return {
      id: categorie.id,
      nom: categorie.nom,
      icone: categorie.icone,
      couleur: categorie.couleur,
      ordre: categorie.ordre,
    };
  }

  async seedCategoriesParDefaut(): Promise<number> {
    const existantes = await this.getCategories();
    if (existantes.length > 0) return 0;

    for (const categorie of CATEGORIES_PAR_DEFAUT) {
      await this.createCategorie(categorie);
    }
    return CATEGORIES_PAR_DEFAUT.length;
  }
}
