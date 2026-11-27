import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { daColunaDeData, paraColunaDeData } from '../../alunos/domain/datas';
import {
  RepositorioDeFormasDePagamento,
  RepositorioDeParcelas,
} from '../../cobranca/application/portas';
import { saldo, SITUACOES_A_RECEBER } from '../../cobranca/domain/parcela';
import { CifraDeCampos } from '../../platform/application/protecao-de-dados';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  AlunosDoFiscal,
  type CamposDaNota,
  CobrancaDoFiscal,
  type DadosFiscais,
  type FiltroDeNotas,
  type MensalidadeEmAberto,
  type NotaFiscal,
  type NovaNota,
  type PaginaDeNotas,
  RepositorioDaConfiguracaoFiscal,
  RepositorioDeNotas,
  type ResumoDasNotas,
  type TomadorDaNota,
} from '../application/portas';
import type { Competencia, OrigemDaNota, SituacaoDaNota, TipoDeNota } from '../domain/nota-fiscal';

// Repositórios do domínio fiscal: todos usam o cliente da transação do tenant (RLS).

/** Campo cifrado do CPF do tomador (T13c); o dado autenticado amarra tenant e campo. */
const CAMPO_DO_CPF = 'nota_fiscal.tomador_cpf';
const TITULAR_REMOVIDO = 'Titular removido';

type LinhaDaNota = Prisma.NotaFiscalGetPayload<object>;

export class CursorDeNotasInvalidoError extends Error {
  constructor() {
    super('Cursor inválido.');
    this.name = 'CursorDeNotasInvalidoError';
  }
}

interface Cursor {
  criadoEm: string;
  id: string;
}

const codificarCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url');

function decodificarCursor(texto: string): Cursor {
  try {
    const valor = JSON.parse(Buffer.from(texto, 'base64url').toString('utf-8')) as Partial<Cursor>;
    if (typeof valor.criadoEm === 'string' && typeof valor.id === 'string') {
      return { criadoEm: valor.criadoEm, id: valor.id };
    }
  } catch {
    // cai no erro abaixo
  }
  throw new CursorDeNotasInvalidoError();
}

const maisRecentes: Prisma.NotaFiscalOrderByWithRelationInput[] = [
  { criadoEm: 'desc' },
  { id: 'desc' },
];

@Injectable()
export class RepositorioDeNotasPrisma extends RepositorioDeNotas {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  private async daLinha(linha: LinhaDaNota): Promise<NotaFiscal> {
    return {
      id: linha.id,
      tipo: linha.tipo as TipoDeNota,
      situacao: linha.situacao as SituacaoDaNota,
      numero: linha.numero,
      pagamentoId: linha.pagamentoId,
      parcelaId: linha.parcelaId,
      alunoId: linha.alunoId,
      origem: linha.origem as OrigemDaNota | null,
      tomadorNome: linha.tomadorNome,
      tomadorCpf: linha.tomadorCpf
        ? await this.cifra.decifrar(CAMPO_DO_CPF, linha.tomadorCpf)
        : null,
      descricao: linha.descricao,
      codigoDoServico: linha.codigoDoServico,
      competencia: linha.competencia as Competencia,
      valorCentavos: linha.valorCentavos,
      aliquotaIssPontosBase: linha.aliquotaIssPontosBase,
      issCentavos: linha.issCentavos,
      retencoesCentavos: linha.retencoesCentavos,
      formaDePagamento: linha.formaDePagamento,
      motivoDaRejeicao: linha.motivoDaRejeicao,
      motivoDoCancelamento: linha.motivoDoCancelamento,
      pdfChave: linha.pdfChave,
      xmlChave: linha.xmlChave,
      tentativas: linha.tentativas,
      enviarAoAluno: linha.enviarAoAluno,
      anexarArquivos: linha.anexarArquivos,
      registradaNaFicha: linha.registradaNaFicha,
      enviadaAoAlunoEm: linha.enviadaAoAlunoEm,
      emitidaEm: linha.emitidaEm,
      canceladaEm: linha.canceladaEm,
      criadoEm: linha.criadoEm,
    };
  }

  private async cpfCifrado(cpf: string | null | undefined): Promise<string | null | undefined> {
    if (cpf === undefined) {
      return undefined;
    }
    return cpf ? this.cifra.cifrar(CAMPO_DO_CPF, cpf) : null;
  }

  async criar(nota: NovaNota): Promise<NotaFiscal | null> {
    const cliente = this.contexto.cliente();
    const id = nota.id ?? randomUUID();
    const { count } = await cliente.notaFiscal.createMany({
      data: [
        {
          ...nota,
          id,
          tenantId: this.contexto.tenant().id,
          situacao: 'pendente',
          tomadorCpf: (await this.cpfCifrado(nota.tomadorCpf)) ?? null,
        },
      ],
      // UNIQUE (tenant_id, pagamento_id, tipo): a reentrega do evento, mesmo em paralelo, não cria outra.
      skipDuplicates: true,
    });
    return count === 0 ? null : this.porId(id);
  }

  async porId(id: string): Promise<NotaFiscal | null> {
    const linha = await this.contexto.cliente().notaFiscal.findFirst({ where: { id } });
    return linha && this.daLinha(linha);
  }

  async travar(id: string): Promise<NotaFiscal | null> {
    await this.contexto.cliente()
      .$queryRaw`SELECT id FROM nota_fiscal WHERE id = ${id}::uuid FOR UPDATE`;
    return this.porId(id);
  }

  async doPagamento(pagamentoId: string): Promise<NotaFiscal[]> {
    const linhas = await this.contexto
      .cliente()
      .notaFiscal.findMany({ where: { pagamentoId }, orderBy: maisRecentes });
    return Promise.all(linhas.map((linha) => this.daLinha(linha)));
  }

  async daParcelaSemPagamento(parcelaId: string, tipo: TipoDeNota): Promise<NotaFiscal | null> {
    const linha = await this.contexto.cliente().notaFiscal.findFirst({
      where: { parcelaId, tipo, pagamentoId: null, situacao: { not: 'cancelada' } },
      orderBy: maisRecentes,
    });
    return linha && this.daLinha(linha);
  }

  async atualizar(id: string, campos: CamposDaNota): Promise<NotaFiscal> {
    const { tomadorCpf, ...resto } = campos;
    const linha = await this.contexto.cliente().notaFiscal.update({
      where: { id },
      data: { ...resto, tomadorCpf: await this.cpfCifrado(tomadorCpf), atualizadoEm: new Date() },
    });
    return this.daLinha(linha);
  }

  async listar(
    filtro: FiltroDeNotas,
    paginacao: { limite: number; cursor?: string },
  ): Promise<PaginaDeNotas> {
    const cursor = paginacao.cursor ? decodificarCursor(paginacao.cursor) : null;
    const where: Prisma.NotaFiscalWhereInput = {
      ...(filtro.competencia ? { competencia: filtro.competencia } : {}),
      ...(filtro.situacoes ? { situacao: { in: [...filtro.situacoes] } } : {}),
      ...(filtro.alunoId ? { alunoId: filtro.alunoId } : {}),
      ...(filtro.registradaNaFicha === undefined
        ? {}
        : { registradaNaFicha: filtro.registradaNaFicha }),
      ...(cursor
        ? {
            OR: [
              { criadoEm: { lt: new Date(cursor.criadoEm) } },
              { criadoEm: new Date(cursor.criadoEm), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };
    const linhas = await this.contexto.cliente().notaFiscal.findMany({
      where,
      orderBy: maisRecentes,
      take: paginacao.limite + 1,
    });
    const pagina = linhas.slice(0, paginacao.limite);
    const ultima = pagina.at(-1);
    return {
      itens: await Promise.all(pagina.map((linha) => this.daLinha(linha))),
      proximoCursor:
        linhas.length > paginacao.limite && ultima
          ? codificarCursor({ criadoEm: ultima.criadoEm.toISOString(), id: ultima.id })
          : null,
    };
  }

  async resumo(competencia: Competencia): Promise<ResumoDasNotas> {
    const grupos = await this.contexto.cliente().notaFiscal.groupBy({
      by: ['tipo', 'situacao'],
      where: { competencia },
      _count: { _all: true },
      _sum: { valorCentavos: true },
    });
    const resumo: ResumoDasNotas = {
      emitidas: 0,
      valorFaturadoCentavos: 0,
      pendentes: 0,
      rejeitadas: 0,
      emitidasPorTipo: { nfse: 0, nfce: 0 },
    };
    for (const grupo of grupos) {
      const quantas = grupo._count._all;
      if (grupo.situacao === 'emitida') {
        resumo.emitidas += quantas;
        resumo.valorFaturadoCentavos += grupo._sum.valorCentavos ?? 0;
        resumo.emitidasPorTipo[grupo.tipo as TipoDeNota] += quantas;
      } else if (grupo.situacao === 'pendente' || grupo.situacao === 'processando') {
        resumo.pendentes += quantas;
      } else if (grupo.situacao === 'rejeitada') {
        resumo.rejeitadas += quantas;
      }
    }
    return resumo;
  }

  async pendentesDoLote(ate: Competencia): Promise<NotaFiscal[]> {
    const linhas = await this.contexto.cliente().notaFiscal.findMany({
      where: { tipo: 'nfse', situacao: 'pendente', competencia: { lte: ate } },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(linhas.map((linha) => this.daLinha(linha)));
  }

  async doAluno(alunoId: string): Promise<NotaFiscal[]> {
    const linhas = await this.contexto
      .cliente()
      .notaFiscal.findMany({ where: { alunoId }, orderBy: maisRecentes });
    return Promise.all(linhas.map((linha) => this.daLinha(linha)));
  }

  async anonimizarDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto.cliente().notaFiscal.updateMany({
      where: { alunoId },
      data: { alunoId: null, tomadorCpf: null, tomadorNome: TITULAR_REMOVIDO },
    });
    return count;
  }
}

@Injectable()
export class RepositorioDaConfiguracaoFiscalPrisma extends RepositorioDaConfiguracaoFiscal {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async obter(): Promise<DadosFiscais | null> {
    const linha = await this.contexto.cliente().configuracaoFiscal.findFirst();
    return linha && dadosDaLinha(linha);
  }

  async salvar(dados: DadosFiscais): Promise<DadosFiscais> {
    const tenantId = this.contexto.tenant().id;
    const campos = {
      ...dados,
      certificadoValidade: dados.certificadoValidade
        ? paraColunaDeData(dados.certificadoValidade)
        : null,
      atualizadoEm: new Date(),
    };
    const linha = await this.contexto.cliente().configuracaoFiscal.upsert({
      where: { tenantId },
      create: { tenantId, ...campos },
      update: campos,
    });
    return dadosDaLinha(linha);
  }
}

function dadosDaLinha(linha: Prisma.ConfiguracaoFiscalGetPayload<object>): DadosFiscais {
  return {
    razaoSocial: linha.razaoSocial,
    cnpj: linha.cnpj,
    regime: linha.regime,
    municipio: linha.municipio,
    codigoDoServico: linha.codigoDoServico,
    aliquotaIssPontosBase: linha.aliquotaIssPontosBase,
    certificadoValidade: linha.certificadoValidade
      ? daColunaDeData(linha.certificadoValidade)
      : null,
    emitirNfseAoConfirmar: linha.emitirNfseAoConfirmar,
    emitirNfceNaVenda: linha.emitirNfceNaVenda,
    enviarAoAluno: linha.enviarAoAluno,
    emitirEmLote: linha.emitirEmLote,
  };
}

/** Tomador lido do cadastro do aluno (sem dado de saúde) e o plano do contrato vigente. */
@Injectable()
export class AlunosDoFiscalPrisma extends AlunosDoFiscal {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  async tomador(alunoId: string): Promise<TomadorDaNota | null> {
    const linha = await this.contexto.cliente().aluno.findFirst({
      where: { id: alunoId },
      select: { nome: true, cpf: true, email: true, telefone: true },
    });
    if (!linha) {
      return null;
    }
    return {
      nome: linha.nome,
      cpf: await this.cifra.decifrar('aluno.cpf', linha.cpf),
      email: linha.email ? await this.cifra.decifrar('aluno.email', linha.email) : null,
      telefone: linha.telefone ? await this.cifra.decifrar('aluno.telefone', linha.telefone) : null,
    };
  }

  async plano(alunoId: string): Promise<string | null> {
    const contrato = await this.contexto.cliente().contrato.findFirst({
      where: { alunoId, vigente: true },
      select: { plano: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    return contrato?.plano.nome ?? null;
  }
}

/** Mensalidade em aberto e forma de pagamento preferida, pelos repositórios da cobrança (T19). */
@Injectable()
export class CobrancaDoFiscalAdapter extends CobrancaDoFiscal {
  constructor(
    private readonly parcelas: RepositorioDeParcelas,
    private readonly formas: RepositorioDeFormasDePagamento,
  ) {
    super();
  }

  async mensalidadeEmAberto(alunoId: string): Promise<MensalidadeEmAberto | null> {
    const parcela = (await this.parcelas.doAluno(alunoId)).find((candidata) =>
      SITUACOES_A_RECEBER.includes(candidata.situacao),
    );
    return parcela
      ? { parcelaId: parcela.id, vencimento: parcela.vencimento, saldoCentavos: saldo(parcela) }
      : null;
  }

  async formaPreferida(alunoId: string): Promise<string | null> {
    return (await this.formas.doAluno(alunoId))?.forma ?? null;
  }
}
