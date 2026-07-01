import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// ---------------------------------------------------------------------------
// Service Firebase centralisé : initialise l'app Admin SDK une seule fois
// et expose db / auth / messaging à tous les autres modules via injection
// de dépendances (au lieu d'un simple import direct comme avant).
// ---------------------------------------------------------------------------

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: App;
  public db!: Firestore;
  public auth!: Auth;
  public messaging!: Messaging;

  onModuleInit() {
    const firebaseConfig = process.env.FIREBASE_ADMIN_CONFIG;

    if (!firebaseConfig) {
      console.warn(
        '⚠️ FIREBASE_ADMIN_CONFIG non défini - Firebase sera désactivé',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(firebaseConfig.replace(/\\n/g, '\n'));

      if (!getApps().length) {
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
      }

      this.db = getFirestore();
      this.auth = getAuth();
      this.messaging = getMessaging();

      console.log('✅ Firebase initialisé avec succès');
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'initialisation Firebase:",
        error.message,
      );
    }
  }
}
