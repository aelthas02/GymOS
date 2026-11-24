import { Injectable } from '@nestjs/common';
import { somenteDigitos, validarCpf } from '@gymos/shared-validation';
import type { Prisma } from '../../../generated/prisma/client';
import {
  CifraDeCampos,
  definirCamposProtegidos,
} from '../../platform/application/protecao-de-dados';
import type { DataCivil } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type Aluno,
  type ContatoDoAlunoParaMensagem,
  type CamposDoContrato,
  type Contrato,
  type DadosPessoaisDoAluno,
  type FiltroDeAlunos,
  type PaginaDeAlunos,
  type PlanoComAlunos,
  RepositorioDeAlunos,
  RepositorioDeConfiguracao,
  RepositorioDeContratos,
  RepositorioDePlanos,
} from '../application/portas';
import {
  CONFIGURACAO_PADRAO,
  type ConfiguracaoDeContrato,
  type EstadoDoContrato,
  JANELA_A_VENCER_DIAS,
  type MotivoDoEncerramento,
} from '../domain/contrato';
import { daColunaDeData, paraColunaDeData, somarDias } from '../domain/datas';
import type { DadosDoPlano, FormaDeCobranca, Plano } from '../domain/plano';

// Repositórios do domínio alunos: todos usam o cliente da transação do tenant (RLS). CPF, telefone e
// e-mail do aluno são cifrados com índice cego; restrições são dado de saúde (T13c).

export const CAMPOS_DO_ALUNO = definirCamposProtegidos('aluno', {
  cpf: { indice: 'cpf' },
  telefone: { indice: 'telefone' },
  email: { indice: 'email' },
  restricoes: { sensivel: true },
});

const dataOuNulo = (data: Date | null): DataCivil | null => (data ? daColunaDeData(data) : null);
const colunaOuNulo = (dia: DataCivil | null | undefined): Date | null | undefined =>
  dia === undefined ? undefined : dia === null ? null : paraColunaDeData(dia);

interface LinhaDoPlano {
  id: string;
  nome: string;
  valorTotalCentavos: number;
  duracaoMeses: number;
  parcelas: number;
  formaDeCobranca: string;
  modalidades: string[];
  acessosPorSemana: number | null;
  renovacaoAutomatica: boolean;
  ativo: boolean;
}

function planoDaLinha(linha: LinhaDoPlano): Plano {
  return {
    id: linha.id,
    nome: linha.nome,
    valorTotalCentavos: linha.valorTotalCentavos,
    duracaoMeses: linha.duracaoMeses,
    parcelas: linha.parcelas,
    formaDeCobranca: linha.formaDeCobranca as FormaDeCobranca,
    modalidades: linha.modalidades,
    acessosPorSemana: linha.acessosPorSemana,
    renovacaoAutomatica: linha.renovacaoAutomatica,
    ativo: linha.ativo,
  };
}

/** Contrato vigente que ainda conta como aluno ativo do plano. */
const vigenteAtivo = { vigente: true, estado: { not: 'encerrado' } } as const;

@Injectable()
export class RepositorioDePlanosPrisma extends RepositorioDePlanos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async listar(busca?: string): Promise<PlanoComAlunos[]> {
    const linhas = await this.contexto.cliente().plano.findMany({
      where: {
        excluidoEm: null,
        ...(busca?.trim() ? { nome: { contains: busca.trim(), mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { contratos: { where: vigenteAtivo } } } },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    return linhas.map((linha) => ({
      ...planoDaLinha(linha),
      alunosAtivos: linha._count.contratos,
    }));
  }

  async porId(id: string): Promise<Plano | null> {
    const linha = await this.contexto
      .cliente()
      .plano.findFirst({ where: { id, excluidoEm: null } });
    return linha && planoDaLinha(linha);
  }

  async porNome(nome: string): Promise<Plano | null> {
    const linha = await this.contexto.cliente().plano.findFirst({
      where: { nome: { equals: nome.trim(), mode: 'insensitive' }, excluidoEm: null },
      orderBy: { criadoEm: 'asc' },
    });
    return linha && planoDaLinha(linha);
  }

  async criar(dados: DadosDoPlano): Promise<Plano> {
    const linha = await this.contexto.cliente().plano.create({
      data: { ...dados, modalidades: [...dados.modalidades], tenantId: this.contexto.tenant().id },
    });
    return planoDaLinha(linha);
  }

  async atualizar(id: string, dados: DadosDoPlano): Promise<Plano> {
    const linha = await this.contexto.cliente().plano.update({
      where: { id },
      data: { ...dados, modalidades: [...dados.modalidades] },
    });
    return planoDaLinha(linha);
  }

  async excluir(id: string, quando: Date): Promise<void> {
    await this.contexto.cliente().plano.update({ where: { id }, data: { excluidoEm: quando } });
  }

  alunosAtivos(id: string): Promise<number> {
    return this.contexto.cliente().contrato.count({ where: { ...vigenteAtivo, planoId: id } });
  }
}

interface LinhaDoContrato {
  id: string;
  alunoId: string;
  planoId: string;
  vigente: boolean;
  estado: string;
  inicio: Date;
  fim: Date;
  valorTotalCentavos: number;
  parcelas: number;
  vencimentoEmAtraso: Date | null;
  proximoVencimento: Date | null;
  encerradoEm: Date | null;
  motivoDoEncerramento: string | null;
  trancadoDesde: Date | null;
  trancadoAte: Date | null;
  plano: { nome: string };
}

function contratoDaLinha(linha: LinhaDoContrato): Contrato {
  return {
    id: linha.id,
    alunoId: linha.alunoId,
    planoId: linha.planoId,
    planoNome: linha.plano.nome,
    vigente: linha.vigente,
    estado: linha.estado as EstadoDoContrato,
    inicio: daColunaDeData(linha.inicio),
    fim: daColunaDeData(linha.fim),
    valorTotalCentavos: linha.valorTotalCentavos,
    parcelas: linha.parcelas,
    vencimentoEmAtraso: dataOuNulo(linha.vencimentoEmAtraso),
    proximoVencimento: dataOuNulo(linha.proximoVencimento),
    encerradoEm: dataOuNulo(linha.encerradoEm),
    motivoDoEncerramento: linha.motivoDoEncerramento as MotivoDoEncerramento | null,
    trancadoDesde: dataOuNulo(linha.trancadoDesde),
    trancadoAte: dataOuNulo(linha.trancadoAte),
  };
}

const comPlano = { plano: { select: { nome: true } } } as const;

function colunasDoContrato(campos: CamposDoContrato): Prisma.ContratoUncheckedUpdateInput {
  return {
    vigente: campos.vigente,
    estado: campos.estado,
    inicio: colunaOuNulo(campos.inicio) ?? undefined,
    fim: colunaOuNulo(campos.fim) ?? undefined,
    valorTotalCentavos: campos.valorTotalCentavos,
    vencimentoEmAtraso: colunaOuNulo(campos.vencimentoEmAtraso),
    proximoVencimento: colunaOuNulo(campos.proximoVencimento),
    encerradoEm: colunaOuNulo(campos.encerradoEm),
    motivoDoEncerramento: campos.motivoDoEncerramento,
    trancadoDesde: colunaOuNulo(campos.trancadoDesde),
    trancadoAte: colunaOuNulo(campos.trancadoAte),
  };
}

@Injectable()
export class RepositorioDeContratosPrisma extends RepositorioDeContratos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async vigenteDoAluno(alunoId: string): Promise<Contrato | null> {
    const linha = await this.contexto.cliente().contrato.findFirst({
      where: { alunoId, vigente: true },
      include: comPlano,
      orderBy: { criadoEm: 'desc' },
    });
    return linha && contratoDaLinha(linha);
  }

  async doAluno(alunoId: string): Promise<Contrato[]> {
    const linhas = await this.contexto.cliente().contrato.findMany({
      where: { alunoId },
      include: comPlano,
      orderBy: { criadoEm: 'asc' },
    });
    return linhas.map(contratoDaLinha);
  }

  async criar(dados: Omit<Contrato, 'id' | 'planoNome' | 'vigente'>): Promise<Contrato> {
    const cliente = this.contexto.cliente();
    await cliente.contrato.updateMany({
      where: { alunoId: dados.alunoId, vigente: true },
      data: { vigente: false },
    });
    const linha = await cliente.contrato.create({
      data: {
        tenantId: this.contexto.tenant().id,
        alunoId: dados.alunoId,
        planoId: dados.planoId,
        parcelas: dados.parcelas,
        ...(colunasDoContrato(dados) as Omit<
          Prisma.ContratoUncheckedCreateInput,
          'tenantId' | 'alunoId' | 'planoId' | 'parcelas'
        >),
      },
      include: comPlano,
    });
    return contratoDaLinha(linha);
  }

  async atualizar(id: string, campos: CamposDoContrato): Promise<Contrato> {
    const linha = await this.contexto.cliente().contrato.update({
      where: { id },
      data: colunasDoContrato(campos),
      include: comPlano,
    });
    return contratoDaLinha(linha);
  }

  async vigentesEmAndamento(): Promise<Contrato[]> {
    const linhas = await this.contexto.cliente().contrato.findMany({
      where: vigenteAtivo,
      include: comPlano,
      orderBy: { criadoEm: 'asc' },
    });
    return linhas.map(contratoDaLinha);
  }
}

@Injectable()
export class RepositorioDeConfiguracaoPrisma extends RepositorioDeConfiguracao {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async obter(): Promise<ConfiguracaoDeContrato> {
    const linha = await this.contexto.cliente().configuracaoDeContrato.findFirst();
    return linha
      ? {
          toleranciaDias: linha.toleranciaDias,
          reativacaoDias: linha.reativacaoDias,
          trancamentoMaximoDias: linha.trancamentoMaximoDias,
        }
      : { ...CONFIGURACAO_PADRAO };
  }

  async salvar(config: ConfiguracaoDeContrato): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    await this.contexto.cliente().configuracaoDeContrato.upsert({
      where: { tenantId },
      create: { tenantId, ...config },
      update: config,
    });
  }
}

interface Cursor {
  nome: string;
  id: string;
}

function codificarCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export class CursorDeAlunosInvalidoError extends Error {
  constructor() {
    super('Cursor inválido.');
    this.name = 'CursorDeAlunosInvalidoError';
  }
}

function decodificarCursor(texto: string): Cursor {
  try {
    const valor = JSON.parse(Buffer.from(texto, 'base64url').toString('utf-8')) as Partial<Cursor>;
    if (typeof valor.nome === 'string' && typeof valor.id === 'string') {
      return { nome: valor.nome, id: valor.id };
    }
  } catch {
    // cai no erro abaixo
  }
  throw new CursorDeAlunosInvalidoError();
}

const camposDaLinhaDoAluno = {
  id: true,
  criadoEm: true,
  unidadeId: true,
  nome: true,
  cpf: true,
  telefone: true,
  email: true,
  dataNascimento: true,
  professorId: true,
  meta: true,
  restricoes: true,
  leadId: true,
} as const;

@Injectable()
export class RepositorioDeAlunosPrisma extends RepositorioDeAlunos {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
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

  async criar(dados: DadosPessoaisDoAluno & { unidadeId: string }): Promise<Aluno> {
    const linha = await this.contexto.cliente().aluno.create({
      data: { tenantId: this.contexto.tenant().id, ...(await this.colunas(dados)) },
      select: { id: true, criadoEm: true },
    });
    return { ...dados, id: linha.id, criadoEm: linha.criadoEm };
  }

  async atualizar(id: string, dados: DadosPessoaisDoAluno): Promise<Aluno> {
    const linha = await this.contexto.cliente().aluno.update({
      where: { id },
      data: await this.colunas(dados),
      select: { id: true, criadoEm: true, unidadeId: true },
    });
    return { ...dados, ...linha };
  }

  async porId(id: string, quem: string): Promise<Aluno | null> {
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { id }, select: camposDaLinhaDoAluno });
    if (!linha) {
      return null;
    }
    const revelada = await this.cifra.revelar(CAMPOS_DO_ALUNO, linha, { titularId: id, quem });
    return { ...revelada, dataNascimento: dataOuNulo(revelada.dataNascimento) };
  }

  async nome(id: string): Promise<string | null> {
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { id }, select: { nome: true } });
    return linha?.nome ?? null;
  }

  async resumos(
    ids: readonly string[],
  ): Promise<Map<string, { nome: string; professorId: string | null }>> {
    const linhas = await this.contexto.cliente().aluno.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, nome: true, professorId: true },
    });
    return new Map(linhas.map((l) => [l.id, { nome: l.nome, professorId: l.professorId }]));
  }

  async todosOsIds(): Promise<string[]> {
    const linhas = await this.contexto
      .cliente()
      .aluno.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    return linhas.map((linha) => linha.id);
  }

  async idPorCpf(cpf: string): Promise<string | null> {
    const cpfHash = await this.cifra.indiceCego('cpf', cpf);
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { cpfHash }, select: { id: true } });
    return linha?.id ?? null;
  }

  async idPorEmail(email: string): Promise<string | null> {
    const emailHash = await this.cifra.indiceCego('email', email);
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { emailHash }, select: { id: true } });
    return linha?.id ?? null;
  }

  async idPorTelefone(telefone: string): Promise<string | null> {
    const digitos = telefone.replace(/D/g, '');
    const variantes = new Set([digitos]);
    if (digitos.startsWith('55') && digitos.length > 11) {
      variantes.add(digitos.slice(2));
    }
    const telefoneHash = {
      in: await Promise.all([...variantes].map((v) => this.cifra.indiceCego('telefone', v))),
    };
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { telefoneHash }, select: { id: true } });
    return linha?.id ?? null;
  }

  async contato(id: string): Promise<ContatoDoAlunoParaMensagem | null> {
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { id }, select: { nome: true, telefone: true, email: true } });
    if (!linha) {
      return null;
    }
    return {
      nome: linha.nome,
      telefone: linha.telefone ? await this.cifra.decifrar('aluno.telefone', linha.telefone) : null,
      email: linha.email ? await this.cifra.decifrar('aluno.email', linha.email) : null,
    };
  }

  async listar(
    filtro: FiltroDeAlunos,
    paginacao: { limite: number; cursor?: string },
    hoje: DataCivil,
  ): Promise<PaginaDeAlunos> {
    const cliente = this.contexto.cliente();
    const base = await this.filtroBase(filtro);
    const diaDeHoje = paraColunaDeData(hoje);
    const emAtraso: Prisma.AlunoWhereInput = {
      contratos: { some: { vigente: true, vencimentoEmAtraso: { lt: diaDeHoje } } },
    };
    const aVencer: Prisma.AlunoWhereInput = {
      contratos: {
        some: {
          vigente: true,
          OR: [{ vencimentoEmAtraso: null }, { vencimentoEmAtraso: { gte: diaDeHoje } }],
          proximoVencimento: {
            gte: diaDeHoje,
            lte: paraColunaDeData(somarDias(hoje, JANELA_A_VENCER_DIAS)),
          },
        },
      },
    };
    const emDia: Prisma.AlunoWhereInput = { NOT: [emAtraso, aVencer] };
    const porSituacao = { em_atraso: emAtraso, a_vencer: aVencer, em_dia: emDia };

    const cursor = paginacao.cursor ? decodificarCursor(paginacao.cursor) : null;
    const depoisDoCursor: Prisma.AlunoWhereInput = cursor
      ? {
          OR: [{ nome: { gt: cursor.nome } }, { nome: cursor.nome, id: { gt: cursor.id } }],
        }
      : {};
    const linhas = await cliente.aluno.findMany({
      where: {
        AND: [base, filtro.situacao ? porSituacao[filtro.situacao] : {}, depoisDoCursor],
      },
      select: {
        id: true,
        nome: true,
        contratos: {
          where: { vigente: true },
          include: { plano: { select: { id: true, nome: true } } },
          take: 1,
        },
      },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      take: paginacao.limite + 1,
    });
    const pagina = linhas.slice(0, paginacao.limite);
    const ultima = pagina.at(-1);

    const [todos, emDiaTotal, aVencerTotal, emAtrasoTotal] = await Promise.all([
      cliente.aluno.count({ where: base }),
      cliente.aluno.count({ where: { AND: [base, emDia] } }),
      cliente.aluno.count({ where: { AND: [base, aVencer] } }),
      cliente.aluno.count({ where: { AND: [base, emAtraso] } }),
    ]);

    return {
      itens: pagina.map((linha) => {
        const contrato = linha.contratos[0];
        return {
          id: linha.id,
          nome: linha.nome,
          plano: contrato ? { id: contrato.plano.id, nome: contrato.plano.nome } : null,
          contrato: contrato ? contratoDaLinha(contrato) : null,
        };
      }),
      proximoCursor:
        linhas.length > paginacao.limite && ultima
          ? codificarCursor({ nome: ultima.nome, id: ultima.id })
          : null,
      contadores: {
        todos,
        em_dia: emDiaTotal,
        a_vencer: aVencerTotal,
        em_atraso: emAtrasoTotal,
      },
    };
  }

  async excluir(id: string): Promise<number> {
    const cliente = this.contexto.cliente();
    const contratos = await cliente.contrato.deleteMany({ where: { alunoId: id } });
    const credenciais = await cliente.credencialAluno.deleteMany({ where: { alunoId: id } });
    const alunos = await cliente.aluno.deleteMany({ where: { id } });
    return contratos.count + credenciais.count + alunos.count;
  }

  /** Plano e busca (nome em parte, CPF ou telefone completos pelo índice cego). */
  private async filtroBase(filtro: FiltroDeAlunos): Promise<Prisma.AlunoWhereInput> {
    const condicoes: Prisma.AlunoWhereInput[] = [];
    if (filtro.planoId) {
      condicoes.push({ contratos: { some: { vigente: true, planoId: filtro.planoId } } });
    }
    const busca = filtro.busca?.trim() ?? '';
    if (busca !== '') {
      const ou: Prisma.AlunoWhereInput[] = [{ nome: { contains: busca, mode: 'insensitive' } }];
      const digitos = somenteDigitos(busca);
      if (validarCpf(busca)) {
        ou.push({ cpfHash: await this.cifra.indiceCego('cpf', digitos) });
      }
      if (digitos.length >= 10 && digitos.length <= 13) {
        ou.push({ telefoneHash: await this.cifra.indiceCego('telefone', digitos) });
      }
      condicoes.push({ OR: ou });
    }
    return { AND: condicoes };
  }

  private async colunas(dados: DadosPessoaisDoAluno & { unidadeId?: string }) {
    const protegidos = await this.cifra.proteger(CAMPOS_DO_ALUNO, {
      cpf: dados.cpf,
      telefone: dados.telefone,
      email: dados.email,
      restricoes: dados.restricoes,
    });
    return {
      ...(dados.unidadeId ? { unidadeId: dados.unidadeId } : {}),
      nome: dados.nome,
      ...protegidos,
      dataNascimento: colunaOuNulo(dados.dataNascimento) ?? null,
      professorId: dados.professorId,
      meta: dados.meta,
      leadId: dados.leadId,
    } as {
      unidadeId: string;
      nome: string;
      cpf: string;
      cpfHash: string;
      telefone: string | null;
      telefoneHash: string | null;
      email: string | null;
      emailHash: string | null;
      restricoes: string | null;
      dataNascimento: Date | null;
      professorId: string | null;
      meta: string | null;
      leadId: string | null;
    };
  }
}
