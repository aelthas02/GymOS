import { RepositorioDeAlunos } from '../modules/alunos/application/portas';
import { RepositorioDePagamentos } from '../modules/cobranca/application/portas';
import type { Pagamento } from '../modules/cobranca/domain/pagamento';
import {
  AlunosDoFiscal,
  CobrancaDoFiscal,
  RepositorioDaConfiguracaoFiscal,
  RepositorioDeNotas,
} from '../modules/fiscal/application/portas';
import {
  type Competencia,
  competenciaDe,
  descricaoDaNota,
  ehOrigemDaNota,
  idDaNotaDoPagamento,
  tipoDaOrigem,
  totaisDaNota,
} from '../modules/fiscal/domain/nota-fiscal';
import { MOTIVO_CPF_NAO_ENCONTRADO } from '../modules/fiscal/infra/emissor.fake';
import type { DataCivil } from '../modules/platform/domain/relogio';
import { ALUNOS_DO_SEED } from './alunos';
import type { ModuloDeSeed } from './modulo-de-seed';

/** Dados fiscais de Configuracoes.html (o CNPJ da tela não tem dígitos válidos; este tem). */
export const DADOS_FISCAIS_DO_SEED = {
  razaoSocial: 'Academia Ritmo Ltda',
  cnpj: '12345678000195',
  regime: 'Simples Nacional',
  municipio: 'São Paulo - SP',
  codigoDoServico: '06.04 - Academia e ginástica',
  aliquotaIssPontosBase: 250,
  certificadoValidade: '2027-08-14' as DataCivil,
  emitirNfseAoConfirmar: true,
  emitirNfceNaVenda: true,
  enviarAoAluno: true,
  emitirEmLote: false,
};

/** Primeiro número de NFS-e do seed (FinNotas.html começa em 1.283). */
const PRIMEIRO_NUMERO = 1283;
const COMPETENCIA_DO_SEED = '2026-11';

/**
 * Dados fiscais da Ritmo e as NFS-e de novembro do seed: as dos pagamentos (gravados sem evento pelo
 * módulo `pagamentos`) emitidas em ordem de confirmação e, para a mensalidade em aberto, a do Rafael
 * rejeitada (o CPF dele é o que o emissor fake recusa) e a da Juliana pendente, como em FinNotas.html.
 * Sem PDF e XML: o Armazenamento fake de dev é em memória. Idempotente: a nota é única por pagamento,
 * e a da mensalidade em aberto, por parcela.
 */
export const seedDasNotas: ModuloDeSeed = {
  nome: 'notas',
  dependeDe: ['pagamentos'],
  async executar(app, contexto) {
    const configuracao = app.get(RepositorioDaConfiguracaoFiscal);
    const notas = app.get(RepositorioDeNotas);
    const alunos = app.get(RepositorioDeAlunos);
    const pagamentos = app.get(RepositorioDePagamentos);
    const doFiscal = app.get(AlunosDoFiscal);
    const cobranca = app.get(CobrancaDoFiscal);
    await contexto.noTenant(async (tenantId) => {
      if (!(await configuracao.obter())) {
        await configuracao.salvar(DADOS_FISCAIS_DO_SEED);
      }
      const doMes: Array<{ alunoId: string; nome: string; cpf: string; pagamento: Pagamento }> = [];
      for (const dados of ALUNOS_DO_SEED) {
        const alunoId = await alunos.idPorCpf(dados.cpf);
        if (!alunoId) {
          continue;
        }
        for (const pagamento of await pagamentos.doAluno(alunoId)) {
          if (competenciaDe(pagamento.confirmadoEm) === COMPETENCIA_DO_SEED) {
            doMes.push({ alunoId, nome: dados.nome, cpf: dados.cpf, pagamento });
          }
        }
      }
      doMes.sort((a, b) => a.pagamento.confirmadoEm.getTime() - b.pagamento.confirmadoEm.getTime());
      let numero = PRIMEIRO_NUMERO;
      for (const { alunoId, nome, cpf, pagamento } of doMes) {
        if (!ehOrigemDaNota(pagamento.origem)) {
          continue;
        }
        const tipo = tipoDaOrigem(pagamento.origem);
        const competencia = competenciaDe(pagamento.confirmadoEm);
        const totais = totaisDaNota(
          pagamento.valorCentavos,
          DADOS_FISCAIS_DO_SEED.aliquotaIssPontosBase,
        );
        const criada = await notas.criar({
          id: idDaNotaDoPagamento(tenantId, pagamento.id, tipo),
          tipo,
          pagamentoId: pagamento.id,
          parcelaId: pagamento.parcelaId,
          alunoId,
          origem: pagamento.origem,
          tomadorNome: nome,
          tomadorCpf: cpf,
          descricao: descricaoDaNota(pagamento.origem, competencia, await doFiscal.plano(alunoId)),
          codigoDoServico: DADOS_FISCAIS_DO_SEED.codigoDoServico,
          competencia,
          valorCentavos: totais.valorCentavos,
          aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
          issCentavos: totais.issCentavos,
          retencoesCentavos: totais.retencoesCentavos,
          formaDePagamento: pagamento.forma,
          enviarAoAluno: false,
          anexarArquivos: true,
          registradaNaFicha: true,
        });
        if (criada) {
          await notas.atualizar(criada.id, {
            situacao: 'emitida',
            tentativas: 1,
            numero: String(numero++),
            emitidaEm: pagamento.confirmadoEm,
          });
        }
      }

      // Mensalidade em aberto emitida à mão: Rafael rejeitada pelo emissor e Juliana pendente.
      for (const [cpf, rejeitada] of [
        ['52998224725', true],
        ['39053344705', false],
      ] as const) {
        const alunoId = await alunos.idPorCpf(cpf);
        const mensalidade = alunoId && (await cobranca.mensalidadeEmAberto(alunoId));
        const tomador = alunoId && (await doFiscal.tomador(alunoId));
        if (!alunoId || !mensalidade || !tomador) {
          continue;
        }
        if (await notas.daParcelaSemPagamento(mensalidade.parcelaId, 'nfse')) {
          continue;
        }
        const competencia = mensalidade.vencimento.slice(0, 7) as Competencia;
        const totais = totaisDaNota(
          mensalidade.saldoCentavos,
          DADOS_FISCAIS_DO_SEED.aliquotaIssPontosBase,
        );
        const criada = await notas.criar({
          tipo: 'nfse',
          pagamentoId: null,
          parcelaId: mensalidade.parcelaId,
          alunoId,
          origem: null,
          tomadorNome: tomador.nome,
          tomadorCpf: tomador.cpf,
          descricao: descricaoDaNota('mensalidade', competencia, await doFiscal.plano(alunoId)),
          codigoDoServico: DADOS_FISCAIS_DO_SEED.codigoDoServico,
          competencia,
          valorCentavos: totais.valorCentavos,
          aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
          issCentavos: totais.issCentavos,
          retencoesCentavos: totais.retencoesCentavos,
          formaDePagamento: null,
          enviarAoAluno: false,
          anexarArquivos: true,
          registradaNaFicha: true,
        });
        if (criada && rejeitada) {
          await notas.atualizar(criada.id, {
            situacao: 'rejeitada',
            tentativas: 1,
            motivoDaRejeicao: MOTIVO_CPF_NAO_ENCONTRADO,
          });
        }
      }
    });
  },
};
