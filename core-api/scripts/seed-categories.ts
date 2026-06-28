/**
 * Peuple Firestore avec les catégories par défaut, à lancer une seule fois.
 * Usage : pnpm run seed:categories
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoriesService } from '../src/categories/categories.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoriesService = app.get(CategoriesService);

  const nombreCreees = await categoriesService.seedCategoriesParDefaut();

  if (nombreCreees === 0) {
    console.log('Des catégories existent déjà, seed ignoré.');
  } else {
    console.log(`✅ ${nombreCreees} catégories créées.`);
  }

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
