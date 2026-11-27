import { seedDoAcesso } from './acesso';
import { seedDosAlunos } from './alunos';
import { seedDosAvisos } from './avisos';
import { seedDosFuncionarios } from './funcionarios';
import { seedDaAutenticacao } from './autenticacao';
import type { ModuloDeSeed } from './modulo-de-seed';
import { seedDasNotas } from './notas';
import { seedDosPagamentos } from './pagamentos';
import { seedDosTreinos } from './treinos';
import { seedDasParcelas } from './parcelas';
import { seedDaPlataforma } from './plataforma';

/**
 * Módulos de seed registrados (T35). O dono de cada domínio acrescenta o seu aqui, ao criar
 * `seed/<dominio>.ts`, declarando `dependeDe`. O runner ordena (`pnpm seed`).
 *
 * O módulo `alunos` (T15a) cria também os planos e os contratos; `parcelas` e `pagamentos` são da cobrança (T19); `funcionarios` é do T26a; `notas` é do fiscal (T20); `treinos` é do T25.
 */
export const MODULOS_DE_SEED: readonly ModuloDeSeed[] = [
  seedDaPlataforma,
  seedDaAutenticacao,
  seedDosFuncionarios,
  seedDosAlunos,
  seedDasParcelas,
  seedDosPagamentos,
  seedDosAvisos,
  seedDoAcesso,
  seedDasNotas,
  seedDosTreinos,
];
