import { Injectable } from '@nestjs/common';
import {
  type ConfiguracaoDeAcesso,
  type DirecaoDeAcesso,
  type MetodoDeAcesso,
  type MotivoDeNegacao,
  type PassagemLiberada,
  type ResultadoDeAcesso,
  diaEmSaoPaulo,
} from '@gymos/shared-acesso';
import type { Prisma } from '../../../generated/prisma/client';
import { daColunaDeData, paraColunaDeData } from '../../alunos/domain/datas';
import {
  CifraDeCampos,
  definirCamposProtegidos,
} from '../../platform/application/protecao-de-dados';
import type { DataCivil } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type Acesso,
  type AlertaDeFrequencia,
  type ChaveDeQr,
  type EntradaPorDia,
  type NovoAcesso,
  RegistroDeQrUsado,
  RepositorioDeAcessos,
  RepositorioDeAlertas,
  RepositorioDeChavesDeQr,
  RepositorioDeConfiguracaoDeAcesso,
  RepositorioDeConfiguracaoDeAlertas,
} from '../application/portas';
import {
  type AlertaApurado,
  type ConfiguracaoDeAlertas,
  type DestinatarioDoAlerta,
  type NivelDoAlerta,
  type TipoDeAlerta,
} from '../domain/alerta';

// Repositórios do domínio acesso: usam o cliente da transação do tenant (RLS).

const LIBERADAS = ['liberado', 'tolerancia'];

type LinhaDeAcesso = Prisma.AcessoGetPayload<object>;

const acesso = (linha: LinhaDeAcesso): Acesso => ({
  id: linha.id,
  idDeOrigem: linha.idDeOrigem,
  unidadeId: linha.unidadeId,
  alunoId: linha.alunoId,
  metodo: linha.metodo as MetodoDeAcesso,
  direcao: linha.direcao as DirecaoDeAcesso,
  resultado: linha.resultado as ResultadoDeAcesso,
  motivo: linha.motivo as MotivoDeNegacao | null,
  modalidade: linha.modalidade,
  dispositivoId: linha.dispositivoId,
  registradoEm: linha.registradoEm,
  registradoPor: linha.registradoPor,
  observacao: linha.observacao,
});

const noPeriodo = (de: DataCivil, ate: DataCivil) => ({
  dia: { gte: paraColunaDeData(de), lte: paraColunaDeData(ate) },
});

const entradaLiberada = { direcao: 'entrada', resultado: { in: LIBERADAS } } as const;

@Injectable()
export class RepositorioDeAcessosPrisma extends RepositorioDeAcessos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(novo: NovoAcesso): Promise<Acesso | null> {
    // skipDuplicates = ON CONFLICT DO NOTHING na unicidade (tenant, id_de_origem): o reenvio devolve nulo.
    const criados = await this.contexto.cliente().acesso.createManyAndReturn({
      data: [
        {
          tenantId: this.contexto.tenant().id,
          ...novo,
          dia: paraColunaDeData(diaEmSaoPaulo(novo.registradoEm) as DataCivil),
        },
      ],
      skipDuplicates: true,
    });
    return criados[0] ? acesso(criados[0]) : null;
  }

  async porIdDeOrigem(idDeOrigem: string): Promise<Acesso | null> {
    const linha = await this.contexto.cliente().acesso.findFirst({ where: { idDeOrigem } });
    return linha ? acesso(linha) : null;
  }

  async passagensLiberadas(
    alunoId: string,
    desde: DataCivil,
    antes: Date,
  ): Promise<PassagemLiberada[]> {
    const linhas = await this.contexto.cliente().acesso.findMany({
      where: {
        alunoId,
        resultado: { in: LIBERADAS },
        dia: { gte: paraColunaDeData(desde) },
        registradoEm: { lt: antes },
      },
      select: { direcao: true, registradoEm: true },
    });
    return linhas.map((linha) => ({
      direcao: linha.direcao as DirecaoDeAcesso,
      registradoEm: linha.registradoEm,
    }));
  }

  async entradasNoPeriodo(de: DataCivil, ate: DataCivil): Promise<Date[]> {
    const linhas = await this.contexto.cliente().acesso.findMany({
      where: { ...entradaLiberada, ...noPeriodo(de, ate) },
      select: { registradoEm: true },
    });
    return linhas.map((linha) => linha.registradoEm);
  }

  async diasComEntrada(de: DataCivil, ate: DataCivil): Promise<EntradaPorDia[]> {
    const linhas = await this.contexto.cliente().acesso.findMany({
      where: { ...entradaLiberada, ...noPeriodo(de, ate), alunoId: { not: null } },
      distinct: ['alunoId', 'dia'],
      select: { alunoId: true, dia: true },
    });
    return linhas.flatMap((linha) =>
      linha.alunoId ? [{ alunoId: linha.alunoId, dia: daColunaDeData(linha.dia) }] : [],
    );
  }

  async ultimoDiaComEntrada(): Promise<Map<string, DataCivil>> {
    const grupos = await this.contexto.cliente().acesso.groupBy({
      by: ['alunoId'],
      where: { ...entradaLiberada, alunoId: { not: null } },
      _max: { dia: true },
    });
    const ultimos = new Map<string, DataCivil>();
    for (const grupo of grupos) {
      if (grupo.alunoId && grupo._max.dia) {
        ultimos.set(grupo.alunoId, daColunaDeData(grupo._max.dia));
      }
    }
    return ultimos;
  }

  async contarDoDia(dia: DataCivil): Promise<{ liberados: number; negados: number }> {
    const cliente = this.contexto.cliente();
    const doDia = { dia: paraColunaDeData(dia) };
    const [liberados, negados] = await Promise.all([
      cliente.acesso.count({ where: { ...entradaLiberada, ...doDia } }),
      cliente.acesso.count({ where: { resultado: 'negado', ...doDia } }),
    ]);
    return { liberados, negados };
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto.cliente().acesso.deleteMany({ where: { alunoId } });
    return count;
  }

  async doAluno(alunoId: string): Promise<Acesso[]> {
    const linhas = await this.contexto.cliente().acesso.findMany({
      where: { alunoId },
      orderBy: [{ registradoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(acesso);
  }
}

@Injectable()
export class RepositorioDeConfiguracaoDeAcessoPrisma extends RepositorioDeConfiguracaoDeAcesso {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async obter(): Promise<ConfiguracaoDeAcesso> {
    const tenantId = this.contexto.tenant().id;
    const linha = await this.contexto.cliente().configuracaoDeAcesso.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    return {
      bloqueioPorAtrasoDias: linha.bloqueioPorAtrasoDias,
      abertura: linha.abertura,
      fechamento: linha.fechamento,
      limitePorDia: linha.limitePorDia,
      antiPassback: linha.antiPassback,
    };
  }

  async salvar(config: ConfiguracaoDeAcesso): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    await this.contexto.cliente().configuracaoDeAcesso.upsert({
      where: { tenantId },
      create: { tenantId, ...config },
      update: config,
    });
  }
}

@Injectable()
export class RepositorioDeConfiguracaoDeAlertasPrisma extends RepositorioDeConfiguracaoDeAlertas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async obter(): Promise<ConfiguracaoDeAlertas> {
    const tenantId = this.contexto.tenant().id;
    const linha = await this.contexto.cliente().configuracaoDeAlertas.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    return {
      diasSemTreinar: linha.diasSemTreinar,
      urgenteAposDias: linha.urgenteAposDias,
      quedaPercentual: linha.quedaPercentual,
      ignorarFeriasETrancados: linha.ignorarFeriasETrancados,
      horaDaVerificacao: linha.horaDaVerificacao,
      destinatarios: linha.destinatarios as DestinatarioDoAlerta[],
      mensagemAoAluno: linha.mensagemAoAluno,
    };
  }

  async salvar(config: ConfiguracaoDeAlertas): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    const dados = { ...config, destinatarios: [...config.destinatarios] };
    await this.contexto.cliente().configuracaoDeAlertas.upsert({
      where: { tenantId },
      create: { tenantId, ...dados },
      update: dados,
    });
  }

  async reivindicarVerificacao(hoje: DataCivil): Promise<boolean> {
    await this.obter();
    const dia = paraColunaDeData(hoje);
    const { count } = await this.contexto.cliente().configuracaoDeAlertas.updateMany({
      where: { OR: [{ ultimaVerificacaoDia: null }, { ultimaVerificacaoDia: { lt: dia } }] },
      data: { ultimaVerificacaoDia: dia },
    });
    return count > 0;
  }
}

/** A chave privada do QR é cifrada com a chave do tenant (T13c); a pública não é segredo. */
export const CAMPOS_DA_CHAVE_DE_QR = definirCamposProtegidos('chave_de_qr', { chavePrivada: {} });

@Injectable()
export class RepositorioDeChavesDeQrPrisma extends RepositorioDeChavesDeQr {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  async ativaComPrivada(): Promise<(ChaveDeQr & { chavePrivada: string }) | null> {
    const linha = await this.contexto.cliente().chaveDeQr.findFirst({
      where: { ativa: true, revogadaEm: null },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
    });
    if (!linha) {
      return null;
    }
    const revelada = await this.cifra.revelar(CAMPOS_DA_CHAVE_DE_QR, linha, {
      titularId: linha.id,
      quem: 'sistema:qr-de-checkin',
    });
    return {
      id: linha.id,
      chavePublica: linha.chavePublica,
      ativa: linha.ativa,
      chavePrivada: revelada.chavePrivada,
    };
  }

  async criar(par: { chavePublica: string; chavePrivada: string }): Promise<ChaveDeQr> {
    const dados = await this.cifra.proteger(CAMPOS_DA_CHAVE_DE_QR, par);
    const linha = await this.contexto
      .cliente()
      .chaveDeQr.create({ data: { tenantId: this.contexto.tenant().id, ...dados } });
    return { id: linha.id, chavePublica: linha.chavePublica, ativa: linha.ativa };
  }

  async validas(): Promise<ChaveDeQr[]> {
    const linhas = await this.contexto.cliente().chaveDeQr.findMany({
      where: { revogadaEm: null },
      select: { id: true, chavePublica: true, ativa: true },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas;
  }
}

@Injectable()
export class RegistroDeQrUsadoPrisma extends RegistroDeQrUsado {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async consumir(nonce: string, alunoId: string, usadoEm: Date): Promise<boolean> {
    // A unicidade (tenant, nonce) com ON CONFLICT DO NOTHING é o uso único: duas leituras
    // simultâneas do mesmo token disputam o mesmo índice e só uma insere.
    const criados = await this.contexto.cliente().qrUsado.createManyAndReturn({
      data: [{ tenantId: this.contexto.tenant().id, nonce, alunoId, usadoEm }],
      skipDuplicates: true,
      select: { id: true },
    });
    return criados.length === 1;
  }

  async limparAntesDe(limite: Date): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .qrUsado.deleteMany({ where: { usadoEm: { lt: limite } } });
    return count;
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto.cliente().qrUsado.deleteMany({ where: { alunoId } });
    return count;
  }
}

type LinhaDeAlerta = Prisma.AlertaDeFrequenciaGetPayload<object>;

const alerta = (linha: LinhaDeAlerta): AlertaDeFrequencia => ({
  id: linha.id,
  alunoId: linha.alunoId,
  tipo: linha.tipo as TipoDeAlerta,
  nivel: linha.nivel as NivelDoAlerta,
  diasSemTreinar: linha.diasSemTreinar,
  quedaPercentual: linha.quedaPercentual,
  criadoEm: linha.criadoEm,
  atualizadoEm: linha.atualizadoEm,
});

@Injectable()
export class RepositorioDeAlertasPrisma extends RepositorioDeAlertas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async abertos(): Promise<AlertaDeFrequencia[]> {
    const linhas = await this.contexto.cliente().alertaDeFrequencia.findMany({
      where: { resolvidoEm: null },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(alerta);
  }

  async abrir(alunoId: string, apurado: AlertaApurado, quando: Date): Promise<AlertaDeFrequencia> {
    const linha = await this.contexto.cliente().alertaDeFrequencia.create({
      data: {
        tenantId: this.contexto.tenant().id,
        alunoId,
        tipo: apurado.tipo,
        nivel: apurado.nivel,
        diasSemTreinar: apurado.diasSemTreinar,
        quedaPercentual: apurado.quedaPercentual,
        criadoEm: quando,
        atualizadoEm: quando,
      },
    });
    return alerta(linha);
  }

  async atualizar(id: string, apurado: AlertaApurado, quando: Date): Promise<void> {
    await this.contexto.cliente().alertaDeFrequencia.update({
      where: { id },
      data: {
        nivel: apurado.nivel,
        diasSemTreinar: apurado.diasSemTreinar,
        quedaPercentual: apurado.quedaPercentual,
        atualizadoEm: quando,
      },
    });
  }

  async resolver(id: string, quando: Date): Promise<void> {
    await this.contexto
      .cliente()
      .alertaDeFrequencia.update({ where: { id }, data: { resolvidoEm: quando } });
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .alertaDeFrequencia.deleteMany({ where: { alunoId } });
    return count;
  }

  async doAluno(alunoId: string): Promise<AlertaDeFrequencia[]> {
    const linhas = await this.contexto.cliente().alertaDeFrequencia.findMany({
      where: { alunoId },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(alerta);
  }
}
