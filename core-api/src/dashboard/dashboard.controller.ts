import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard, AdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Récupérer les statistiques générales du système' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques générales récupérées avec succès',
  })
  async getOverview() {
    return await this.dashboardService.getOverviewStats();
  }

  @Get('shortcuts')
  @ApiOperation({
    summary: 'Récupérer les statistiques des raccourcis communautaires',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des raccourcis récupérées avec succès',
  })
  async getShortcuts() {
    return await this.dashboardService.getShortcutsStats();
  }

  @Get('incidents')
  @ApiOperation({
    summary: 'Récupérer les statistiques des incidents (Hydro-Guard)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des incidents récupérées avec succès',
  })
  async getIncidents() {
    return await this.dashboardService.getIncidentsStats();
  }

  @Get('safe-drive')
  @ApiOperation({
    summary: 'Récupérer les statistiques Safe-Drive (qualité des routes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques Safe-Drive récupérées avec succès',
  })
  async getSafeDrive() {
    return await this.dashboardService.getSafeDriveStats();
  }

  @Get('engagement')
  @ApiOperation({
    summary: "Récupérer les statistiques d'engagement utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques d'engagement récupérées avec succès",
  })
  async getEngagement() {
    return await this.dashboardService.getUserEngagement();
  }

  @Get('performance')
  @ApiOperation({
    summary: 'Récupérer les statistiques de performance système',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de performance récupérées avec succès',
  })
  async getPerformance() {
    return await this.dashboardService.getSystemPerformance();
  }

  @Get('all')
  @ApiOperation({ summary: 'Récupérer toutes les statistiques du dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Toutes les statistiques récupérées avec succès',
  })
  async getAll() {
    const [overview, shortcuts, incidents, safeDrive, engagement, performance] =
      await Promise.all([
        this.dashboardService.getOverviewStats(),
        this.dashboardService.getShortcutsStats(),
        this.dashboardService.getIncidentsStats(),
        this.dashboardService.getSafeDriveStats(),
        this.dashboardService.getUserEngagement(),
        this.dashboardService.getSystemPerformance(),
      ]);

    return {
      overview,
      shortcuts,
      incidents,
      safeDrive,
      engagement,
      performance,
    };
  }
}
