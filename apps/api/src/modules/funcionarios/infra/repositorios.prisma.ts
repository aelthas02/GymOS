import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type ContadoresDaEquipe,
  type FiltroDeFuncionarios,
  type Funcionario,
  type PaginaDeFuncionarios,
  RepositorioDeFuncionarios,
} from '../application/portas';
import { CARGOS, type DadosDoFuncionario, FILTROS_DA_EQUIPE } from '../domain/funcionario';

// Repositório dos funcionários: usa o cliente da transação do tenant (RLS).

const ordemPorNome = [
  { nome: 'asc' },
  { id: 'asc' },
] as const satisfies Prisma.FuncionarioOrderByWithRelationInput[];

/** Cargos (chaves do banco) de cada chip da tela Equipe. */
const cargosDoFiltro = (filtro: string): string[] =>
  CARGOS.filter((cargo) => cargo.filtro === filtro).map((cargo) => cargo.chave);

@Injectable()
export class RepositorioDeFuncionariosPrisma extends RepositorioDeFuncionarios {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async listar(filtro: FiltroDeFuncionarios): Promise<PaginaDeFuncionarios> {
    const cliente = this.contexto.cliente();
    const daBusca: Prisma.FuncionarioWhereInput = filtro.busca
      ? { nome: { contains: filtro.busca, mode: 'insensitive' } }
      : {};
    const where: Prisma.FuncionarioWhereInput = filtro.cargo
      ? { ...daBusca, cargo: { in: cargosDoFiltro(filtro.cargo) } }
      : daBusca;
    const [itens, total, todos, porCargo] = await Promise.all([
      cliente.funcionario.findMany({
        where,
        orderBy: ordemPorNome,
        skip: (filtro.pagina - 1) * filtro.limite,
        take: filtro.limite,
      }),
      cliente.funcionario.count({ where }),
      cliente.funcionario.count({ where: daBusca }),
      cliente.funcionario.groupBy({ by: ['cargo'], where: daBusca, _count: { _all: true } }),
    ]);
    const contagem = new Map(porCargo.map((linha) => [linha.cargo, linha._count._all]));
    const contadores = { todos } as ContadoresDaEquipe;
    for (const chip of FILTROS_DA_EQUIPE) {
      contadores[chip] = cargosDoFiltro(chip).reduce(
        (soma, cargo) => soma + (contagem.get(cargo) ?? 0),
        0,
      );
    }
    return { itens, total, contadores };
  }

  porId(id: string): Promise<Funcionario | null> {
    return this.contexto.cliente().funcionario.findFirst({ where: { id } });
  }

  porEmail(email: string): Promise<Funcionario | null> {
    return this.contexto.cliente().funcionario.findFirst({ where: { email } });
  }

  criar(dados: DadosDoFuncionario & { usuarioId: string | null }): Promise<Funcionario> {
    return this.contexto.cliente().funcionario.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
    });
  }

  async atualizar(
    id: string,
    dados: Partial<DadosDoFuncionario> & { usuarioId?: string | null; ativo?: boolean },
  ): Promise<Funcionario> {
    const { count } = await this.contexto.cliente().funcionario.updateMany({
      where: { id },
      data: dados,
    });
    const atualizado = count === 1 ? await this.porId(id) : null;
    if (!atualizado) {
      throw new Error(`Funcionário ${id} não encontrado para atualizar.`);
    }
    return atualizado;
  }

  async excluir(id: string): Promise<void> {
    await this.contexto.cliente().funcionario.deleteMany({ where: { id } });
  }

  ativosPorCargo(cargos: readonly string[]): Promise<Funcionario[]> {
    return this.contexto.cliente().funcionario.findMany({
      where: { ativo: true, ...(cargos.length > 0 ? { cargo: { in: [...cargos] } } : {}) },
      orderBy: ordemPorNome,
    });
  }
}
