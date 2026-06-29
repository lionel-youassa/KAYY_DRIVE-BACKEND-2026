import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Grâce à ça, le PrismaService sera disponible partout sans ré-importation !
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}