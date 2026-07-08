import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategorieDto } from './dto/create-categorie.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // GET /categories
  @Get()
  async getAll() {
    const categories = await this.categoriesService.getCategories();
    return { categories };
  }

  // POST /categories (admin uniquement)
  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateCategorieDto) {
    const category = await this.categoriesService.createCategorie(dto);
    return { success: true, message: 'Catégorie créée avec succès', category };
  }
}
