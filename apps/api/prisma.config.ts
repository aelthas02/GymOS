import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê o .env: o Nx o carrega nas tarefas (`nx run api:migrar`). As migrações rodam como
// gymos_migrator, dono das tabelas; a API conecta como gymos_app (ADR-003).
export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_MIGRATOR_URL'] ?? '' },
});
