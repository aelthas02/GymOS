import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { daColunaDeData, paraColunaDeData } from '../../alunos/domain/datas';
import {
  CifraDeCampos,
  definirCamposProtegidos,
} from '../../platform/application/protecao-de-dados';
import type { DataCivil } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type CamposDeAtualizacaoDaFicha,
  type DadosDoExercicio,
  type DadosDoModelo,
  type ExecucaoDeTreino,
  type Exercicio,
  type Ficha,
  type FichaResumida,
  type Modelo,
  type NovaExecucao,
  type NovaFicha,
  type PaginaDeFichas,
  RepositorioDeExecucoes,
  RepositorioDeExercicios,
  RepositorioDeFichas,
  RepositorioDeModelos,
} from '../application/portas';
import type {
  Divisao,
  Nivel,
  OrigemDaFicha,
  SituacaoGuardada,
  TreinoDaFicha,
} from '../domain/ficha';

// Repositórios do domínio treinos: usam o cliente da transação do tenant (RLS). As restrições da
// ficha são dado de saúde (T13c): cifradas, e cada leitura vai para o log de acesso.

export const CAMPOS_DA_FICHA = definirCamposProtegidos('ficha_de_treino', {
  restricoes: { sensivel: true },
});

const ordemPorNome: Prisma.ExercicioDeTreinoOrderByWithRelationInput[] = [
  { nome: 'asc' },
  { id: 'asc' },
];

const comoTreinos = (valor: Prisma.JsonValue): TreinoDaFicha[] =>
  valor as unknown as TreinoDaFicha[];
const comoJson = (treinos: TreinoDaFicha[]): Prisma.InputJsonValue =>
  treinos as unknown as Prisma.InputJsonValue;

@Injectable()
export class RepositorioDeExerciciosPrisma extends RepositorioDeExercicios {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  listar(grupoMuscular?: string): Promise<Exercicio[]> {
    return this.contexto.cliente().exercicioDeTreino.findMany({
      where: grupoMuscular ? { grupoMuscular } : {},
      orderBy: ordemPorNome,
    });
  }

  porId(id: string): Promise<Exercicio | null> {
    return this.contexto.cliente().exercicioDeTreino.findFirst({ where: { id } });
  }

  porNome(nome: string): Promise<Exercicio | null> {
    return this.contexto.cliente().exercicioDeTreino.findFirst({ where: { nome } });
  }

  criar(dados: DadosDoExercicio): Promise<Exercicio> {
    return this.contexto
      .cliente()
      .exercicioDeTreino.create({ data: { ...dados, tenantId: this.contexto.tenant().id } });
  }

  async atualizar(id: string, dados: DadosDoExercicio): Promise<Exercicio> {
    await this.contexto.cliente().exercicioDeTreino.updateMany({ where: { id }, data: dados });
    const atualizado = await this.porId(id);
    if (!atualizado) {
      throw new Error(`Exercício ${id} não encontrado para atualizar.`);
    }
    return atualizado;
  }
}

interface LinhaDoModelo {
  id: string;
  nome: string;
  divisao: string;
  diasPorSemana: number;
  treinos: Prisma.JsonValue;
}

const modelo = (linha: LinhaDoModelo): Modelo => ({
  id: linha.id,
  nome: linha.nome,
  divisao: linha.divisao as Divisao,
  diasPorSemana: linha.diasPorSemana,
  treinos: comoTreinos(linha.treinos),
});

@Injectable()
export class RepositorioDeModelosPrisma extends RepositorioDeModelos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async listar(): Promise<Modelo[]> {
    const linhas = await this.contexto
      .cliente()
      .modeloDeTreino.findMany({ orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
    return linhas.map(modelo);
  }

  async porId(id: string): Promise<Modelo | null> {
    const linha = await this.contexto.cliente().modeloDeTreino.findFirst({ where: { id } });
    return linha ? modelo(linha) : null;
  }

  async porNome(nome: string): Promise<Modelo | null> {
    const linha = await this.contexto.cliente().modeloDeTreino.findFirst({ where: { nome } });
    return linha ? modelo(linha) : null;
  }

  async criar(dados: DadosDoModelo): Promise<Modelo> {
    const linha = await this.contexto.cliente().modeloDeTreino.create({
      data: { ...dados, treinos: comoJson(dados.treinos), tenantId: this.contexto.tenant().id },
    });
    return modelo(linha);
  }

  async atualizar(id: string, dados: DadosDoModelo): Promise<Modelo> {
    await this.contexto.cliente().modeloDeTreino.updateMany({
      where: { id },
      data: { ...dados, treinos: comoJson(dados.treinos) },
    });
    const atualizado = await this.porId(id);
    if (!atualizado) {
      throw new Error(`Modelo ${id} não encontrado para atualizar.`);
    }
    return atualizado;
  }
}

interface LinhaDaFicha {
  id: string;
  alunoId: string;
  professorId: string | null;
  nome: string;
  objetivo: string;
  nivel: string;
  frequenciaSemanal: number;
  divisao: string;
  validaAte: Date | null;
  situacao: string;
  origem: string;
  treinos: Prisma.JsonValue;
  aprovadaPorId: string | null;
  aprovadaEm: Date | null;
  atualizadaEm: Date;
}

const resumida = (linha: LinhaDaFicha): FichaResumida => ({
  id: linha.id,
  alunoId: linha.alunoId,
  professorId: linha.professorId,
  nome: linha.nome,
  objetivo: linha.objetivo,
  nivel: linha.nivel as Nivel,
  frequenciaSemanal: linha.frequenciaSemanal,
  divisao: linha.divisao as Divisao,
  validaAte: linha.validaAte ? daColunaDeData(linha.validaAte) : null,
  situacao: linha.situacao as SituacaoGuardada,
  origem: linha.origem as OrigemDaFicha,
  treinos: comoTreinos(linha.treinos),
  aprovadaPorId: linha.aprovadaPorId,
  aprovadaEm: linha.aprovadaEm,
  atualizadaEm: linha.atualizadaEm,
});

const EM_ANDAMENTO = ['rascunho', 'aguardando_aprovacao'];

@Injectable()
export class RepositorioDeFichasPrisma extends RepositorioDeFichas {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  private async revelada(
    linha: LinhaDaFicha & { restricoes: string | null },
    quem: string,
  ): Promise<Ficha> {
    const revelada = await this.cifra.revelar(CAMPOS_DA_FICHA, linha, {
      titularId: linha.alunoId,
      quem,
    });
    return { ...resumida(linha), restricoes: revelada.restricoes };
  }

  async porId(id: string, quem: string): Promise<Ficha | null> {
    const linha = await this.contexto.cliente().fichaDeTreino.findFirst({ where: { id } });
    return linha ? this.revelada(linha, quem) : null;
  }

  async resumoPorId(id: string): Promise<FichaResumida | null> {
    const linha = await this.contexto.cliente().fichaDeTreino.findFirst({ where: { id } });
    return linha ? resumida(linha) : null;
  }

  async atualDoAluno(alunoId: string, quem: string): Promise<Ficha | null> {
    const cliente = this.contexto.cliente();
    const linha =
      (await cliente.fichaDeTreino.findFirst({
        where: { alunoId, situacao: { in: EM_ANDAMENTO } },
        orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
      })) ??
      (await cliente.fichaDeTreino.findFirst({
        where: { alunoId, situacao: 'ativa' },
        orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
      }));
    return linha ? this.revelada(linha, quem) : null;
  }

  async ativaDoAluno(alunoId: string, hoje: DataCivil): Promise<FichaResumida | null> {
    const linha = await this.contexto.cliente().fichaDeTreino.findFirst({
      where: {
        alunoId,
        situacao: 'ativa',
        OR: [{ validaAte: null }, { validaAte: { gte: paraColunaDeData(hoje) } }],
      },
      orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
    });
    return linha ? resumida(linha) : null;
  }

  async listar(pagina: number, limite: number): Promise<PaginaDeFichas> {
    const cliente = this.contexto.cliente();
    const where: Prisma.FichaDeTreinoWhereInput = {
      situacao: { in: [...EM_ANDAMENTO, 'ativa'] },
    };
    const [linhas, total] = await Promise.all([
      cliente.fichaDeTreino.findMany({
        where,
        orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      cliente.fichaDeTreino.count({ where }),
    ]);
    return { itens: linhas.map(resumida), total };
  }

  async aguardandoAprovacao(): Promise<FichaResumida[]> {
    const linhas = await this.contexto.cliente().fichaDeTreino.findMany({
      where: { situacao: 'aguardando_aprovacao' },
      orderBy: [{ atualizadaEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(resumida);
  }

  async ativasComValidadeAte(ate: DataCivil): Promise<FichaResumida[]> {
    const linhas = await this.contexto.cliente().fichaDeTreino.findMany({
      where: { situacao: 'ativa', validaAte: { lte: paraColunaDeData(ate) } },
      orderBy: [{ validaAte: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(resumida);
  }

  contarAtivas(hoje: DataCivil): Promise<number> {
    return this.contexto.cliente().fichaDeTreino.count({
      where: {
        situacao: 'ativa',
        OR: [{ validaAte: null }, { validaAte: { gte: paraColunaDeData(hoje) } }],
      },
    });
  }

  async alunosComFicha(): Promise<string[]> {
    const linhas = await this.contexto.cliente().fichaDeTreino.findMany({
      where: { situacao: { in: [...EM_ANDAMENTO, 'ativa'] } },
      distinct: ['alunoId'],
      select: { alunoId: true },
    });
    return linhas.map((linha) => linha.alunoId);
  }

  async criar(dados: NovaFicha): Promise<Ficha> {
    const { restricoes, treinos, validaAte, ...resto } = dados;
    const protegidos = await this.cifra.proteger(CAMPOS_DA_FICHA, { restricoes });
    const linha = await this.contexto.cliente().fichaDeTreino.create({
      data: {
        ...resto,
        ...protegidos,
        treinos: comoJson(treinos),
        validaAte: validaAte ? paraColunaDeData(validaAte) : null,
        tenantId: this.contexto.tenant().id,
      },
    });
    return { ...resumida(linha), restricoes };
  }

  async atualizar(id: string, campos: CamposDeAtualizacaoDaFicha): Promise<Ficha> {
    const { restricoes, treinos, validaAte, ...resto } = campos;
    const data: Prisma.FichaDeTreinoUncheckedUpdateManyInput = { ...resto };
    if (restricoes !== undefined) {
      Object.assign(data, await this.cifra.proteger(CAMPOS_DA_FICHA, { restricoes }));
    }
    if (treinos !== undefined) {
      data.treinos = comoJson(treinos);
    }
    if (validaAte !== undefined) {
      data.validaAte = validaAte ? paraColunaDeData(validaAte) : null;
    }
    await this.contexto.cliente().fichaDeTreino.updateMany({ where: { id }, data });
    const atualizada = await this.porId(id, 'sistema:treinos.atualizar');
    if (!atualizada) {
      throw new Error(`Ficha ${id} não encontrada para atualizar.`);
    }
    return atualizada;
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .fichaDeTreino.deleteMany({ where: { alunoId } });
    return count;
  }

  async doAluno(alunoId: string, quem: string): Promise<Ficha[]> {
    const linhas = await this.contexto.cliente().fichaDeTreino.findMany({
      where: { alunoId },
      orderBy: [{ atualizadaEm: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(linhas.map((linha) => this.revelada(linha, quem)));
  }
}

const execucao = (linha: {
  id: string;
  alunoId: string;
  fichaId: string | null;
  exercicio: string;
  cargaKg: number | null;
  esforco: number;
  realizadoEm: Date;
}): ExecucaoDeTreino => ({ ...linha });

@Injectable()
export class RepositorioDeExecucoesPrisma extends RepositorioDeExecucoes {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async registrar(dados: NovaExecucao): Promise<ExecucaoDeTreino> {
    const linha = await this.contexto
      .cliente()
      .execucaoDeTreino.create({ data: { ...dados, tenantId: this.contexto.tenant().id } });
    return execucao(linha);
  }

  async doAluno(alunoId: string): Promise<ExecucaoDeTreino[]> {
    const linhas = await this.contexto.cliente().execucaoDeTreino.findMany({
      where: { alunoId },
      orderBy: [{ realizadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map(execucao);
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto
      .cliente()
      .execucaoDeTreino.deleteMany({ where: { alunoId } });
    return count;
  }
}
