import { Test, type TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';

describe('Geocoding (Controller & Service)', () => {
    let controller: GeocodingController;
    let service: GeocodingService;
    let httpService: HttpService;

    // Données factices renvoyées par Nominatim (recherche)
    const mockNominatimSearchResponse = {
        data: [
            {
                display_name: 'Bonapriso, Douala, Littoral, Cameroun',
                lat: '4.0167',
                lon: '9.6833',
            },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
    };

    // Données factices renvoyées par Nominatim (reverse geocoding)
    const mockNominatimReverseResponse = {
        data: {
            address: {
                suburb: 'Bonapriso',
                city: 'Douala',
                state: 'Littoral',
            },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
    };

    const mockHttpService = {
        get: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GeocodingController],
            providers: [
                GeocodingService,
                {
                    provide: HttpService,
                    useValue: mockHttpService,
                },
            ],
        }).compile();

        controller = module.get<GeocodingController>(GeocodingController);
        service = module.get<GeocodingService>(GeocodingService);
        httpService = module.get<HttpService>(HttpService);

        jest.clearAllMocks();
    });

    // =========================================================================
    // TESTS DU SERVICE (GeocodingService)
    // =========================================================================
    describe('GeocodingService', () => {
        describe('search', () => {
            it('should search successfully and format Nominatim results', async () => {
                mockHttpService.get.mockReturnValue(of(mockNominatimSearchResponse));

                const results = await service.search('Douala');

                expect(httpService.get).toHaveBeenCalledWith(
                    expect.stringContaining('https://nominatim.openstreetmap.org/search?q=Douala'),
                    expect.any(Object),
                );
                expect(results).toHaveLength(1);
                expect(results[0]).toEqual({
                    id: '0',
                    nom: 'Bonapriso', // Extrait via le split(',')
                    adresse: 'Bonapriso, Douala, Littoral, Cameroun',
                    latitude: 4.0167,
                    longitude: 9.6833,
                });
            });

            it('should return an empty array if Nominatim requests fails', async () => {
                mockHttpService.get.mockReturnValue(throwError(() => new Error('Timeout or Network Error')));

                const results = await service.search('Crash query');

                expect(results).toEqual([]);
            });
        });

        describe('reverse', () => {
            it('should return extracted and trimmed address details', async () => {
                mockHttpService.get.mockReturnValue(of(mockNominatimReverseResponse));

                const result = await service.reverse(4.0167, 9.6833);

                expect(httpService.get).toHaveBeenCalledWith(
                    expect.stringContaining('lat=4.0167&lon=9.6833'),
                    expect.any(Object),
                );
                expect(result).toEqual({
                    quartier: 'Bonapriso',
                    ville: 'Douala',
                    region: 'Littoral',
                });
            });

            it('should fallback correctly if certain fields are absent in the response', async () => {
                const legacyResponse = {
                    data: {
                        address: {
                            neighbourhood: ' Akwa ', // Doit être trim()
                            town: ' Yaoundé ',
                            province: ' Centre ',
                        },
                    },
                };
                mockHttpService.get.mockReturnValue(of(legacyResponse));

                const result = await service.reverse(3.848, 11.502);

                expect(result).toEqual({
                    quartier: 'Akwa',
                    ville: 'Yaoundé',
                    region: 'Centre',
                });
            });

            it('should return empty object if address object is missing or API errors out', async () => {
                mockHttpService.get.mockReturnValue(of({ data: {} }));
                let result = await service.reverse(0, 0);
                expect(result).toEqual({});

                mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));
                result = await service.reverse(0, 0);
                expect(result).toEqual({});
            });
        });
    });

    // =========================================================================
    // TESTS DU CONTRÔLEUR (GeocodingController)
    // =========================================================================
    describe('GeocodingController', () => {
        describe('GET /search', () => {
            it('should throw BAD_REQUEST if search query is less than 2 characters or missing', async () => {
                await expect(controller.search('', '')).rejects.toThrow(
                    new HttpException('Query must be at least 2 characters long', HttpStatus.BAD_REQUEST),
                );

                // @ts-ignore
                await expect(controller.search('a', undefined)).rejects.toThrow(HttpException);
            });

            it('should use "query" parameter if "q" is not available', async () => {
                const serviceResult = [
                    { id: '0', nom: 'Akwa', adresse: 'Akwa, Douala', latitude: 4.04, longitude: 9.69 },
                ];
                jest.spyOn(service, 'search').mockResolvedValue(serviceResult);

                // @ts-ignore
                const response = await controller.search(undefined, 'Akwa');

                expect(service.search).toHaveBeenCalledWith('Akwa');
                expect(response.results[0].name).toBe('Akwa');
            });

            it('should map the service results into frontend-compatible format', async () => {
                const serviceResult = [
                    { id: '0', nom: 'Akwa', adresse: 'Akwa, Douala', latitude: 4.04, longitude: 9.69 },
                ];
                jest.spyOn(service, 'search').mockResolvedValue(serviceResult);

                // @ts-ignore
                const response = await controller.search('Akwa', undefined);

                expect(response).toEqual({
                    results: [
                        {
                            id: '0',
                            name: 'Akwa',
                            display_name: 'Akwa, Douala',
                            address: 'Akwa, Douala',
                            lat: 4.04,
                            lon: 9.69,
                        },
                    ],
                });
            });

            it('should throw INTERNAL_SERVER_ERROR if service crashes', async () => {
                jest.spyOn(service, 'search').mockRejectedValue(new Error('Internal DB/Network Fail'));

                // @ts-ignore
                await expect(controller.search('ValidQuery', undefined)).rejects.toThrow(
                    new HttpException('Error searching for location', HttpStatus.INTERNAL_SERVER_ERROR),
                );
            });
        });

        describe('GET /reverse', () => {
            it('should throw BAD_REQUEST if latitude or longitude is invalid', async () => {
                // @ts-ignore
                await expect(controller.reverse('not-a-number', '9.68', undefined)).rejects.toThrow(
                    new HttpException('Latitude and Longitude must be valid numbers', HttpStatus.BAD_REQUEST),
                );

                // @ts-ignore
                await expect(controller.reverse('4.01', 'abc', undefined)).rejects.toThrow(HttpException);
            });

            it('should prioritize "lon" query but fall back to "lng"', async () => {
                jest.spyOn(service, 'reverse').mockResolvedValue({ ville: 'Douala' });

                // Cas avec lat & lon
                // @ts-ignore
                await controller.reverse('4.0', '9.0', undefined);
                expect(service.reverse).toHaveBeenLastCalledWith(4.0, 9.0);

                // Cas alternatif avec lat & lng
                // @ts-ignore
                await controller.reverse('4.0', undefined, '11.0');
                expect(service.reverse).toHaveBeenLastCalledWith(4.0, 11.0);
            });

            it('should successfully call service and return its object', async () => {
                const expectedPayload = { quartier: 'Bonapriso', ville: 'Douala' };
                jest.spyOn(service, 'reverse').mockResolvedValue(expectedPayload);

                // @ts-ignore
                const response = await controller.reverse('4.01', '9.68', undefined);

                expect(service.reverse).toHaveBeenCalledWith(4.01, 9.68);
                expect(response).toEqual(expectedPayload);
            });

            it('should throw INTERNAL_SERVER_ERROR if reverse service fails', async () => {
                jest.spyOn(service, 'reverse').mockRejectedValue(new Error('Fatal'));

                // @ts-ignore
                await expect(controller.reverse('4.01', '9.68', undefined)).rejects.toThrow(
                    new HttpException('Error performing reverse geocoding', HttpStatus.INTERNAL_SERVER_ERROR),
                );
            });
        });
    });
});