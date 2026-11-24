import type { INestApplicationContext } from '@nestjs/common';

/**
 * Ordem de referência dos domínios (T35). Quando dois módulos prontos não dependem um do outro,
 * o que aparece primeiro aqui roda primeiro; nomes fora da lista rodam depois, na ordem de registro.
 * `dependeDe` é o que garante a ordem; esta lista só torna a execução previsível.
 */
export const ORDEM_DOS_DOMINIOS = [
  'plataforma',
  'autenticacao',
  'funcionarios',
  'planos',
  'alunos',
  'contratos',
  'parcelas',
  'pagamentos',
  'acesso',
  'notas',
] as const;

/** O que o runner entrega a cada módulo, além do contexto da aplicação. */
export interface ContextoDoSeed {
  /**
   * Executa `corpo` em `runAsTenant` da academia do seed (Ritmo). Todo dado de domínio nasce aqui:
   * a RLS vale também para o seed. Falha com mensagem clara se o seed da plataforma ainda não rodou.
   */
  noTenant<T>(corpo: (tenantId: string) => Promise<T>): Promise<T>;
}

/**
 * Contrato de um módulo de seed. Cada domínio cria `seed/<dominio>.ts`, exporta um módulo e o
 * registra em `modulos.ts`.
 *
 * - `nome`: único, em minúsculas; é o que os outros usam em `dependeDe`.
 * - `dependeDe`: nomes dos módulos que precisam ter rodado antes. Um nome não registrado falha o seed.
 * - `executar`: **idempotente** (rodar duas vezes não duplica nem altera o que já existe) e coerente
 *   com as regras de negócio; não reproduz as contradições das telas (`docs/design/inconsistencias.md`).
 *   Tempo só pela porta `Relogio`, nunca por `Date.now()`.
 */
export interface ModuloDeSeed {
  nome: string;
  dependeDe: readonly string[];
  executar(app: INestApplicationContext, contexto: ContextoDoSeed): Promise<void>;
}
