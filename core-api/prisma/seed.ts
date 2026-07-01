import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Créer un utilisateur admin par défaut
  const adminEmail = 'admin@kayydrive.com';
  const adminPassword = 'Admin123!'; // À changer en production
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.utilisateur.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      pseudo: 'Admin KayyDrive',
      passwordHash: adminPasswordHash,
      role: 'admin',
      scoreReputation: 0,
      dateCreation: new Date(),
    },
  });

  console.log('✅ Admin créé:', admin.email);
  console.log('🔑 Mot de passe par défaut:', adminPassword);
  console.log('⚠️  Changez ce mot de passe en production!');

  // Créer des catégories par défaut (utilise les catégories définies dans CategoriesService)
  const categories = [
    { nom: 'Domicile', icone: 'home', couleur: '#4F46E5', ordre: 1 },
    { nom: 'Travail', icone: 'briefcase', couleur: '#0EA5E9', ordre: 2 },
    { nom: 'École', icone: 'graduation-cap', couleur: '#F59E0B', ordre: 3 },
    { nom: 'Famille', icone: 'users', couleur: '#EC4899', ordre: 4 },
    { nom: 'Restaurant', icone: 'utensils', couleur: '#EF4444', ordre: 5 },
    { nom: 'Santé', icone: 'plus-square', couleur: '#10B981', ordre: 6 },
    { nom: 'Autre', icone: 'map-pin', couleur: '#6B7280', ordre: 99 },
  ];

  for (const cat of categories) {
    const existing = await prisma.categorie.findFirst({
      where: { nom: cat.nom },
    });

    if (!existing) {
      await prisma.categorie.create({ data: cat });
    }
  }

  console.log('✅ Catégories créées');

  console.log('🌱 Seed terminé avec succès!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
