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
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_ADMIN_CONFIG!.replace(/\\n/g, '\n'),
    );

    if (!getApps().length) {
      this.app = initializeApp({
        credential: cert(serviceAccount),
      });
    }

    this.db = getFirestore();
    this.auth = getAuth();
    this.messaging = getMessaging();
  }
}
