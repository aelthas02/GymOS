import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import {
  type AtividadeGuardada,
  type AutorEncontrado,
  type FiltroDeAtividades,
  RepositorioDeAtividades,
} from '../../application/auditoria';
import type { AtividadeResolvida, ChaveDaAcao, PosicaoNaLista } from '../../domain/atividade';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

/** Grava e lê no cliente da transação do contexto; a política de RLS isola o tenant. */
@Injectable()
export class RepositorioDeAtividadesPrisma extends RepositorioDeAtividades {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async inserir(atividade: AtividadeResolvida & { ocorridoEm: Date }): Promise<void> {
    await this.contexto.cliente().atividade.create({
      data: {
        tenantId: this.contexto.tenant().id,
        ocorridoEm: atividade.ocorridoEm,
        quemId: atividade.quem.id,
        quem: atividade.quem.nome,
        papel: atividade.papel,
        acao: atividade.acao,
        modulo: atividade.modulo,
        detalhe: atividade.detalhe,
        sensivel: atividade.sensivel,
      },
    });
  }

  async listar(
    filtro: FiltroDeAtividades,
    depoisDe: PosicaoNaLista | null,
    limite: number,
  ): Promise<AtividadeGuardada[]> {
    const emDestaque = filtro.tipo === 'destaque';
    const linhas = await this.contexto.cliente().atividade.findMany({
      where: { AND: [this.filtrar(filtro), depoisDe ? this.depoisDe(depoisDe, emDestaque) : {}] },
      orderBy: [
        ...(emDestaque ? [{ sensivel: 'desc' as const }] : []),
        { ocorridoEm: 'desc' },
        { ordem: 'desc' },
      ],
      take: limite,
    });
    return linhas.map((linha) => ({
      id: linha.id,
      ocorridoEm: linha.ocorridoEm,
      ordem: linha.ordem,
      quem: { id: linha.quemId, nome: linha.quem },
      papel: linha.papel,
      acao: linha.acao as ChaveDaAcao,
      modulo: linha.modulo,
      detalhe: linha.detalhe,
      sensivel: linha.sensivel,
    }));
  }

  async removerAnterioresA(limite: Date): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .atividade.deleteMany({ where: { ocorridoEm: { lt: limite } } });
    return count;
  }

  /** Lê o usuário e o tipo de acesso (tabelas da autenticação) só para nomear o autor. */
  async autorDoUsuario(usuarioId: string): Promise<AutorEncontrado | null> {
    const usuario = await this.contexto.cliente().usuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true, tipoDeAcesso: { select: { nome: true } } },
    });
    return usuario ? { nome: usuario.nome, papel: usuario.tipoDeAcesso.nome } : null;
  }

  private filtrar(filtro: FiltroDeAtividades): Prisma.AtividadeWhereInput {
    return {
      ...(filtro.usuarioId ? { quemId: filtro.usuarioId } : {}),
      ...(filtro.modulo ? { modulo: filtro.modulo } : {}),
      ...(filtro.tipo === 'sensiveis' ? { sensivel: true } : {}),
      ...(filtro.de || filtro.ate
        ? {
            ocorridoEm: {
              ...(filtro.de ? { gte: filtro.de } : {}),
              ...(filtro.ate ? { lt: filtro.ate } : {}),
            },
          }
        : {}),
    };
  }

  /** Tudo o que vem depois da posição na ordem da listagem (sensível, instante e `ordem`). */
  private depoisDe(posicao: PosicaoNaLista, emDestaque: boolean): Prisma.AtividadeWhereInput {
    const mesmoGrupo: Prisma.AtividadeWhereInput = {
      OR: [
        { ocorridoEm: { lt: posicao.ocorridoEm } },
        { ocorridoEm: posicao.ocorridoEm, ordem: { lt: posicao.ordem } },
      ],
    };
    if (!emDestaque) {
      return mesmoGrupo;
    }
    return {
      OR: [
        ...(posicao.sensivel ? [{ sensivel: false }] : []),
        { sensivel: posicao.sensivel, ...mesmoGrupo },
      ],
    };
  }
}
