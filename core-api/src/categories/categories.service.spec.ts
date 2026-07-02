import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService, CATEGORIES_PAR_DEFAUT } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  const mockCategories = [
    { id: 'cat-1', nom: 'Domicile', icone: 'home', couleur: '#4F46E5', ordre: 1 },
    { id: 'cat-2', nom: 'Travail', icone: 'briefcase', couleur: '#0EA5E9', ordre: 2 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            categorie: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategories', () => {
    it('devrait retourner la liste des catégories triées par ordre', async () => {
      jest.spyOn(prismaService.categorie, 'findMany').mockResolvedValue(mockCategories as any);

      const result = await service.getCategories();

      expect(prismaService.categorie.findMany).toHaveBeenCalledWith({
        orderBy: { ordre: 'asc' },
      });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('createCategorie', () => {
    it('devrait créer une nouvelle catégorie avec succès', async () => {
      const newCatDto = { nom: 'École', icone: 'graduation-cap', couleur: '#F59E0B', ordre: 3 };
      const createdCat = { id: 'cat-3', ...newCatDto };

      jest.spyOn(prismaService.categorie, 'create').mockResolvedValue(createdCat as any);

      const result = await service.createCategorie(newCatDto);

      expect(prismaService.categorie.create).toHaveBeenCalledWith({
        data: {
          nom: newCatDto.nom,
          icone: newCatDto.icone,
          couleur: newCatDto.couleur,
          ordre: newCatDto.ordre,
        },
      });
      expect(result).toEqual(createdCat);
    });
  });

  describe('seedCategoriesParDefaut', () => {
    it('devrait insérer les catégories par défaut si la table est vide', async () => {
      // Étape 1 : simuler qu'aucune catégorie n'existe en base de données (findMany renvoie un tableau vide)
      jest.spyOn(prismaService.categorie, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.categorie, 'create').mockResolvedValue({} as any);

      await service.seedCategoriesParDefaut();

      // Vérifie que findMany a été appelé pour contrôler l'existence
      expect(prismaService.categorie.findMany).toHaveBeenCalled();
      // Vérifie que la création a été appelée pour chaque catégorie par défaut
      expect(prismaService.categorie.create).toHaveBeenCalledTimes(CATEGORIES_PAR_DEFAUT.length);
    });

    it('ne devrait rien insérer si des catégories existent déjà en base de données', async () => {
      // Étape 2 : simuler que des catégories existent déjà
      jest.spyOn(prismaService.categorie, 'findMany').mockResolvedValue(mockCategories as any);

      await service.seedCategoriesParDefaut();

      expect(prismaService.categorie.findMany).toHaveBeenCalled();
      // Le service ne doit pas appeler create si la table n'est pas vide
      expect(prismaService.categorie.create).not.toHaveBeenCalled();
    });
  });
});