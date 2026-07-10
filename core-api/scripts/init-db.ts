import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initDatabase() {
  try {
    console.log('🔍 Vérification de l\'initialisation de la base de données...');

    // Vérifier si l'admin existe
    const admin = await prisma.utilisateur.findFirst({
      where: { role: 'admin' },
    });

    if (admin) {
      console.log('✅ Admin déjà existent, skip du seed.');
      return;
    }

    console.log('🌱 Aucun admin trouvé, exécution du seed...');
    
    // Exécuter le seed via ts-node en process séparé
    const { execSync } = await import('child_process');
    execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit' });
    
    console.log('✅ Initialisation de la base de données terminée.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter seulement si ce fichier est exécuté directement
if (require.main === module) {
  initDatabase();
}
