import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type AgenteDaCatraca,
  type AlteracaoDoCache,
  type CadastroBiometrico,
  type CodigoDePareamento,
  type ComandoDoAgente,
  type Dispositivo,
  type NovoComando,
  type NovoDispositivo,
  type QuedaDeDispositivo,
  RepositorioDeAgentes,
  RepositorioDeCadastrosBiometricos,
  RepositorioDeCodigos,
  RepositorioDeComandos,
  RepositorioDeDispositivos,
  RepositorioDeQuedas,
  RepositorioDoCacheDeAcesso,
} from '../application/portas';
import type {
  MetodoDoDispositivo,
  StatusDoComando,
  TipoDeBiometria,
  TipoDeComando,
  TipoDeDispositivo,
} from '../domain/dispositivo';

// Repositórios do domínio dispositivos: usam o cliente da transação do tenant (RLS).

const agente = (linha: Prisma.AgenteDaCatracaGetPayload<object>): AgenteDaCatraca => ({
  id: linha.id,
  nome: linha.nome,
  credencialHash: linha.credencialHash,
  credencialGeradaEm: linha.credencialGeradaEm,
  versaoDoAgente: linha.versaoDoAgente,
  ultimoBatimentoEm: linha.ultimoBatimentoEm,
  ultimaSincronizacaoEm: linha.ultimaSincronizacaoEm,
  revogadoEm: linha.revogadoEm,
  criadoEm: linha.criadoEm,
});

@Injectable()
export class RepositorioDeAgentesPrisma extends RepositorioDeAgentes {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(
    id: string,
    dados: { nome: string; credencialHash: string; versaoDoAgente: string | null },
    agora: Date,
  ): Promise<AgenteDaCatraca> {
    return agente(
      await this.contexto.cliente().agenteDaCatraca.create({
        data: { id, tenantId: this.contexto.tenant().id, ...dados, credencialGeradaEm: agora },
      }),
    );
  }

  async porId(id: string): Promise<AgenteDaCatraca | null> {
    const linha = await this.contexto.cliente().agenteDaCatraca.findFirst({ where: { id } });
    return linha ? agente(linha) : null;
  }

  async listar(): Promise<AgenteDaCatraca[]> {
    const linhas = await this.contexto
      .cliente()
      .agenteDaCatraca.findMany({ orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
    return linhas.map(agente);
  }

  async trocarCredencial(id: string, credencialHash: string, agora: Date): Promise<void> {
    await this.contexto.cliente().agenteDaCatraca.updateMany({
      where: { id },
      data: { credencialHash, credencialGeradaEm: agora },
    });
  }

  async revogar(id: string, agora: Date): Promise<void> {
    await this.contexto
      .cliente()
      .agenteDaCatraca.updateMany({ where: { id }, data: { revogadoEm: agora } });
  }

  async registrarBatimento(id: string, versaoDoAgente: string | null, agora: Date): Promise<void> {
    await this.contexto.cliente().agenteDaCatraca.updateMany({
      where: { id },
      data: {
        ultimoBatimentoEm: agora,
        ...(versaoDoAgente === null ? {} : { versaoDoAgente }),
      },
    });
  }

  async registrarSincronizacao(id: string, agora: Date): Promise<void> {
    await this.contexto
      .cliente()
      .agenteDaCatraca.updateMany({ where: { id }, data: { ultimaSincronizacaoEm: agora } });
  }
}

@Injectable()
export class RepositorioDeCodigosPrisma extends RepositorioDeCodigos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(
    codigo: string,
    expiraEm: Date,
    criadoPor: string | null,
    agora: Date,
  ): Promise<CodigoDePareamento | null> {
    const cliente = this.contexto.cliente();
    // Só o último código vale: apaga o que venceu e o que ninguém usou.
    await cliente.codigoDePareamento.deleteMany({
      where: { OR: [{ expiraEm: { lt: agora } }, { usadoEm: null }] },
    });
    // skipDuplicates = ON CONFLICT DO NOTHING em (tenant, codigo): sem abortar a transação.
    const [criado] = await cliente.codigoDePareamento.createManyAndReturn({
      data: [{ tenantId: this.contexto.tenant().id, codigo, expiraEm, criadoPor }],
      skipDuplicates: true,
    });
    return criado
      ? { id: criado.id, codigo: criado.codigo, expiraEm: criado.expiraEm, usadoEm: null }
      : null;
  }

  async consumir(codigo: string, agenteId: string, agora: Date): Promise<boolean> {
    // UPDATE condicional: duas trocas simultâneas do mesmo código disputam a linha e só uma vence.
    const { count } = await this.contexto.cliente().codigoDePareamento.updateMany({
      where: { codigo, usadoEm: null, expiraEm: { gte: agora } },
      data: { usadoEm: agora, agenteId },
    });
    return count === 1;
  }
}

const dispositivo = (linha: Prisma.DispositivoGetPayload<object>): Dispositivo => ({
  id: linha.id,
  nome: linha.nome,
  tipo: linha.tipo as TipoDeDispositivo,
  local: linha.local,
  metodos: linha.metodos as MetodoDoDispositivo[],
  unidadeId: linha.unidadeId,
  agenteId: linha.agenteId,
  online: linha.online,
  ultimoBatimentoEm: linha.ultimoBatimentoEm,
  criadoEm: linha.criadoEm,
});

@Injectable()
export class RepositorioDeDispositivosPrisma extends RepositorioDeDispositivos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(novo: NovoDispositivo): Promise<Dispositivo> {
    return dispositivo(
      await this.contexto.cliente().dispositivo.create({
        data: { tenantId: this.contexto.tenant().id, ...novo, metodos: [...novo.metodos] },
      }),
    );
  }

  async atualizar(id: string, dados: NovoDispositivo): Promise<Dispositivo | null> {
    const cliente = this.contexto.cliente();
    const { count } = await cliente.dispositivo.updateMany({
      where: { id },
      data: { ...dados, metodos: [...dados.metodos] },
    });
    return count === 0 ? null : this.porId(id);
  }

  async excluir(id: string): Promise<boolean> {
    const { count } = await this.contexto.cliente().dispositivo.deleteMany({ where: { id } });
    return count > 0;
  }

  async porId(id: string): Promise<Dispositivo | null> {
    const linha = await this.contexto.cliente().dispositivo.findFirst({ where: { id } });
    return linha ? dispositivo(linha) : null;
  }

  async listar(): Promise<Dispositivo[]> {
    const linhas = await this.contexto
      .cliente()
      .dispositivo.findMany({ orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
    return linhas.map(dispositivo);
  }

  async doAgente(agenteId: string): Promise<Dispositivo[]> {
    const linhas = await this.contexto.cliente().dispositivo.findMany({ where: { agenteId } });
    return linhas.map(dispositivo);
  }

  async doAgenteOuLivres(agenteId: string, ids: readonly string[]): Promise<Dispositivo[]> {
    const linhas = await this.contexto.cliente().dispositivo.findMany({
      where: { id: { in: [...ids] }, OR: [{ agenteId }, { agenteId: null }] },
    });
    return linhas.map(dispositivo);
  }

  async marcarOnline(id: string, agenteId: string, agora: Date): Promise<void> {
    await this.contexto.cliente().dispositivo.updateMany({
      where: { id },
      data: { online: true, ultimoBatimentoEm: agora, agenteId },
    });
  }

  async marcarOffline(id: string): Promise<void> {
    await this.contexto
      .cliente()
      .dispositivo.updateMany({ where: { id }, data: { online: false } });
  }

  async onlineSemSinalDesde(limite: Date): Promise<Dispositivo[]> {
    const linhas = await this.contexto.cliente().dispositivo.findMany({
      where: { online: true, ultimoBatimentoEm: { lt: limite } },
    });
    return linhas.map(dispositivo);
  }
}

const queda = (linha: Prisma.QuedaDeDispositivoGetPayload<object>): QuedaDeDispositivo => ({
  id: linha.id,
  dispositivoId: linha.dispositivoId,
  desde: linha.desde,
  voltouEm: linha.voltouEm,
});

@Injectable()
export class RepositorioDeQuedasPrisma extends RepositorioDeQuedas {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async abrir(dispositivoId: string, desde: Date): Promise<QuedaDeDispositivo> {
    return queda(
      await this.contexto.cliente().quedaDeDispositivo.create({
        data: { tenantId: this.contexto.tenant().id, dispositivoId, desde },
      }),
    );
  }

  async fechar(dispositivoId: string, voltouEm: Date): Promise<QuedaDeDispositivo | null> {
    const cliente = this.contexto.cliente();
    const aberta = await cliente.quedaDeDispositivo.findFirst({
      where: { dispositivoId, voltouEm: null },
      orderBy: { desde: 'desc' },
    });
    if (!aberta) {
      return null;
    }
    return queda(
      await cliente.quedaDeDispositivo.update({ where: { id: aberta.id }, data: { voltouEm } }),
    );
  }

  async aberta(dispositivoId: string): Promise<QuedaDeDispositivo | null> {
    const linha = await this.contexto
      .cliente()
      .quedaDeDispositivo.findFirst({ where: { dispositivoId, voltouEm: null } });
    return linha ? queda(linha) : null;
  }

  async recentes(desde: Date, limite: number): Promise<QuedaDeDispositivo[]> {
    const linhas = await this.contexto.cliente().quedaDeDispositivo.findMany({
      where: { OR: [{ voltouEm: null }, { voltouEm: { gte: desde } }] },
      orderBy: [{ desde: 'desc' }, { id: 'asc' }],
      take: limite,
    });
    return linhas.map(queda);
  }

  async doDispositivo(dispositivoId: string, limite: number): Promise<QuedaDeDispositivo[]> {
    const linhas = await this.contexto.cliente().quedaDeDispositivo.findMany({
      where: { dispositivoId },
      orderBy: [{ desde: 'desc' }, { id: 'asc' }],
      take: limite,
    });
    return linhas.map(queda);
  }

  async excluirDoDispositivo(dispositivoId: string): Promise<void> {
    await this.contexto.cliente().quedaDeDispositivo.deleteMany({ where: { dispositivoId } });
  }
}

const comando = (linha: Prisma.ComandoDoAgenteGetPayload<object>): ComandoDoAgente => ({
  id: linha.id,
  agenteId: linha.agenteId,
  dispositivoId: linha.dispositivoId,
  tipo: linha.tipo as TipoDeComando,
  dados: linha.dados as Record<string, unknown>,
  status: linha.status as StatusDoComando,
  criadoEm: linha.criadoEm,
  expiraEm: linha.expiraEm,
  respondidoEm: linha.respondidoEm,
  resposta: linha.resposta as Record<string, unknown> | null,
});

@Injectable()
export class RepositorioDeComandosPrisma extends RepositorioDeComandos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(novo: NovoComando): Promise<ComandoDoAgente> {
    return comando(
      await this.contexto.cliente().comandoDoAgente.create({
        data: {
          tenantId: this.contexto.tenant().id,
          agenteId: novo.agenteId,
          dispositivoId: novo.dispositivoId,
          tipo: novo.tipo,
          dados: novo.dados as Prisma.InputJsonValue,
          expiraEm: novo.expiraEm,
        },
      }),
    );
  }

  async porId(id: string): Promise<ComandoDoAgente | null> {
    const linha = await this.contexto.cliente().comandoDoAgente.findFirst({ where: { id } });
    return linha ? comando(linha) : null;
  }

  async entregarPendentes(agenteId: string, agora: Date): Promise<ComandoDoAgente[]> {
    const cliente = this.contexto.cliente();
    const pendentes = await cliente.comandoDoAgente.findMany({
      where: { agenteId, status: 'pendente', expiraEm: { gt: agora } },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    if (pendentes.length > 0) {
      await cliente.comandoDoAgente.updateMany({
        where: { id: { in: pendentes.map((p) => p.id) } },
        data: { status: 'entregue', entregueEm: agora },
      });
    }
    return pendentes.map(comando);
  }

  async responder(
    id: string,
    agenteId: string,
    status: 'concluido' | 'falhou',
    resposta: Record<string, unknown> | null,
    agora: Date,
  ): Promise<ComandoDoAgente | null> {
    const cliente = this.contexto.cliente();
    // Só responde quem recebeu o comando, e uma vez: o UPDATE condicional é o ponto de decisão.
    const { count } = await cliente.comandoDoAgente.updateMany({
      where: { id, agenteId, status: { in: ['pendente', 'entregue'] }, expiraEm: { gt: agora } },
      data: {
        status,
        respondidoEm: agora,
        resposta: (resposta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return count === 1 ? this.porId(id) : null;
  }

  async expirar(agora: Date): Promise<number> {
    const { count } = await this.contexto.cliente().comandoDoAgente.updateMany({
      where: { status: { in: ['pendente', 'entregue'] }, expiraEm: { lte: agora } },
      data: { status: 'expirado' },
    });
    return count;
  }
}

const cadastro = (linha: Prisma.CadastroBiometricoGetPayload<object>): CadastroBiometrico => ({
  id: linha.id,
  alunoId: linha.alunoId,
  tipo: linha.tipo as TipoDeBiometria,
  dispositivoId: linha.dispositivoId,
  referencia: linha.referencia,
  status: linha.status as CadastroBiometrico['status'],
  comandoId: linha.comandoId,
  atualizadoEm: linha.atualizadoEm,
});

@Injectable()
export class RepositorioDeCadastrosBiometricosPrisma extends RepositorioDeCadastrosBiometricos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async salvar(dados: Omit<CadastroBiometrico, 'id'>): Promise<CadastroBiometrico> {
    const tenantId = this.contexto.tenant().id;
    return cadastro(
      await this.contexto.cliente().cadastroBiometrico.upsert({
        where: { tenantId_alunoId_tipo: { tenantId, alunoId: dados.alunoId, tipo: dados.tipo } },
        create: { tenantId, ...dados },
        update: dados,
      }),
    );
  }

  async porComando(comandoId: string): Promise<CadastroBiometrico | null> {
    const linha = await this.contexto
      .cliente()
      .cadastroBiometrico.findFirst({ where: { comandoId } });
    return linha ? cadastro(linha) : null;
  }

  async doAluno(alunoId: string): Promise<CadastroBiometrico[]> {
    const linhas = await this.contexto
      .cliente()
      .cadastroBiometrico.findMany({ where: { alunoId }, orderBy: { tipo: 'asc' } });
    return linhas.map(cadastro);
  }

  async atualizarStatus(
    id: string,
    status: CadastroBiometrico['status'],
    referencia: string | null,
    agora: Date,
  ): Promise<void> {
    await this.contexto.cliente().cadastroBiometrico.updateMany({
      where: { id },
      data: { status, referencia, atualizadoEm: agora },
    });
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .cadastroBiometrico.deleteMany({ where: { alunoId } });
    return count;
  }
}

const CHAVE_DAS_REGRAS = 'regras';

@Injectable()
export class RepositorioDoCacheDeAcessoPrisma extends RepositorioDoCacheDeAcesso {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async alterar(alunoId: string | null, agora: Date): Promise<void> {
    const chave = alunoId === null ? CHAVE_DAS_REGRAS : `aluno:${alunoId}`;
    // A versão vem da sequência da coluna: cada mudança fica acima de todas as anteriores.
    await this.contexto.cliente().$executeRaw`
      INSERT INTO alteracao_do_cache_de_acesso (tenant_id, chave, aluno_id, alterado_em)
      VALUES (${this.contexto.tenant().id}::uuid, ${chave}, ${alunoId}::uuid, ${agora})
      ON CONFLICT (tenant_id, chave) DO UPDATE SET
        versao = nextval(pg_get_serial_sequence('alteracao_do_cache_de_acesso', 'versao')),
        alterado_em = EXCLUDED.alterado_em`;
  }

  async semear(alunoIds: readonly string[], agora: Date): Promise<void> {
    if (alunoIds.length === 0) {
      return;
    }
    // Quem nunca mudou entra na primeira carga completa (DO NOTHING mantém a versão de quem já tem).
    await this.contexto.cliente().$executeRaw`
      INSERT INTO alteracao_do_cache_de_acesso (tenant_id, chave, aluno_id, alterado_em)
      SELECT ${this.contexto.tenant().id}::uuid, 'aluno:' || id, id::uuid, ${agora}
      FROM unnest(${[...alunoIds]}::text[]) AS id
      ON CONFLICT (tenant_id, chave) DO NOTHING`;
  }

  async versaoAtual(): Promise<number> {
    const { _max } = await this.contexto
      .cliente()
      .alteracaoDoCacheDeAcesso.aggregate({ _max: { versao: true } });
    return Number(_max.versao ?? 0);
  }

  async desde(desde: number, limite: number): Promise<AlteracaoDoCache[]> {
    const linhas = await this.contexto.cliente().alteracaoDoCacheDeAcesso.findMany({
      where: { versao: { gt: BigInt(desde) } },
      orderBy: { versao: 'asc' },
      take: limite,
    });
    return linhas.map((linha) => ({
      chave: linha.chave,
      alunoId: linha.alunoId,
      versao: Number(linha.versao),
    }));
  }
}
