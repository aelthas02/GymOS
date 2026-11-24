import { RepositorioDeAlunos, RepositorioDeContratos } from '../modules/alunos/application/portas';
import { Parcelas } from '../modules/cobranca/application/parcelas';
import { RepositorioDeParcelas } from '../modules/cobranca/application/portas';
import type { Parcela } from '../modules/cobranca/domain/parcela';
import { ALUNOS_DO_SEED } from './alunos';
import type { ModuloDeSeed } from './modulo-de-seed';

/** Parcelas de cada aluno do seed, com o contrato vigente; `ContratoCriado` faz o mesmo em produção. */
export async function parcelasDosAlunosDoSeed(
  app: Parameters<ModuloDeSeed['executar']>[0],
): Promise<Array<{ vencimentoEmAtraso: string | null; parcelas: Parcela[] }>> {
  const alunos = app.get(RepositorioDeAlunos);
  const contratos = app.get(RepositorioDeContratos);
  const repositorio = app.get(RepositorioDeParcelas);
  const resultado: Array<{ vencimentoEmAtraso: string | null; parcelas: Parcela[] }> = [];
  for (const dados of ALUNOS_DO_SEED) {
    const alunoId = await alunos.idPorCpf(dados.cpf);
    const contrato = alunoId && (await contratos.vigenteDoAluno(alunoId));
    if (contrato) {
      resultado.push({
        vencimentoEmAtraso: dados.vencimentoEmAtraso ?? null,
        parcelas: await repositorio.doContrato(contrato.id),
      });
    }
  }
  return resultado;
}

/**
 * Cronograma dos contratos do seed (19/11/2026): a parcela do `vencimentoEmAtraso` de Alunos.html
 * fica atrasada (Rafael e Juliana). As demais vencidas são pagas pelo módulo `pagamentos`.
 * Idempotente: a parcela é única por contrato, período e número, e a atrasada não muda de novo.
 */
export const seedDasParcelas: ModuloDeSeed = {
  nome: 'parcelas',
  dependeDe: ['alunos'],
  async executar(app, contexto) {
    const alunos = app.get(RepositorioDeAlunos);
    const contratos = app.get(RepositorioDeContratos);
    const parcelas = app.get(Parcelas);
    const repositorio = app.get(RepositorioDeParcelas);
    await contexto.noTenant(async () => {
      for (const dados of ALUNOS_DO_SEED) {
        const alunoId = await alunos.idPorCpf(dados.cpf);
        const contrato = alunoId && (await contratos.vigenteDoAluno(alunoId));
        if (!alunoId || !contrato) {
          continue;
        }
        await parcelas.gerar({
          contratoId: contrato.id,
          alunoId,
          inicio: contrato.inicio,
          valorEmCentavos: contrato.valorTotalCentavos,
          parcelas: contrato.parcelas,
        });
      }
      for (const { vencimentoEmAtraso, parcelas: doContrato } of await parcelasDosAlunosDoSeed(
        app,
      )) {
        const atrasada = doContrato.find(
          (parcela) =>
            parcela.vencimento === vencimentoEmAtraso && parcela.situacao === 'em_aberto',
        );
        if (atrasada) {
          await repositorio.atualizar(atrasada.id, { situacao: 'atrasada' });
        }
      }
    });
  },
};
