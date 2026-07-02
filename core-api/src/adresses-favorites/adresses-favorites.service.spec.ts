import { Test, TestingModule } from '@nestjs/testing';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('AdressesFavoritesService', () => {
    let service: AdressesFavoritesService;
    let firebaseService: FirebaseService;

    // Création des mocks pour Firestore
    const mockDocRef = { id: 'generated-doc-id-123' };
    const mockDocSnapshot = {
        id: 'addr-uuid-abc',
        data: jest.fn().mockReturnValue({
            nom: 'Maison',
            latitude: 4.0511,
            longitude: 9.7679,
            categorieId: 'cat-home',
            id_utilisateur: 'user-uid-789',
        }),
    };
    const mockQuerySnapshot = {
        docs: [mockDocSnapshot],
    };

    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockQuerySnapshot),
        add: jest.fn().mockResolvedValue(mockDocRef),
        doc: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdressesFavoritesService,
                {
                    provide: FirebaseService,
                    useValue: {
                        db: mockFirestore,
                    },
                },
            ],
        }).compile();

        service = module.get<AdressesFavoritesService>(AdressesFavoritesService);
        firebaseService = module.get<FirebaseService>(FirebaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createAdresseFavorite', () => {
        it('devrait ajouter une adresse favorite à Firestore et retourner son ID', async () => {
            const inputData = {
                nom: 'Bureau',
                latitude: 3.8488,
                longitude: 11.5021,
                categorieId: 'cat-work',
                id_utilisateur: 'user-uid-789',
            };

            const result = await service.createAdresseFavorite(inputData);

            expect(mockFirestore.collection).toHaveBeenCalledWith('adresses_favorites');
            expect(mockFirestore.add).toHaveBeenCalledWith(inputData);
            expect(result).toBe('generated-doc-id-123');
        });
    });

    describe('getAdressesFavorites', () => {
        it('devrait interroger Firestore avec un filtre uid et mapper le résultat', async () => {
            const uid = 'user-uid-789';

            const result = await service.getAdressesFavorites(uid);

            expect(mockFirestore.collection).toHaveBeenCalledWith('adresses_favorites');
            expect(mockFirestore.where).toHaveBeenCalledWith('id_utilisateur', '==', uid);
            expect(mockFirestore.get).toHaveBeenCalled();
            expect(mockDocSnapshot.data).toHaveBeenCalled();
            expect(result).toEqual([
                {
                    id: 'addr-uuid-abc',
                    nom: 'Maison',
                    latitude: 4.0511,
                    longitude: 9.7679,
                    categorieId: 'cat-home',
                    id_utilisateur: 'user-uid-789',
                },
            ]);
        });
    });

    describe('deleteAdresseFavorite', () => {
        it('devrait cibler le document par son ID et le supprimer', async () => {
            const targetId = 'addr-uuid-abc';

            await service.deleteAdresseFavorite(targetId);

            expect(mockFirestore.collection).toHaveBeenCalledWith('adresses_favorites');
            expect(mockFirestore.doc).toHaveBeenCalledWith(targetId);
            expect(mockFirestore.delete).toHaveBeenCalled();
        });
    });
});