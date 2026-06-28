/**
 * Script à exécuter UNE SEULE FOIS pour créer le tout premier admin.
 * Usage : pnpm exec ts-node -r tsconfig-paths/register scripts/create-first-admin.ts <email>
 *
 * L'utilisateur doit déjà exister (avoir fait POST /auth/register).
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { FirebaseService } from '../src/firebase/firebase.service';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: ts-node scripts/create-first-admin.ts <email>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const firebase = app.get(FirebaseService);

  const user = await firebase.auth.getUserByEmail(email);
  await authService.setUserRole(user.uid, 'admin');

  console.log(`✅ ${email} est maintenant admin (uid: ${user.uid})`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
