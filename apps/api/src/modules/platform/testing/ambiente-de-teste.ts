import { workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const postgres = z.url({ protocol: /^postgres(ql)?$/ });

// Variáveis dos testes de integração. TEST_DATABASE_ADMIN_URL é um papel com CREATEDB e CREATEROLE
// (no CI, o usuário do serviço Postgres do GitHub Actions); as credenciais de gymos_app e
// gymos_migrator saem de DATABASE_URL e DATABASE_MIGRATOR_URL, com o banco trocado pelo descartável.
export const ambienteDeTesteSchema = z.object({
  TEST_DATABASE_ADMIN_URL: postgres,
  DATABASE_URL: postgres,
  DATABASE_MIGRATOR_URL: postgres,
});

export type AmbienteDeTeste = z.infer<typeof ambienteDeTesteSchema>;

export function lerAmbienteDeTeste(source: Record<string, string | undefined>): AmbienteDeTeste {
  const result = ambienteDeTesteSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const variaveis = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(
    `Testes de integração sem banco configurado (${variaveis}). Copie o .env.example para .env ` +
      'ou defina as variáveis; veja "Testes de integração" no README.',
  );
}

// O Nx carrega o .env nas tarefas; rodando o Vitest direto, carregamos aqui sem sobrescrever nada.
export function carregarArquivoEnv(): void {
  const arquivo = join(workspaceRoot, '.env');
  if (existsSync(arquivo)) {
    process.loadEnvFile(arquivo);
  }
}
