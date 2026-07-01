import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OverviewStatsDto,
  ShortcutStatsDto,
  IncidentsStatsDto,
  SafeDriveStatsDto,
  UserEngagementDto,
  SystemPerformanceDto,
} from './dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les statistiques générales du système
   */
  async getOverviewStats(): Promise<OverviewStatsDto> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Utilisateurs totaux
    const totalUsers = await this.prisma.utilisateur.count();

    // Utilisateurs actifs (basé sur les sessions ou positions)
    const activeUsers24h = await this.prisma.positionUtilisateur.count({
      where: {
        derniereMiseAJour: { gte: yesterday },
      },
    });

    const activeUsers7d = await this.prisma.positionUtilisateur.count({
      where: {
        derniereMiseAJour: { gte: sevenDaysAgo },
      },
    });

    const activeUsers30d = await this.prisma.positionUtilisateur.count({
      where: {
        derniereMiseAJour: { gte: thirtyDaysAgo },
      },
    });

    // Sessions actives
    const activeSessions = await this.prisma.sessionNavigation.count({
      where: {
        statut: 'en_cours',
      },
    });

    // Distance totale (somme des itinéraires)
    const itineraires = await this.prisma.itineraire.findMany({
      select: { distanceTotale: true },
    });
    const totalDistanceKm =
      itineraires.reduce((sum, it) => sum + it.distanceTotale, 0) / 1000;

    // Incidents aujourd'hui
    const incidentsToday = await this.prisma.incident.count({
      where: {
        horodatage: { gte: todayStart },
      },
    });

    // Raccourcis totaux
    const totalShortcuts = await this.prisma.raccourciCommunautaire.count();

    // Taux de confirmation des incidents
    const totalIncidents = await this.prisma.incident.count();
    const confirmedIncidents = await this.prisma.incident.count({
      where: { statut: 'confirme' },
    });
    const incidentConfirmationRate =
      totalIncidents > 0 ? (confirmedIncidents / totalIncidents) * 100 : 0;

    return {
      totalUsers,
      activeUsers24h,
      activeUsers7d,
      activeUsers30d,
      activeSessions,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      incidentsToday,
      totalShortcuts,
      incidentConfirmationRate:
        Math.round(incidentConfirmationRate * 100) / 100,
    };
  }

  /**
   * Récupère les statistiques des raccourcis communautaires
   */
  async getShortcutsStats(): Promise<ShortcutStatsDto> {
    const totalShortcuts = await this.prisma.raccourciCommunautaire.count();

    // Score de fiabilité moyen
    const shortcuts = await this.prisma.raccourciCommunautaire.findMany({
      select: { scoreFiabilite: true },
    });
    const averageReliabilityScore =
      shortcuts.length > 0
        ? shortcuts.reduce((sum, s) => sum + s.scoreFiabilite, 0) /
          shortcuts.length
        : 0;

    // Taux d'adoption (estimé par le nombre de votes)
    const votes = await this.prisma.voteRaccourci.count();
    const adoptionRate =
      totalShortcuts > 0 ? (votes / totalShortcuts) * 100 : 0;

    // Top 5 des raccourcis les plus votés
    const topShortcuts = await this.prisma.raccourciCommunautaire.findMany({
      include: {
        createur: {
          select: { pseudo: true },
        },
      },
      orderBy: [{ votesPositifs: 'desc' }, { scoreFiabilite: 'desc' }],
      take: 5,
    });

    return {
      totalShortcuts,
      averageReliabilityScore: Math.round(averageReliabilityScore * 100) / 100,
      adoptionRate: Math.round(adoptionRate * 100) / 100,
      topShortcuts: topShortcuts.map((s) => ({
        id: s.id,
        nom: s.nom,
        description: s.description,
        scoreFiabilite: Math.round(s.scoreFiabilite * 100) / 100,
        votesPositifs: s.votesPositifs,
        votesNegatifs: s.votesNegatifs,
        createurNom: s.createur.pseudo,
      })),
    };
  }

  /**
   * Récupère les statistiques des incidents (Hydro-Guard)
   */
  async getIncidentsStats(): Promise<IncidentsStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Incidents par type
    const incidentsByType = await this.prisma.incident.groupBy({
      by: ['type'],
      _count: { type: true },
    });

    const totalIncidents = incidentsByType.reduce(
      (sum, group) => sum + group._count.type,
      0,
    );

    const incidentsByTypeFormatted = incidentsByType.map((group) => ({
      type: group.type,
      count: group._count.type,
      percentage:
        totalIncidents > 0 ? (group._count.type / totalIncidents) * 100 : 0,
    }));

    // Taux de confirmation
    const confirmedIncidents = await this.prisma.incident.count({
      where: { statut: 'confirme' },
    });
    const pendingIncidents = await this.prisma.incident.count({
      where: { statut: 'non_confirme' },
    });
    const confirmationRate =
      totalIncidents > 0 ? (confirmedIncidents / totalIncidents) * 100 : 0;

    // Incidents des 7 derniers jours
    const incidentsLast7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const count = await this.prisma.incident.count({
        where: {
          horodatage: { gte: dayStart, lt: dayEnd },
        },
      });

      incidentsLast7Days.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    return {
      incidentsByType: incidentsByTypeFormatted.map((item) => ({
        ...item,
        percentage: Math.round(item.percentage * 100) / 100,
      })),
      confirmationRate: Math.round(confirmationRate * 100) / 100,
      confirmedIncidents,
      pendingIncidents,
      incidentsLast7Days,
    };
  }

  /**
   * Récupère les statistiques Safe-Drive (qualité des routes)
   */
  async getSafeDriveStats(): Promise<SafeDriveStatsDto> {
    // Score de qualité moyen des segments
    const segments = await this.prisma.segmentRoute.findMany({
      select: {
        scoreQualite: true,
        estOfficiel: true,
        vitesseMoyenne: true,
        estInonde: true,
      },
    });

    const averageQualityScore =
      segments.length > 0
        ? segments.reduce((sum, s) => sum + s.scoreQualite, 0) / segments.length
        : 0;

    const floodedRoutesCount = segments.filter((s) => s.estInonde).length;
    const degradedRoutesCount = segments.filter(
      (s) => s.scoreQualite < 0.5,
    ).length;

    // Vitesse moyenne par type de route
    const officialSegments = segments.filter((s) => s.estOfficiel);
    const localSegments = segments.filter((s) => !s.estOfficiel);

    const averageSpeedByRouteType = [
      {
        routeType: 'officiel',
        averageSpeed:
          officialSegments.length > 0
            ? officialSegments.reduce((sum, s) => sum + s.vitesseMoyenne, 0) /
              officialSegments.length
            : 0,
        segmentCount: officialSegments.length,
      },
      {
        routeType: 'local',
        averageSpeed:
          localSegments.length > 0
            ? localSegments.reduce((sum, s) => sum + s.vitesseMoyenne, 0) /
              localSegments.length
            : 0,
        segmentCount: localSegments.length,
      },
    ];

    // Distribution des niveaux de risque
    const itineraires = await this.prisma.itineraire.groupBy({
      by: ['niveauRisque'],
      _count: { niveauRisque: true },
    });

    const totalItineraires = itineraires.reduce(
      (sum, group) => sum + group._count.niveauRisque,
      0,
    );

    const riskLevelDistribution = itineraires.map((group) => ({
      riskLevel: group.niveauRisque,
      count: group._count.niveauRisque,
      percentage:
        totalItineraires > 0
          ? (group._count.niveauRisque / totalItineraires) * 100
          : 0,
    }));

    return {
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      floodedRoutesCount,
      degradedRoutesCount,
      averageSpeedByRouteType: averageSpeedByRouteType.map((item) => ({
        ...item,
        averageSpeed: Math.round(item.averageSpeed * 100) / 100,
      })),
      riskLevelDistribution: riskLevelDistribution.map((item) => ({
        ...item,
        percentage: Math.round(item.percentage * 100) / 100,
      })),
    };
  }

  /**
   * Récupère les statistiques d'engagement utilisateur
   */
  async getUserEngagement(): Promise<UserEngagementDto> {
    // Top 10 contributeurs
    const topContributors = await this.prisma.utilisateur.findMany({
      include: {
        _count: {
          select: {
            incidentsSignales: true,
            raccourcisCrees: true,
            votesRaccourcis: true,
          },
        },
      },
      orderBy: { scoreReputation: 'desc' },
      take: 10,
    });

    const topContributorsFormatted = topContributors.map((u) => ({
      id: u.id,
      pseudo: u.pseudo,
      email: u.email,
      scoreReputation: u.scoreReputation,
      incidentsReported: u._count.incidentsSignales,
      shortcutsCreated: u._count.raccourcisCrees,
      votesCount: u._count.votesRaccourcis,
    }));

    // Moyennes
    const totalUsers = await this.prisma.utilisateur.count();
    const totalIncidents = await this.prisma.incident.count();
    const totalVotes = await this.prisma.voteRaccourci.count();

    const averageReportsPerUser =
      totalUsers > 0 ? totalIncidents / totalUsers : 0;
    const averageVotesPerUser = totalUsers > 0 ? totalVotes / totalUsers : 0;

    // Adresses favorites
    const totalFavoriteAddresses = await this.prisma.adresseFavorite.count();
    const usersWithFavorites = await this.prisma.adresseFavorite
      .groupBy({
        by: ['utilisateurId'],
      })
      .then((groups) => groups.length);

    return {
      topContributors: topContributorsFormatted,
      averageReportsPerUser: Math.round(averageReportsPerUser * 100) / 100,
      averageVotesPerUser: Math.round(averageVotesPerUser * 100) / 100,
      totalFavoriteAddresses,
      usersWithFavorites,
    };
  }

  /**
   * Récupère les statistiques de performance système
   */
  async getSystemPerformance(): Promise<SystemPerformanceDto> {
    // Ces métriques nécessiteraient un système de monitoring
    // Pour l'instant, nous retournons des valeurs simulées ou basées sur les données disponibles

    const totalRouteRequests = await this.prisma.sessionNavigation.count();

    // Notifications
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const notificationsSent24h = await this.prisma.notification.count({
      where: {
        dateCreation: { gte: yesterday },
      },
    });

    const activeFcmTokens = await this.prisma.tokenFCM.count();

    return {
      averageRouteResponseTime: 0, // À implémenter avec un système de logs
      osrmSuccessRate: 95, // Valeur estimée
      totalRouteRequests,
      trafficPredictionUsage: 0, // À implémenter avec des logs
      notificationsSent24h,
      activeFcmTokens,
    };
  }
}
