import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type Aviso,
  type AvisoAgendado,
  type DadosDaInscricao,
  type EstadoDoAgendamento,
  type InscricaoDePush,
  type NovoAgendamento,
  type NovoAvisoGravado,
  type PaginaDeAvisos,
  type PreferenciaDeAviso,
  RepositorioDeAgendamentos,
  RepositorioDeAvisos,
  RepositorioDeInscricoes,
  RepositorioDePreferencias,
} from '../application/portas';
import {
  type Destinatario,
  type TipoDeAviso,
  type TipoDeDestinatario,
  codificarCursor,
  decodificarCursor,
} from '../domain/aviso';

// Repositórios do domínio avisos: usam o cliente da transação do tenant (RLS).

type LinhaDeAviso = Prisma.AvisoGetPayload<object>;

const aviso = (linha: LinhaDeAviso): Aviso => ({
  ...linha,
  destinatarioTipo: linha.destinatarioTipo as TipoDeDestinatario,
  tipo: linha.tipo as TipoDeAviso,
});

const doDestinatario = (destinatario: Destinatario) => ({
  destinatarioTipo: destinatario.tipo,
  destinatarioId: destinatario.id,
});

@Injectable()
export class RepositorioDeAvisosPrisma extends RepositorioDeAvisos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(avisos: readonly NovoAvisoGravado[]): Promise<Aviso[]> {
    const tenantId = this.contexto.tenant().id;
    const linhas = await this.contexto.cliente().aviso.createManyAndReturn({
      data: avisos.map(({ destinatario, ...dados }) => ({
        tenantId,
        ...doDestinatario(destinatario),
        ...dados,
      })),
    });
    return linhas.map(aviso);
  }

  async listar(
    destinatario: Destinatario,
    consulta: { naoLidos: boolean; limite: number; cursor?: string },
  ): Promise<PaginaDeAvisos> {
    const posicao = consulta.cursor ? decodificarCursor(consulta.cursor) : null;
    const where: Prisma.AvisoWhereInput = {
      ...doDestinatario(destinatario),
      ...(consulta.naoLidos ? { lidoEm: null } : {}),
      ...(posicao
        ? {
            OR: [
              { criadoEm: { lt: posicao.criadoEm } },
              { criadoEm: posicao.criadoEm, id: { lt: posicao.id } },
            ],
          }
        : {}),
    };
    const linhas = await this.contexto.cliente().aviso.findMany({
      where,
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      take: consulta.limite + 1,
    });
    const itens = linhas.slice(0, consulta.limite).map(aviso);
    const ultimo = itens.at(-1);
    return {
      itens,
      proximoCursor: linhas.length > consulta.limite && ultimo ? codificarCursor(ultimo) : null,
    };
  }

  contarNaoLidos(destinatario: Destinatario): Promise<number> {
    return this.contexto
      .cliente()
      .aviso.count({ where: { ...doDestinatario(destinatario), lidoEm: null } });
  }

  async marcarComoLido(destinatario: Destinatario, id: string, quando: Date): Promise<boolean> {
    const cliente = this.contexto.cliente();
    const dele = { id, ...doDestinatario(destinatario) };
    await cliente.aviso.updateMany({ where: { ...dele, lidoEm: null }, data: { lidoEm: quando } });
    return (await cliente.aviso.count({ where: dele })) > 0;
  }

  async marcarTodosComoLidos(destinatario: Destinatario, quando: Date): Promise<number> {
    const { count } = await this.contexto.cliente().aviso.updateMany({
      where: { ...doDestinatario(destinatario), lidoEm: null },
      data: { lidoEm: quando },
    });
    return count;
  }

  async porIds(ids: readonly string[]): Promise<Aviso[]> {
    const linhas = await this.contexto.cliente().aviso.findMany({
      where: { id: { in: [...ids] } },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(aviso);
  }

  async doDestinatario(destinatario: Destinatario): Promise<Aviso[]> {
    const linhas = await this.contexto.cliente().aviso.findMany({
      where: doDestinatario(destinatario),
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
    });
    return linhas.map(aviso);
  }
}

@Injectable()
export class RepositorioDeInscricoesPrisma extends RepositorioDeInscricoes {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async salvar(destinatario: Destinatario, dados: DadosDaInscricao): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    const campos = {
      ...doDestinatario(destinatario),
      p256dh: dados.p256dh,
      auth: dados.auth,
      dispositivo: dados.dispositivo ?? null,
    };
    await this.contexto.cliente().inscricaoDePush.upsert({
      where: { tenantId_endpoint: { tenantId, endpoint: dados.endpoint } },
      create: { tenantId, endpoint: dados.endpoint, ...campos },
      update: campos,
    });
  }

  async remover(destinatario: Destinatario, endpoint: string): Promise<boolean> {
    const { count } = await this.contexto
      .cliente()
      .inscricaoDePush.deleteMany({ where: { endpoint, ...doDestinatario(destinatario) } });
    return count > 0;
  }

  async removerPorId(id: string): Promise<void> {
    await this.contexto.cliente().inscricaoDePush.deleteMany({ where: { id } });
  }

  async dosDestinatarios(
    tipo: TipoDeDestinatario,
    ids: readonly string[],
  ): Promise<InscricaoDePush[]> {
    const linhas = await this.contexto.cliente().inscricaoDePush.findMany({
      where: { destinatarioTipo: tipo, destinatarioId: { in: [...ids] } },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map((linha) => ({ ...linha, destinatarioTipo: tipo }));
  }
}

@Injectable()
export class RepositorioDePreferenciasPrisma extends RepositorioDePreferencias {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async doDestinatario(destinatario: Destinatario): Promise<PreferenciaDeAviso[]> {
    const linhas = await this.contexto
      .cliente()
      .preferenciaDeAviso.findMany({ where: doDestinatario(destinatario) });
    return linhas.map((linha) => ({ tipo: linha.tipo as TipoDeAviso, push: linha.push }));
  }

  async salvar(destinatario: Destinatario, preferencia: PreferenciaDeAviso): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    await this.contexto.cliente().preferenciaDeAviso.upsert({
      where: {
        tenantId_destinatarioTipo_destinatarioId_tipo: {
          tenantId,
          destinatarioTipo: destinatario.tipo,
          destinatarioId: destinatario.id,
          tipo: preferencia.tipo,
        },
      },
      create: { tenantId, ...doDestinatario(destinatario), ...preferencia },
      update: { push: preferencia.push },
    });
  }

  async comPushDesligado(
    tipoDestinatario: TipoDeDestinatario,
    ids: readonly string[],
    tipo: TipoDeAviso,
  ): Promise<Set<string>> {
    const linhas = await this.contexto.cliente().preferenciaDeAviso.findMany({
      where: {
        destinatarioTipo: tipoDestinatario,
        destinatarioId: { in: [...ids] },
        tipo,
        push: false,
      },
      select: { destinatarioId: true },
    });
    return new Set(linhas.map((linha) => linha.destinatarioId));
  }
}

@Injectable()
export class RepositorioDeAgendamentosPrisma extends RepositorioDeAgendamentos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(dados: NovoAgendamento): Promise<AvisoAgendado> {
    const { destinatario, ...resto } = dados;
    const linha = await this.contexto.cliente().avisoAgendado.create({
      data: { tenantId: this.contexto.tenant().id, ...doDestinatario(destinatario), ...resto },
    });
    return agendamento(linha);
  }

  async porId(id: string): Promise<AvisoAgendado | null> {
    const linha = await this.contexto.cliente().avisoAgendado.findFirst({ where: { id } });
    return linha ? agendamento(linha) : null;
  }

  async cancelar(id: string): Promise<boolean> {
    const { count } = await this.contexto.cliente().avisoAgendado.updateMany({
      where: { id, estado: 'pendente' },
      data: { estado: 'cancelado' },
    });
    return count > 0;
  }

  async cancelarPorChave(chave: string): Promise<number> {
    const { count } = await this.contexto.cliente().avisoAgendado.updateMany({
      where: { chave, estado: 'pendente' },
      data: { estado: 'cancelado' },
    });
    return count;
  }

  async marcarComoEnviado(id: string): Promise<boolean> {
    const { count } = await this.contexto
      .cliente()
      .avisoAgendado.updateMany({ where: { id, estado: 'pendente' }, data: { estado: 'enviado' } });
    return count > 0;
  }
}

function agendamento(linha: Prisma.AvisoAgendadoGetPayload<object>): AvisoAgendado {
  return {
    id: linha.id,
    chave: linha.chave,
    destinatario: { tipo: linha.destinatarioTipo as TipoDeDestinatario, id: linha.destinatarioId },
    tipo: linha.tipo as TipoDeAviso,
    titulo: linha.titulo,
    texto: linha.texto,
    link: linha.link,
    push: linha.push,
    quando: linha.quando,
    estado: linha.estado as EstadoDoAgendamento,
  };
}
