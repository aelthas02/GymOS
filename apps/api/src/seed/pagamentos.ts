import {
  RepositorioDePagamentos,
  RepositorioDeParcelas,
} from '../modules/cobranca/application/portas';
import { setorDaOrigem } from '../modules/cobranca/domain/pagamento';
import { HOJE_DO_SEED } from './alunos';
import type { ModuloDeSeed } from './modulo-de-seed';
import { parcelasDosAlunosDoSeed } from './parcelas';

/**
 * Pagamentos das parcelas já vencidas em 19/11/2026 que não estão em atraso: PIX no balcão, ao meio-dia
 * de São Paulo do vencimento. Grava direto pelos repositórios, sem publicar PagamentoConfirmado, para
 * não reavaliar os contratos que o seed dos alunos já deixou como em Alunos.html. Idempotente: só paga
 * a parcela ainda em aberto.
 */
export const seedDosPagamentos: ModuloDeSeed = {
  nome: 'pagamentos',
  dependeDe: ['parcelas'],
  async executar(app, contexto) {
    const parcelas = app.get(RepositorioDeParcelas);
    const pagamentos = app.get(RepositorioDePagamentos);
    await contexto.noTenant(async () => {
      for (const { parcelas: doContrato } of await parcelasDosAlunosDoSeed(app)) {
        for (const parcela of doContrato) {
          if (parcela.situacao !== 'em_aberto' || parcela.vencimento >= HOJE_DO_SEED) {
            continue;
          }
          await pagamentos.criar({
            parcelaId: parcela.id,
            cobrancaId: null,
            contratoId: parcela.contratoId,
            alunoId: parcela.alunoId as string,
            valorCentavos: parcela.valorCentavos,
            taxaCentavos: 0,
            forma: 'pix',
            canal: 'balcao',
            origem: 'mensalidade',
            setor: setorDaOrigem('mensalidade'),
            emDuplicidade: false,
            provedor: null,
            idEventoExterno: null,
            confirmadoEm: new Date(`${parcela.vencimento}T15:00:00.000Z`),
          });
          await parcelas.atualizar(parcela.id, {
            pagoCentavos: parcela.valorCentavos,
            situacao: 'paga',
          });
        }
      }
    });
  },
};
