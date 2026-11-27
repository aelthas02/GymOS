import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { daColunaDeData, paraColunaDeData } from '../../alunos/domain/datas';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import type { DataCivil } from '../../platform/domain/relogio';
import { FORMAS } from '../application/financeiro';
import {
  type AdesoesDoPeriodo,
  type ContratoVigente,
  type FiltroDoFinanceiro,
  type JanelaDeInstantes,
  LeituraFinanceira,
  type Lancamento,
  type NovoLancamento,
  type PlanoDoContrato,
  type PlanoParaFiltro,
  RepositorioDeLancamentos,
  type TotalDePagamentos,
  type UnidadeDaAcademia,
  type CategoriaDeLancamento,
  type TipoDeLancamento,
} from '../application/portas';
import type { Setor } from '../domain/financeiro';

// Repositórios do domínio financeiro: todos usam o cliente da transação do tenant (RLS).

type LinhaDoLancamento = Prisma.LancamentoGetPayload<object>;

const daLinha = (linha: LinhaDoLancamento): Lancamento => ({
  id: linha.id,
  tipo: linha.tipo as TipoDeLancamento,
  categoria: linha.categoria as CategoriaDeLancamento,
  setor: linha.setor as Setor | null,
  valorCentavos: linha.valorCentavos,
  data: daColunaDeData(linha.data),
  unidadeId: linha.unidadeId,
  descricao: linha.descricao,
  criadoEm: linha.criadoEm,
});

@Injectable()
export class RepositorioDeLancamentosPrisma extends RepositorioDeLancamentos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(lancamento: NovoLancamento): Promise<Lancamento> {
    const linha = await this.contexto.cliente().lancamento.create({
      data: {
        tenantId: this.contexto.tenant().id,
        tipo: lancamento.tipo,
        categoria: lancamento.categoria,
        setor: lancamento.setor,
        valorCentavos: lancamento.valorCentavos,
        data: paraColunaDeData(lancamento.data),
        unidadeId: lancamento.unidadeId,
        descricao: lancamento.descricao,
        criadoPor: lancamento.criadoPor,
      },
    });
    return daLinha(linha);
  }

  async doPeriodo(
    de: DataCivil,
    ate: DataCivil,
    filtro: Pick<FiltroDoFinanceiro, 'unidadeId' | 'categoria' | 'tipo'>,
  ): Promise<Lancamento[]> {
    const where: Prisma.LancamentoWhereInput = {
      data: { gte: paraColunaDeData(de), lte: paraColunaDeData(ate) },
    };
    if (filtro.unidadeId) {
      where.unidadeId = filtro.unidadeId;
    }
    if (filtro.categoria && filtro.categoria !== 'folha') {
      where.categoria = filtro.categoria;
    }
    if (filtro.categoria === 'folha') {
      // A folha não é lançamento: filtrar por ela esconde todos os lançamentos.
      return [];
    }
    const linhas = await this.contexto.cliente().lancamento.findMany({
      where,
      orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }, { id: 'desc' }],
    });
    return linhas.map(daLinha);
  }

  async unidadePadrao(): Promise<string> {
    const unidade = await this.contexto
      .cliente()
      .unidade.findFirst({ orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
    if (!unidade) {
      throw new Error('A academia não tem unidade cadastrada.');
    }
    return unidade.id;
  }

  async unidadeExiste(id: string): Promise<boolean> {
    return (await this.contexto.cliente().unidade.count({ where: { id } })) > 0;
  }
}

/** Contrato do plano e da unidade pedidos nos filtros. */
function contratoWhere(filtro: FiltroDoFinanceiro): Prisma.ContratoWhereInput {
  const where: Prisma.ContratoWhereInput = {};
  if (filtro.planoId) {
    where.planoId = filtro.planoId;
  }
  if (filtro.modalidade) {
    where.plano = { modalidades: { has: filtro.modalidade } };
  }
  if (filtro.unidadeId) {
    where.aluno = { unidadeId: filtro.unidadeId };
  }
  return where;
}

const temFiltroDeContrato = (filtro: FiltroDoFinanceiro): boolean =>
  Boolean(filtro.planoId || filtro.modalidade);

/** Parcelas que esperam pagamento: o saldo é o que falta pagar. */
const saldoDaParcela = (valorCentavos: number, pagoCentavos: number): number =>
  Math.max(0, valorCentavos - pagoCentavos);

@Injectable()
export class LeituraFinanceiraPrisma extends LeituraFinanceira {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  /** Restringe pagamentos e parcelas pelos filtros de unidade e plano (ids dos alunos e contratos). */
  private async restricoes(
    filtro: FiltroDoFinanceiro,
  ): Promise<{ contratoId?: { in: string[] }; alunoId?: { in: string[] } }> {
    const cliente = this.contexto.cliente();
    const restricoes: { contratoId?: { in: string[] }; alunoId?: { in: string[] } } = {};
    if (temFiltroDeContrato(filtro)) {
      const contratos = await cliente.contrato.findMany({
        where: contratoWhere({ planoId: filtro.planoId, modalidade: filtro.modalidade }),
        select: { id: true },
      });
      restricoes.contratoId = { in: contratos.map((contrato) => contrato.id) };
    }
    if (filtro.unidadeId) {
      const alunos = await cliente.aluno.findMany({
        where: { unidadeId: filtro.unidadeId },
        select: { id: true },
      });
      restricoes.alunoId = { in: alunos.map((aluno) => aluno.id) };
    }
    return restricoes;
  }

  async pagamentos(
    janela: JanelaDeInstantes,
    filtro: FiltroDoFinanceiro,
  ): Promise<TotalDePagamentos[]> {
    const where: Prisma.PagamentoWhereInput = {
      confirmadoEm: { gte: janela.inicio, lt: janela.fim },
      ...(await this.restricoes(filtro)),
    };
    if (filtro.forma) {
      const brutas = FORMAS.find((forma) => forma.chave === filtro.forma)?.brutas ?? [filtro.forma];
      where.forma = { in: [...brutas] };
    }
    const grupos = await this.contexto.cliente().pagamento.groupBy({
      by: ['alunoId', 'contratoId', 'origem', 'forma'],
      where,
      _sum: { valorCentavos: true, estornadoCentavos: true, taxaCentavos: true },
      _count: { _all: true },
    });
    return grupos.map((grupo) => ({
      alunoId: grupo.alunoId,
      contratoId: grupo.contratoId,
      origem: grupo.origem,
      forma: grupo.forma,
      brutoCentavos: (grupo._sum.valorCentavos ?? 0) - (grupo._sum.estornadoCentavos ?? 0),
      taxasCentavos: grupo._sum.taxaCentavos ?? 0,
      quantidade: grupo._count._all,
    }));
  }

  async planosDosContratos(contratoIds: readonly string[]): Promise<Map<string, PlanoDoContrato>> {
    const unicos = [...new Set(contratoIds)];
    if (unicos.length === 0) {
      return new Map();
    }
    const contratos = await this.contexto.cliente().contrato.findMany({
      where: { id: { in: unicos } },
      select: { id: true, planoId: true, plano: { select: { nome: true, modalidades: true } } },
    });
    return new Map(
      contratos.map((contrato) => [
        contrato.id,
        {
          planoId: contrato.planoId,
          planoNome: contrato.plano.nome,
          modalidades: contrato.plano.modalidades,
        },
      ]),
    );
  }

  async contratosVigentes(filtro: FiltroDoFinanceiro): Promise<ContratoVigente[]> {
    const cliente = this.contexto.cliente();
    const contratos = await cliente.contrato.findMany({
      where: { ...contratoWhere(filtro), vigente: true, estado: { in: ['ativo', 'tolerancia'] } },
      select: {
        id: true,
        alunoId: true,
        planoId: true,
        vencimentoEmAtraso: true,
        proximoVencimento: true,
        aluno: { select: { nome: true } },
        plano: { select: { nome: true } },
      },
    });
    const parcelas = await cliente.parcela.findMany({
      where: {
        contratoId: { in: contratos.map((contrato) => contrato.id) },
        situacao: { in: ['em_aberto', 'atrasada'] },
      },
      orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }],
      select: { contratoId: true, valorCentavos: true, pagoCentavos: true },
    });
    const primeira = new Map<string, number>();
    for (const parcela of parcelas) {
      if (!primeira.has(parcela.contratoId)) {
        primeira.set(
          parcela.contratoId,
          saldoDaParcela(parcela.valorCentavos, parcela.pagoCentavos),
        );
      }
    }
    return contratos.map((contrato) => ({
      contratoId: contrato.id,
      alunoId: contrato.alunoId,
      alunoNome: contrato.aluno.nome,
      planoId: contrato.planoId,
      planoNome: contrato.plano.nome,
      vencimentoEmAtraso: contrato.vencimentoEmAtraso
        ? daColunaDeData(contrato.vencimentoEmAtraso)
        : null,
      proximoVencimento: contrato.proximoVencimento
        ? daColunaDeData(contrato.proximoVencimento)
        : null,
      parcelaCentavos: primeira.get(contrato.id) ?? null,
    }));
  }

  async adesoes(
    de: DataCivil,
    ate: DataCivil,
    filtro: FiltroDoFinanceiro,
  ): Promise<AdesoesDoPeriodo> {
    const cliente = this.contexto.cliente();
    const intervalo = { gte: paraColunaDeData(de), lte: paraColunaDeData(ate) };
    const [novas, cancelamentos] = await Promise.all([
      cliente.contrato.count({ where: { ...contratoWhere(filtro), inicio: intervalo } }),
      cliente.contrato.count({ where: { ...contratoWhere(filtro), encerradoEm: intervalo } }),
    ]);
    return { novas, cancelamentos };
  }

  async adesoesAtivasEm(dias: readonly DataCivil[], filtro: FiltroDoFinanceiro): Promise<number[]> {
    const cliente = this.contexto.cliente();
    return Promise.all(
      dias.map((dia) => {
        const data = paraColunaDeData(dia);
        return cliente.contrato.count({
          where: {
            ...contratoWhere(filtro),
            inicio: { lte: data },
            fim: { gte: data },
            OR: [{ encerradoEm: null }, { encerradoEm: { gt: data } }],
          },
        });
      }),
    );
  }

  async saldoEmAtraso(filtro: FiltroDoFinanceiro): Promise<number> {
    const soma = await this.contexto.cliente().parcela.aggregate({
      where: { situacao: 'atrasada', ...(await this.restricoes(filtro)) },
      _sum: { valorCentavos: true, pagoCentavos: true },
    });
    return saldoDaParcela(soma._sum.valorCentavos ?? 0, soma._sum.pagoCentavos ?? 0);
  }

  async unidades(): Promise<UnidadeDaAcademia[]> {
    const linhas = await this.contexto
      .cliente()
      .unidade.findMany({ orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
    return linhas.map(({ id, nome }) => ({ id, nome }));
  }

  async planos(): Promise<PlanoParaFiltro[]> {
    const linhas = await this.contexto.cliente().plano.findMany({
      where: { excluidoEm: null },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true, modalidades: true },
    });
    return linhas;
  }
}
