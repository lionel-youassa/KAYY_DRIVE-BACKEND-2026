import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async mettreAJourPosition(
    uid: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await this.prisma.positionUtilisateur.upsert({
      where: { utilisateurId: uid },
      update: {
        latitude,
        longitude,
        derniereMiseAJour: new Date(),
      },
      create: {
        utilisateurId: uid,
        latitude,
        longitude,
        derniereMiseAJour: new Date(),
      },
    });
  }

  async supprimerPosition(uid: string): Promise<void> {
    await this.prisma.positionUtilisateur.delete({
      where: { utilisateurId: uid },
    });
  }
}
