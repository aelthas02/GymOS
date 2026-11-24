import { seedDosAlunos } from './alunos';
import { seedDosAvisos } from './avisos';
import { seedDosFuncionarios } from './funcionarios';
import { seedDaAutenticacao } from './autenticacao';
import type { ModuloDeSeed } from './modulo-de-seed';
import { seedDaPlataforma } from './plataforma';

/**
 * Módulos de seed registrados (T35). O dono de cada domínio acrescenta o seu aqui, ao criar
 * `seed/<dominio>.ts`, declarando `dependeDe`. O runner ordena (`pnpm seed`).
 *
 * Previstos: parcelas, pagamentos, notas. O módulo `alunos` (T15a) cria também os
 * planos e os contratos.
 */
export const MODULOS_DE_SEED: readonly ModuloDeSeed[] = [
  seedDaPlataforma,
  seedDaAutenticacao,
  seedDosFuncionarios,
  seedDosAlunos,
  seedDosAvisos,
];
