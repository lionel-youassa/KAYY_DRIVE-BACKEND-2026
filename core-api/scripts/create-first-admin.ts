/**
 * Script à exécuter UNE SEULE FOIS pour créer le tout premier admin.
 * Usage : pnpm exec ts-node -r tsconfig-paths/register scripts/create-first-admin.ts <email>
 *
 * L'utilisateur doit déjà exister (avoir fait POST /auth/register).
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: ts-node scripts/create-first-admin.ts <email>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const prisma = app.get(PrismaService);

  const user = await prisma.utilisateur.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ Aucun utilisateur trouvé avec l'email : ${email}`);
    await app.close();
    process.exit(1);
  }

  await authService.setUserRole(user.id, 'admin');

  console.log(`✅ ${email} est maintenant admin (id: ${user.id})`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
