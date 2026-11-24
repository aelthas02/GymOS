import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { daColunaDeData, paraColunaDeData } from '../../alunos/domain/datas';
import type { DataCivil } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  AlunosDaCobranca,
  type CamposDaParcela,
  type Cobranca,
  type DadosDaCobranca,
  type Estorno,
  type FormaDePagamentoDoAluno,
  type NovoPagamento,
  ReferenciasExternas,
  RepositorioDeCobrancas,
  RepositorioDeEstornos,
  RepositorioDeFormasDePagamento,
  RepositorioDePagamentos,
  RepositorioDeParcelas,
  type SituacaoDaCobranca,
} from '../application/portas';
import type {
  Canal,
  FormaDeCobranca,
  FormaDoPagamento,
  FormaPreferida,
  Origem,
  Pagamento,
  Setor,
  SituacaoDoPagamento,
} from '../domain/pagamento';
import {
  type NovaParcela,
  type Parcela,
  type SituacaoDaParcela,
  SITUACOES_A_RECEBER,
} from '../domain/parcela';

// Repositórios do domínio cobrança: todos usam o cliente da transação do tenant (RLS).

const dataOuNulo = (data: Date | null): DataCivil | null => (data ? daColunaDeData(data) : null);

interface LinhaDaParcela {
  id: string;
  contratoId: string;
  alunoId: string | null;
  periodo: Date;
  numero: number;
  totalDeParcelas: number;
  valorCentavos: number;
  pagoCentavos: number;
  vencimento: Date;
  vencimentoOriginal: Date;
  situacao: string;
  suspensaDesde: Date | null;
}

function parcelaDaLinha(linha: LinhaDaParcela): Parcela {
  return {
    id: linha.id,
    contratoId: linha.contratoId,
    alunoId: linha.alunoId,
    periodo: daColunaDeData(linha.periodo),
    numero: linha.numero,
    totalDeParcelas: linha.totalDeParcelas,
    valorCentavos: linha.valorCentavos,
    pagoCentavos: linha.pagoCentavos,
    vencimento: daColunaDeData(linha.vencimento),
    vencimentoOriginal: daColunaDeData(linha.vencimentoOriginal),
    situacao: linha.situacao as SituacaoDaParcela,
    suspensaDesde: dataOuNulo(linha.suspensaDesde),
  };
}

const porVencimento = [{ vencimento: 'asc' }, { numero: 'asc' }] as const;

@Injectable()
export class RepositorioDeParcelasPrisma extends RepositorioDeParcelas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criarCronograma(
    contrato: { contratoId: string; alunoId: string; periodo: DataCivil },
    parcelas: readonly NovaParcela[],
  ): Promise<number> {
    const tenantId = this.contexto.tenant().id;
    const { count } = await this.contexto.cliente().parcela.createMany({
      data: parcelas.map((parcela) => ({
        tenantId,
        contratoId: contrato.contratoId,
        alunoId: contrato.alunoId,
        periodo: paraColunaDeData(contrato.periodo),
        numero: parcela.numero,
        totalDeParcelas: parcela.totalDeParcelas,
        valorCentavos: parcela.valorCentavos,
        vencimento: paraColunaDeData(parcela.vencimento),
        vencimentoOriginal: paraColunaDeData(parcela.vencimento),
        situacao: 'em_aberto',
      })),
      skipDuplicates: true,
    });
    return count;
  }

  async porId(id: string): Promise<Parcela | null> {
    const linha = await this.contexto.cliente().parcela.findFirst({ where: { id } });
    return linha && parcelaDaLinha(linha);
  }

  async travar(id: string): Promise<Parcela | null> {
    const cliente = this.contexto.cliente();
    await cliente.$queryRaw`SELECT id FROM parcela WHERE id = ${id}::uuid FOR UPDATE`;
    return this.porId(id);
  }

  async doContrato(contratoId: string): Promise<Parcela[]> {
    const linhas = await this.contexto
      .cliente()
      .parcela.findMany({ where: { contratoId }, orderBy: [...porVencimento] });
    return linhas.map(parcelaDaLinha);
  }

  async doAluno(alunoId: string): Promise<Parcela[]> {
    const linhas = await this.contexto
      .cliente()
      .parcela.findMany({ where: { alunoId }, orderBy: [...porVencimento] });
    return linhas.map(parcelaDaLinha);
  }

  async atualizar(id: string, campos: CamposDaParcela): Promise<Parcela> {
    const linha = await this.contexto.cliente().parcela.update({
      where: { id },
      data: {
        situacao: campos.situacao,
        pagoCentavos: campos.pagoCentavos,
        vencimento: campos.vencimento ? paraColunaDeData(campos.vencimento) : undefined,
        suspensaDesde:
          campos.suspensaDesde === undefined
            ? undefined
            : campos.suspensaDesde && paraColunaDeData(campos.suspensaDesde),
      },
    });
    return parcelaDaLinha(linha);
  }

  async comSituacao(situacoes: readonly SituacaoDaParcela[]): Promise<Parcela[]> {
    const linhas = await this.contexto.cliente().parcela.findMany({
      where: { situacao: { in: [...situacoes] } },
      orderBy: [...porVencimento],
    });
    return linhas.map(parcelaDaLinha);
  }

  async vencidasEmAberto(hoje: DataCivil): Promise<Parcela[]> {
    const linhas = await this.contexto.cliente().parcela.findMany({
      where: { situacao: 'em_aberto', vencimento: { lt: paraColunaDeData(hoje) } },
      orderBy: [...porVencimento],
    });
    return linhas.map(parcelaDaLinha);
  }

  async anonimizarDoAluno(alunoId: string): Promise<number> {
    const cliente = this.contexto.cliente();
    await cliente.parcela.updateMany({
      where: { alunoId, situacao: { in: [...SITUACOES_A_RECEBER, 'suspensa'] } },
      data: { situacao: 'cancelada' },
    });
    const { count } = await cliente.parcela.updateMany({
      where: { alunoId },
      data: { alunoId: null },
    });
    return count;
  }
}

interface LinhaDaCobranca {
  id: string;
  parcelaId: string | null;
  alunoId: string | null;
  forma: string;
  valorCentavos: number;
  vencimento: Date;
  provedor: string;
  idExterno: string;
  situacao: string;
  dados: Prisma.JsonValue;
  criadoEm: Date;
}

function cobrancaDaLinha(linha: LinhaDaCobranca): Cobranca {
  return {
    id: linha.id,
    parcelaId: linha.parcelaId,
    alunoId: linha.alunoId,
    forma: linha.forma as FormaDeCobranca,
    valorCentavos: linha.valorCentavos,
    vencimento: daColunaDeData(linha.vencimento),
    provedor: linha.provedor,
    idExterno: linha.idExterno,
    situacao: linha.situacao as SituacaoDaCobranca,
    dados: (linha.dados ?? {}) as DadosDaCobranca,
    criadoEm: linha.criadoEm,
  };
}

@Injectable()
export class RepositorioDeCobrancasPrisma extends RepositorioDeCobrancas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(dados: Omit<Cobranca, 'criadoEm'>): Promise<Cobranca> {
    const linha = await this.contexto.cliente().cobranca.create({
      data: {
        ...dados,
        tenantId: this.contexto.tenant().id,
        vencimento: paraColunaDeData(dados.vencimento),
        dados: { ...dados.dados },
      },
    });
    return cobrancaDaLinha(linha);
  }

  async porId(id: string): Promise<Cobranca | null> {
    const linha = await this.contexto.cliente().cobranca.findFirst({ where: { id } });
    return linha && cobrancaDaLinha(linha);
  }

  async porIdExterno(provedor: string, idExterno: string): Promise<Cobranca | null> {
    const linha = await this.contexto
      .cliente()
      .cobranca.findFirst({ where: { provedor, idExterno } });
    return linha && cobrancaDaLinha(linha);
  }

  async pendentesDaParcela(parcelaId: string): Promise<Cobranca[]> {
    const linhas = await this.contexto.cliente().cobranca.findMany({
      where: { parcelaId, situacao: 'pendente' },
      orderBy: { criadoEm: 'desc' },
    });
    return linhas.map(cobrancaDaLinha);
  }

  async atualizarSituacao(id: string, situacao: SituacaoDaCobranca): Promise<void> {
    await this.contexto.cliente().cobranca.update({ where: { id }, data: { situacao } });
  }

  async doAluno(alunoId: string): Promise<Cobranca[]> {
    const linhas = await this.contexto
      .cliente()
      .cobranca.findMany({ where: { alunoId }, orderBy: { criadoEm: 'desc' } });
    return linhas.map(cobrancaDaLinha);
  }

  async anonimizarDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .cobranca.updateMany({ where: { alunoId }, data: { alunoId: null } });
    return count;
  }
}

interface LinhaDoPagamento {
  id: string;
  parcelaId: string | null;
  cobrancaId: string | null;
  contratoId: string | null;
  alunoId: string | null;
  valorCentavos: number;
  taxaCentavos: number;
  estornadoCentavos: number;
  forma: string;
  canal: string;
  origem: string;
  setor: string;
  situacao: string;
  emDuplicidade: boolean;
  provedor: string | null;
  confirmadoEm: Date;
}

function pagamentoDaLinha(linha: LinhaDoPagamento): Pagamento {
  return {
    id: linha.id,
    parcelaId: linha.parcelaId,
    cobrancaId: linha.cobrancaId,
    contratoId: linha.contratoId,
    alunoId: linha.alunoId,
    valorCentavos: linha.valorCentavos,
    taxaCentavos: linha.taxaCentavos,
    estornadoCentavos: linha.estornadoCentavos,
    forma: linha.forma as FormaDoPagamento,
    canal: linha.canal as Canal,
    origem: linha.origem as Origem,
    setor: linha.setor as Setor,
    situacao: linha.situacao as SituacaoDoPagamento,
    emDuplicidade: linha.emDuplicidade,
    provedor: linha.provedor,
    confirmadoEm: linha.confirmadoEm,
  };
}

@Injectable()
export class RepositorioDePagamentosPrisma extends RepositorioDePagamentos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(dados: NovoPagamento): Promise<Pagamento> {
    const linha = await this.contexto.cliente().pagamento.create({
      data: { ...dados, tenantId: this.contexto.tenant().id, situacao: 'confirmado' },
    });
    return pagamentoDaLinha(linha);
  }

  async porId(id: string): Promise<Pagamento | null> {
    const linha = await this.contexto.cliente().pagamento.findFirst({ where: { id } });
    return linha && pagamentoDaLinha(linha);
  }

  async porEventoExterno(provedor: string, idEvento: string): Promise<Pagamento | null> {
    const linha = await this.contexto
      .cliente()
      .pagamento.findFirst({ where: { provedor, idEventoExterno: idEvento } });
    return linha && pagamentoDaLinha(linha);
  }

  async daCobranca(cobrancaId: string): Promise<Pagamento[]> {
    const linhas = await this.contexto
      .cliente()
      .pagamento.findMany({ where: { cobrancaId }, orderBy: { confirmadoEm: 'asc' } });
    return linhas.map(pagamentoDaLinha);
  }

  async doAluno(alunoId: string): Promise<Pagamento[]> {
    const linhas = await this.contexto.cliente().pagamento.findMany({
      where: { alunoId },
      orderBy: [{ confirmadoEm: 'desc' }, { id: 'asc' }],
    });
    return linhas.map(pagamentoDaLinha);
  }

  async atualizarEstorno(
    id: string,
    campos: { estornadoCentavos: number; situacao: SituacaoDoPagamento },
  ): Promise<Pagamento> {
    const linha = await this.contexto.cliente().pagamento.update({ where: { id }, data: campos });
    return pagamentoDaLinha(linha);
  }

  async emDuplicidadeAEstornar(): Promise<Pagamento[]> {
    const linhas = await this.contexto.cliente().pagamento.findMany({
      where: { emDuplicidade: true, situacao: { not: 'estornado' } },
      orderBy: { confirmadoEm: 'asc' },
    });
    return linhas.map(pagamentoDaLinha);
  }

  async anonimizarDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .pagamento.updateMany({ where: { alunoId }, data: { alunoId: null } });
    return count;
  }
}

@Injectable()
export class RepositorioDeEstornosPrisma extends RepositorioDeEstornos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(dados: Omit<Estorno, 'id'> & { idEventoExterno: string | null }): Promise<Estorno> {
    const linha = await this.contexto.cliente().estorno.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
    });
    return {
      id: linha.id,
      pagamentoId: linha.pagamentoId,
      valorCentavos: linha.valorCentavos,
      motivo: linha.motivo,
      provedor: linha.provedor,
      estornadoEm: linha.estornadoEm,
    };
  }

  async porEventoExterno(provedor: string, idEvento: string): Promise<Estorno | null> {
    const linha = await this.contexto
      .cliente()
      .estorno.findFirst({ where: { provedor, idEventoExterno: idEvento } });
    return linha && { ...linha };
  }

  async doPagamento(pagamentoId: string): Promise<Estorno[]> {
    return this.contexto
      .cliente()
      .estorno.findMany({ where: { pagamentoId }, orderBy: { estornadoEm: 'asc' } });
  }
}

@Injectable()
export class RepositorioDeFormasDePagamentoPrisma extends RepositorioDeFormasDePagamento {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async doAluno(alunoId: string): Promise<FormaDePagamentoDoAluno | null> {
    const linha = await this.contexto.cliente().formaDePagamento.findFirst({ where: { alunoId } });
    return linha && { ...linha, forma: linha.forma as FormaPreferida };
  }

  async salvar(forma: FormaDePagamentoDoAluno): Promise<FormaDePagamentoDoAluno> {
    const tenantId = this.contexto.tenant().id;
    const linha = await this.contexto.cliente().formaDePagamento.upsert({
      where: { tenantId_alunoId: { tenantId, alunoId: forma.alunoId } },
      create: { tenantId, ...forma },
      update: forma,
    });
    return { ...linha, forma: linha.forma as FormaPreferida };
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .formaDePagamento.deleteMany({ where: { alunoId } });
    return count;
  }
}

@Injectable()
export class AlunosDaCobrancaPrisma extends AlunosDaCobranca {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async nomes(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const linhas = await this.contexto.cliente().aluno.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, nome: true },
    });
    return new Map(linhas.map((linha) => [linha.id, linha.nome]));
  }
}

@Injectable()
export class ReferenciasExternasPrisma extends ReferenciasExternas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async registrar(provedor: string, idExterno: string, cobrancaId: string): Promise<void> {
    await this.contexto.cliente().referenciaExterna.create({
      data: {
        tenantId: this.contexto.tenant().id,
        provedor,
        idExterno,
        recurso: 'cobranca',
        recursoId: cobrancaId,
      },
    });
  }
}
