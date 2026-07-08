import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import axios from 'axios';

// Coordinates of main hotspots in Douala and Yaoundé
interface Hotspot {
  name: string;
  latitude: number;
  longitude: number;
  baseCongestionIndex: number; // 0 (always fluid) to 1 (extremely congested)
}

const HOTSPOTS: Hotspot[] = [
  // Douala
  { name: 'Ndokotti Carrefour', latitude: 4.0594, longitude: 9.7503, baseCongestionIndex: 0.9 },
  { name: 'Rond-point Deido', latitude: 4.0628, longitude: 9.7297, baseCongestionIndex: 0.8 },
  { name: 'Ancien Troisième', latitude: 4.0452, longitude: 9.7183, baseCongestionIndex: 0.75 },
  { name: 'Carrefour Ndokoti (Total)', latitude: 4.0588, longitude: 9.7511, baseCongestionIndex: 0.9 },
  { name: 'Bonabéri Pont', latitude: 4.0645, longitude: 9.7155, baseCongestionIndex: 0.8 },
  { name: 'Akwa (Palais Dika Akwa)', latitude: 4.0475, longitude: 9.6978, baseCongestionIndex: 0.7 },
  // Yaoundé
  { name: 'Rond-point Poste', latitude: 3.8642, longitude: 11.5195, baseCongestionIndex: 0.85 },
  { name: 'Carrefour Mvan', latitude: 3.8189, longitude: 11.5204, baseCongestionIndex: 0.8 },
  { name: 'Carrefour Bastos', latitude: 3.8967, longitude: 11.5122, baseCongestionIndex: 0.65 },
  { name: 'Carrefour Warda', latitude: 3.8698, longitude: 11.5135, baseCongestionIndex: 0.7 },
];

// Target hours for sampling (to stay within API rate limits)
const SAMPLE_HOURS = [7, 8, 9, 12, 13, 17, 18, 19, 21, 22];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const tomtomKey = process.env.TOMTOM_API_KEY;
  const adminUserId = 'f3473076-c8a3-41c4-8b3f-056fecea2a39'; // admin@kayydrive.com

  // Verify that the default user exists in the db
  const userExists = await prisma.utilisateur.findUnique({
    where: { id: adminUserId },
  });

  if (!userExists) {
    console.error(`❌ L'utilisateur par défaut id: ${adminUserId} n'existe pas dans la base de données.`);
    console.error('Veuillez créer l\'admin ou spécifier un ID d\'utilisateur existant.');
    await app.close();
    process.exit(1);
  }

  console.log('🚀 Démarrage du seeding du trafic historique (sur les 7 derniers jours)...');
  console.log(tomtomKey ? '🔑 Clé TomTom trouvée. Tentative d\'appel API dynamique.' : 'ℹ️ Pas de clé TomTom. Utilisation du fallback simulation intelligente.');

  let tomTomSuccessCount = 0;
  let simulatedCount = 0;
  let totalRecords = 0;

  const now = new Date();

  // Clear existing traffic history to avoid duplications
  await prisma.releveTrafic.deleteMany();
  console.log('🧹 Historique précédent de ReleveTrafic nettoyé.');

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - dayOffset);
    const dayOfWeek = targetDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const hour of SAMPLE_HOURS) {
      const logTime = new Date(targetDate);
      logTime.setHours(hour, 0, 0, 0);

      // Skip future dates
      if (logTime > now) continue;

      for (const spot of HOTSPOTS) {
        let speed = 0;
        let isTomTomData = false;

        if (tomtomKey) {
          try {
            // TomTom Flow Segment API call
            const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative-index/xml/4/json`;
            const response = await axios.get(url, {
              params: {
                key: tomtomKey,
                point: `${spot.latitude},${spot.longitude}`,
                unit: 'KMPH',
              },
              timeout: 5000,
            });

            if (response.data && response.data.flowSegmentData) {
              const flow = response.data.flowSegmentData;
              speed = flow.currentSpeed ?? 0;
              isTomTomData = true;
              tomTomSuccessCount++;
            }
          } catch (e) {
            // Fall silently to simulated data if API fails or rate-limited
          }
        }

        // Simulation fall-back/calculations
        if (!isTomTomData) {
          // Congestion simulation algorithm based on location, hour and weekend
          const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
          
          let congestion = spot.baseCongestionIndex;
          
          if (isPeakHour) {
            congestion += 0.15; // heavily congested
          } else {
            congestion -= 0.35; // fluid off-peak
          }

          if (isWeekend) {
            congestion -= 0.2; // weekend is generally more fluid
          }

          congestion = Math.max(0.05, Math.min(0.95, congestion));

          // Base max speed: 50 km/h
          const maxSpeed = 50.0;
          speed = maxSpeed * (1.0 - congestion);
          
          // Add small random noise for realism
          speed += (Math.random() * 6 - 3);
          speed = Math.max(4.0, Math.min(60.0, speed)); // speed constraints
          
          simulatedCount++;
        }

        // Map speed to level
        let level = 'fluide';
        if (speed < 10) level = 'bouchon';
        else if (speed < 30) level = 'dense';

        // Insert into database
        await prisma.releveTrafic.create({
          data: {
            latitude: spot.latitude,
            longitude: spot.longitude,
            vitesseMoyenne: speed,
            niveau: level,
            id_utilisateur: adminUserId,
            timestamp: logTime,
          },
        });

        totalRecords++;
      }
    }
  }

  console.log(`\n🎉 Seeding terminé avec succès !`);
  console.log(`📊 Statistiques de génération :`);
  console.log(`- Enregistrements Totaux : ${totalRecords}`);
  console.log(`- Depuis TomTom API : ${tomTomSuccessCount}`);
  console.log(`- Simulés intelligemment : ${simulatedCount}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur critique lors du seeding :', err);
  process.exit(1);
});
