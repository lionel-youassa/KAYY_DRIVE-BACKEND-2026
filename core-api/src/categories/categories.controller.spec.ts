import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateCategorieDto } from './dto/create-categorie.dto';

describe('CategoriesController', () => {
    let controller: CategoriesController;
    let service: CategoriesService;

    // Données fictives pour simuler le retour du service
    const mockCategories = [
        { id: 'cat-1', nom: 'Domicile', icone: 'home', couleur: '#4F46E5', ordre: 1 },
        { id: 'cat-2', nom: 'Travail', icone: 'briefcase', couleur: '#0EA5E9', ordre: 2 },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CategoriesController],
            providers: [
                {
                    provide: CategoriesService,
                    useValue: {
                        getCategories: jest.fn(),
                        createCategorie: jest.fn(),
                    },
                },
            ],
        })
            // On court-circuite les guards d'authentification et de rôle pour le test unitaire
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .overrideGuard(AdminGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<CategoriesController>(CategoriesController);
        service = module.get<CategoriesService>(CategoriesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /categories', () => {
        it('devrait retourner la liste des catégories', async () => {
            // Configuration du mock du service
            jest.spyOn(service, 'getCategories').mockResolvedValue(mockCategories);

            const result = await controller.getAll();

            expect(service.getCategories).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ categories: mockCategories });
        });
    });

    describe('POST /categories', () => {
        it('devrait créer une catégorie avec succès et la renvoyer', async () => {
            const dto: CreateCategorieDto = {
                nom: 'École',
                icone: 'graduation-cap',
                couleur: '#F59E0B',
                ordre: 3,
            };

            const mockCreatedCategorie = { id: 'cat-3', ...dto };
            jest.spyOn(service, 'createCategorie').mockResolvedValue(mockCreatedCategorie);

            const result = await controller.create(dto);

            expect(service.createCategorie).toHaveBeenCalledWith(dto);
            expect(result).toEqual({ success: true, categorie: mockCreatedCategorie });
        });
    });
});