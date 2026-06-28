import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

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
  constructor(private readonly firebase: FirebaseService) {}

  async enregistrerTokenFCM(uid: string, token: string): Promise<void> {
    await this.firebase.db
      .collection('users')
      .doc(uid)
      .collection('tokens_fcm')
      .doc(token)
      .set({ token, dateEnregistrement: new Date().toISOString() });
  }

  async supprimerTokenFCM(uid: string, token: string): Promise<void> {
    await this.firebase.db
      .collection('users')
      .doc(uid)
      .collection('tokens_fcm')
      .doc(token)
      .delete();
  }

  private async getTokensUtilisateur(uid: string): Promise<string[]> {
    const snapshot = await this.firebase.db
      .collection('users')
      .doc(uid)
      .collection('tokens_fcm')
      .get();
    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.id);
  }

  async envoyerNotification(input: {
    id_utilisateur: string;
    type: TypeNotification;
    titre: string;
    corps: string;
    data?: Record<string, string>;
  }): Promise<NotificationData> {
    const notification: NotificationData = {
      ...input,
      lu: false,
      dateCreation: new Date().toISOString(),
    };

    const docRef = await this.firebase.db.collection('notifications').add(notification);

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
            this.supprimerTokenFCM(input.id_utilisateur, tokens[index]).catch(() => {});
          }
        });
      } catch (error) {
        console.error('Erreur envoi FCM:', error);
      }
    }

    return { ...notification, id: docRef.id };
  }

  async notifierUtilisateursProches(
    latitude: number,
    longitude: number,
    rayonMetres: number,
    notif: { type: TypeNotification; titre: string; corps: string; data?: Record<string, string> },
  ): Promise<number> {
    const snapshot = await this.firebase.db.collection('positions_utilisateurs').get();

    function distanceEnMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
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

    for (const doc of snapshot.docs) {
      const pos = doc.data() as { latitude: number; longitude: number; id_utilisateur: string };
      if (distanceEnMetres(latitude, longitude, pos.latitude, pos.longitude) <= rayonMetres) {
        await this.envoyerNotification({ id_utilisateur: pos.id_utilisateur, ...notif });
        nombreNotifies++;
      }
    }

    return nombreNotifies;
  }

  async getNotificationsUtilisateur(uid: string): Promise<NotificationData[]> {
    const snapshot = await this.firebase.db
      .collection('notifications')
      .where('id_utilisateur', '==', uid)
      .orderBy('dateCreation', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      ...(doc.data() as NotificationData),
      id: doc.id,
    }));
  }

  async marquerCommeLue(notificationId: string): Promise<void> {
    await this.firebase.db.collection('notifications').doc(notificationId).update({ lu: true });
  }
}
