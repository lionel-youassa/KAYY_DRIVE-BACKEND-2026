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

  // Créer des catégories par défaut
  const categories = [
    { nom: 'Transport', icone: '🚌', couleur: '#3B82F6', ordre: 1 },
    { nom: 'Sécurité', icone: '🛡️', couleur: '#EF4444', ordre: 2 },
    { nom: 'Services', icone: '🏢', couleur: '#10B981', ordre: 3 },
    { nom: 'Loisirs', icone: '🎉', couleur: '#F59E0B', ordre: 4 },
  ];

  for (const cat of categories) {
    await prisma.categorie.upsert({
      where: { nom: cat.nom },
      update: {},
      create: cat,
    });
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
