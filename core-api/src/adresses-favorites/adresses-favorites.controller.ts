import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { CreateAdresseFavoriteDto } from './dto/create-adresse-favorite.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserProfile } from '../auth/auth.service';

@Controller('adresses-favorites')
@UseGuards(AuthGuard)
export class AdressesFavoritesController {
  constructor(
    private readonly adressesFavoritesService: AdressesFavoritesService,
  ) {}

  // GET /adresses-favorites
  @Get()
  async getAll(@CurrentUser() user: UserProfile) {
    const adresses = await this.adressesFavoritesService.getAdressesFavorites(
      user.uid,
    );
    return { adresses };
  }

  // POST /adresses-favorites
  @Post()
  async create(
    @Body() dto: CreateAdresseFavoriteDto,
    @CurrentUser() user: UserProfile,
  ) {
    const created = await this.adressesFavoritesService.createAdresseFavorite({
      ...dto,
      id_utilisateur: user.uid,
    });
    return {
      success: true,
      adresse: {
        uid: created.id,
        nom: created.nom,
        adresse: created.adresse,
        latitude: created.latitude,
        longitude: created.longitude,
        categorie: created.categorie,
      },
    };
  }

  // DELETE /adresses-favorites/:id
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.adressesFavoritesService.deleteAdresseFavorite(id);
    return { success: true };
  }
}
