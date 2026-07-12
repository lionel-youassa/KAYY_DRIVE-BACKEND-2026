import {
  Before,
  After,
  Given,
  When,
  Then,
  setDefaultTimeout,
} from '@cucumber/cucumber';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GeocodingController } from '../../../src/geocoding/geocoding.controller';
import { GeocodingService } from '../../../src/geocoding/geocoding.service';
import { IncidentsController } from '../../../src/incidents/incidents.controller';
import { IncidentsService } from '../../../src/incidents/incidents.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { StorageService } from '../../../src/storage/storage.service';
import { OfflineController } from '../../../src/modules/offline/offline.controller';
import { OfflineService } from '../../../src/modules/offline/offline.service';
import { AuthGuard } from '../../../src/auth/guards/auth.guard';
import { Reflector } from '@nestjs/core';

setDefaultTimeout(30000);

let app: INestApplication;
let response: any;

const mockGeocodingService = {
  search: async () => [
    {
      nom: 'Dakar Plateau',
      adresse: 'Dakar Plateau, Senegal',
      latitude: 14.6928,
      longitude: -17.4467,
    },
    {
      nom: 'Dakar Medina',
      adresse: 'Dakar Medina, Senegal',
      latitude: 14.686,
      longitude: -17.444,
    },
  ],
  reverse: async () => ({
    address: 'Avenue Leopold Sedar Senghor, Dakar Plateau',
    latitude: 14.6928,
    longitude: -17.4467,
  }),
};

const mockIncidentsService = {
  getIncidentsProches: async () => [
    {
      id: '1',
      type: 'inondation',
      latitude: 14.6928,
      longitude: -17.4467,
      statut: 'confirme',
      description: 'Zone inondee',
    },
  ],
  createIncident: async () => ({ id: '2', type: 'inondation' }),
  confirmerIncident: async () => {},
  getAllIncidents: async () => [
    {
      id: '1',
      type: 'inondation',
      latitude: 14.6928,
      longitude: -17.4467,
      statut: 'confirme',
    },
  ],
};

const mockOfflineService = {
  getAvailableZones: async () => [
    {
      id: 'dakar',
      name: 'Dakar',
      bounds: { north: 14.8, south: 14.6, east: -17.3, west: -17.5 },
    },
  ],
  getZoneMetadata: async () => ({
    id: 'dakar',
    size: 1024,
    lastUpdated: new Date(),
  }),
  downloadZone: async () => ({ tiles: [], metadata: {} }),
  generateZone: async () => ({ status: 'generating' }),
};

const mockNotificationsService = {
  sendToUser: async () => {},
  sendToAll: async () => {},
  getNotifications: async () => [],
};

const mockStorageService = {
  upload: async () => ({ url: 'https://example.com/file.jpg' }),
  delete: async () => {},
};

const mockAuthGuard = { canActivate: () => true };

Before(async function () {
  if (!app) {
    const moduleFixture = await Test.createTestingModule({
      controllers: [
        GeocodingController,
        IncidentsController,
        OfflineController,
      ],
      providers: [
        { provide: GeocodingService, useValue: mockGeocodingService },
        { provide: IncidentsService, useValue: mockIncidentsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: OfflineService, useValue: mockOfflineService },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }
});

After(async function () {});

Given('un utilisateur authentifie', async function () {});

// --- Navigation ---

When("il demande sa position actuelle via l'API geocoding", async function () {
  response = await request(app.getHttpServer())
    .get('/api/geocode/reverse')
    .query({ lat: '14.6928', lon: '-17.4467' });
});

Then("l'API retourne des coordonnees GPS valides", function () {
  if (response.status >= 400) {
    throw new Error(
      `Statut inattendu: ${response.status} - ${JSON.stringify(response.body)}`,
    );
  }
});

Then('la reponse contient une latitude et une longitude', function () {
  const body = response.body;
  const hasLat = body.latitude !== undefined || body.lat !== undefined;
  const hasLng =
    body.longitude !== undefined ||
    body.lon !== undefined ||
    body.lng !== undefined;
  if (!hasLat || !hasLng) {
    throw new Error(`Coordonnees absentes: ${JSON.stringify(body)}`);
  }
});

When('il recherche la destination {string}', async function (query: string) {
  response = await request(app.getHttpServer())
    .get('/api/geocode/search')
    .query({ q: query });
});

Then("l'API retourne une liste de resultats", function () {
  if (response.status >= 400) {
    throw new Error(`Statut inattendu: ${response.status}`);
  }
  const data = response.body?.results || response.body?.data || response.body;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Aucun resultat retourne');
  }
});

Then('chaque resultat contient des coordonnees GPS', function () {
  const data = response.body?.results || response.body?.data || response.body;
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    const hasCoords = item.lat !== undefined || item.latitude !== undefined;
    if (!hasCoords) {
      throw new Error(`Coordonnees absentes dans: ${JSON.stringify(item)}`);
    }
  }
});

Then('le premier resultat contient {string}', function (expected: string) {
  const data = response.body?.results || response.body?.data || response.body;
  const items = Array.isArray(data) ? data : [data];
  const first = JSON.stringify(items[0]).toLowerCase();
  if (!first.includes(expected.toLowerCase())) {
    throw new Error(`"${expected}" non trouve dans: ${first}`);
  }
});

// --- Hydro-Guard ---

When(
  'il demande les incidents de type {string}',
  async function (type: string) {
    response = await request(app.getHttpServer())
      .get('/api/incidents')
      .query({ type });
  },
);

Then("l'API retourne une liste d'incidents", function () {
  if (response.status >= 400) {
    throw new Error(`Statut inattendu: ${response.status}`);
  }
  const data = response.body?.data || response.body?.incidents || response.body;
  if (!Array.isArray(data)) {
    throw new Error("La reponse n'est pas une liste");
  }
});

Then('chaque incident contient des coordonnees GPS', function () {
  const data = response.body?.data || response.body?.incidents || response.body;
  if (!Array.isArray(data) || data.length === 0) return;
  for (const item of data) {
    if (item.latitude === undefined && item.lat === undefined) {
      throw new Error('Un incident ne contient pas de coordonnees GPS');
    }
  }
});

Then('chaque incident a un type {string}', function (expectedType: string) {
  const data = response.body?.data || response.body?.incidents || response.body;
  if (!Array.isArray(data) || data.length === 0) return;
  for (const item of data) {
    if (item.type !== expectedType) {
      throw new Error(`Type attendu "${expectedType}", recu "${item.type}"`);
    }
  }
});

// --- Hors-ligne ---

When(
  'il demande le telechargement des tuiles pour la zone definie',
  async function () {
    response = await request(app.getHttpServer()).get('/api/offline/zones');
  },
);

Then("l'API retourne les donnees de tuiles", function () {
  if (response.status >= 400) {
    throw new Error(`Statut inattendu: ${response.status}`);
  }
});

Then(
  'la reponse a un statut {int} ou {int}',
  function (status1: number, status2: number) {
    if (response.status !== status1 && response.status !== status2) {
      throw new Error(
        `Statut attendu ${status1} ou ${status2}, recu ${response.status}`,
      );
    }
  },
);
