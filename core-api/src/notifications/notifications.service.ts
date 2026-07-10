import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsGateway } from './notifications.gateway';

export type TypeNotification =
  | 'incident_proche'
  | 'incident_confirme'
  | 'raccourci_valide'
  | 'embouteillage_predit'
  | 'systeme';

export interface NotificationData {
  id?: string;
  id_utilisateur: string;
  type: TypeNotification;
  titre: string;
  corps: string;
  data?: Record<string, string>;
  lu: boolean;
  dateCreation: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async enregistrerTokenFCM(uid: string, token: string): Promise<void> {
    await this.prisma.tokenFCM.create({
      data: {
        utilisateurId: uid,
        token,
        dateEnregistrement: new Date(),
      },
    });
  }

  async supprimerTokenFCM(uid: string, token: string): Promise<void> {
    await this.prisma.tokenFCM.deleteMany({
      where: {
        utilisateurId: uid,
        token,
      },
    });
  }

  private async getTokensUtilisateur(uid: string): Promise<string[]> {
    const tokens = await this.prisma.tokenFCM.findMany({
      where: { utilisateurId: uid },
    });
    return tokens.map((t) => t.token);
  }

  async envoyerNotification(input: {
    id_utilisateur: string;
    type: TypeNotification;
    titre: string;
    corps: string;
    data?: Record<string, string>;
  }): Promise<NotificationData> {
    const notification = await this.prisma.notification.create({
      data: {
        utilisateurId: input.id_utilisateur,
        type: input.type,
        titre: input.titre,
        corps: input.corps,
        data: input.data || {},
        lu: false,
        dateCreation: new Date(),
      },
    });

    const tokens = await this.getTokensUtilisateur(input.id_utilisateur);

    if (tokens.length > 0) {
      try {
        const response = await this.firebase.messaging.sendEachForMulticast({
          tokens,
          notification: { title: input.titre, body: input.corps },
          data: input.data || {},
        });

        response.responses.forEach((resp, index) => {
          if (
            !resp.success &&
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            this.supprimerTokenFCM(input.id_utilisateur, tokens[index]).catch(
              () => {},
            );
          }
        });
      } catch (error) {
        console.error('Erreur envoi FCM:', error);
      }
    }

    const notificationResult: NotificationData = {
      id: notification.id,
      id_utilisateur: notification.utilisateurId,
      type: notification.type as TypeNotification,
      titre: notification.titre,
      corps: notification.corps,
      data: notification.data as Record<string, string>,
      lu: notification.lu,
      dateCreation: notification.dateCreation.toISOString(),
    };

    // Émettre via WebSocket en temps réel
    try {
      this.gateway.sendToUser(
        input.id_utilisateur,
        'notification:new',
        notificationResult,
      );
    } catch (wsError) {
      this.logger.warn(`WebSocket emit failed: ${wsError}`);
    }

    return notificationResult;
  }

  async notifierUtilisateursProches(
    latitude: number,
    longitude: number,
    rayonMetres: number,
    notif: {
      type: TypeNotification;
      titre: string;
      corps: string;
      data?: Record<string, string>;
    },
  ): Promise<number> {
    const positions = await this.prisma.positionUtilisateur.findMany();

    function distanceEnMetres(
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ) {
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    let nombreNotifies = 0;

    for (const pos of positions) {
      if (
        distanceEnMetres(latitude, longitude, pos.latitude, pos.longitude) <=
        rayonMetres
      ) {
        await this.envoyerNotification({
          id_utilisateur: pos.utilisateurId,
          ...notif,
        });
        nombreNotifies++;
      }
    }

    return nombreNotifies;
  }

  async getNotificationsUtilisateur(uid: string): Promise<NotificationData[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { utilisateurId: uid },
      orderBy: { dateCreation: 'desc' },
      take: 50,
    });

    return notifications.map((notif) => ({
      id: notif.id,
      id_utilisateur: notif.utilisateurId,
      type: notif.type as TypeNotification,
      titre: notif.titre,
      corps: notif.corps,
      data: notif.data as Record<string, string>,
      lu: notif.lu,
      dateCreation: notif.dateCreation.toISOString(),
    }));
  }

  async marquerCommeLue(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { lu: true },
    });
  }

  // -------------------------------------------------------------------------
  // Notifications broadcast WebSocket
  // -------------------------------------------------------------------------

  /** Notifier tous les admins via WebSocket (ex: nouvel incident signalé) */
  notifyAdmins(event: string, data: any) {
    try {
      this.gateway.sendToAdmins(event, data);
    } catch (e) {
      this.logger.warn(`WebSocket admin broadcast failed: ${e}`);
    }
  }

  /** Broadcast à tous les utilisateurs connectés (ex: nouvelle récompense) */
  notifyAll(event: string, data: any) {
    try {
      this.gateway.broadcastToAll(event, data);
    } catch (e) {
      this.logger.warn(`WebSocket global broadcast failed: ${e}`);
    }
  }
}
