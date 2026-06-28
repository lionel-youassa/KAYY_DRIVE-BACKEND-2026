import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

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
  constructor(private readonly firebase: FirebaseService) {}

  async getCategories(): Promise<Categorie[]> {
    const snapshot = await this.firebase.db.collection('categories').orderBy('ordre', 'asc').get();
    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      ...(doc.data() as Categorie),
      id: doc.id,
    }));
  }

  async createCategorie(data: Omit<Categorie, 'id'>): Promise<Categorie> {
    const docRef = await this.firebase.db.collection('categories').add(data);
    return { ...data, id: docRef.id };
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
