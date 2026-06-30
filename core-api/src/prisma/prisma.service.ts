import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        // 1. On crée un pool de connexion PostgreSQL classique via le module 'pg'
        const pool = new Pool({
            connectionString: "postgresql://postgres:2017@localhost:5432/kayydrive_db?schema=public",
        });

        // 2. On instancie l'adapter Prisma 7
        const adapter = new PrismaPg(pool);

        // 3. On passe l'adapter au constructeur parent
        super({
            adapter,
            log: ['query', 'info', 'warn', 'error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}