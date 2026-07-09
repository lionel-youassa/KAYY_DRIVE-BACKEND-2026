import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService, CATEGORIES_PAR_DEFAUT } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    categorie: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
    it('should return categories ordered by ordre', async () => {
      const dbCategories = [
        { id: 'cat-1', nom: 'Home', icone: 'home', couleur: '#123', ordre: 1 },
        { id: 'cat-2', nom: 'Work', icone: 'work', couleur: '#456', ordre: 2 },
      ];
      mockPrismaService.categorie.findMany.mockResolvedValue(dbCategories);

      const result = await service.getCategories();

      expect(prismaService.categorie.findMany).toHaveBeenCalledWith({
        orderBy: { ordre: 'asc' },
      });
      expect(result).toEqual(dbCategories);
    });
  });

  describe('createCategorie', () => {
    it('should create and return a category', async () => {
      const categoryData = { nom: 'School', icone: 'school', couleur: '#789', ordre: 3 };
      const dbCategory = { id: 'cat-3', ...categoryData };
      mockPrismaService.categorie.create.mockResolvedValue(dbCategory);

      const result = await service.createCategorie(categoryData);

      expect(prismaService.categorie.create).toHaveBeenCalledWith({
        data: categoryData,
      });
      expect(result).toEqual(dbCategory);
    });
  });

  describe('seedCategoriesParDefaut', () => {
    it('should do nothing and return 0 if categories exist', async () => {
      mockPrismaService.categorie.findMany.mockResolvedValue([
        { id: 'cat-1', nom: 'Home', icone: 'home', couleur: '#123', ordre: 1 }
      ]);

      const result = await service.seedCategoriesParDefaut();

      expect(result).toBe(0);
      expect(prismaService.categorie.create).not.toHaveBeenCalled();
    });

    it('should seed default categories if none exist', async () => {
      mockPrismaService.categorie.findMany.mockResolvedValue([]);
      mockPrismaService.categorie.create.mockImplementation((args) => Promise.resolve({
        id: `seeded-${args.data.nom}`,
        ...args.data,
      }));

      const result = await service.seedCategoriesParDefaut();

      expect(result).toBe(CATEGORIES_PAR_DEFAUT.length);
      expect(prismaService.categorie.create).toHaveBeenCalledTimes(CATEGORIES_PAR_DEFAUT.length);
    });
  });
});
