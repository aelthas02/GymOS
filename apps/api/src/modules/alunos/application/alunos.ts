import { Injectable } from '@nestjs/common';
import { somenteDigitos, validarCpf, validarEmail } from '@gymos/shared-validation';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { DireitosDoTitular } from '../../platform/application/direitos-do-titular';
import { Consentimentos } from '../../platform/application/protecao-de-dados';
import type { DecisaoDeConsentimento, Finalidade } from '../../platform/domain/consentimento';
import type { DataCivil } from '../../platform/domain/relogio';
import { GerarCodigoDePrimeiroAcesso } from '../../autenticacao/application/senhas';
import { Contratos } from './contratos';
import { type Executor, RegistroDeAtividade } from './autoria';
import { ConflitoError, NaoEncontradoError } from './erros';
import {
  type Aluno,
  type DadosPessoaisDoAluno,
  type FiltroDeAlunos,
  type PaginaDeAlunos,
  RepositorioDeAlunos,
} from './portas';

export class AlunoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'AlunoInvalidoError';
  }
}

export interface ConsentimentoNoCadastro {
  finalidade: Finalidade;
  decisao: DecisaoDeConsentimento;
}

export interface NovoAluno extends DadosPessoaisDoAluno {
  unidadeId?: string;
  /** Com plano, o cadastro já cria o contrato (adesão). */
  planoId?: string;
  inicioDoContrato?: DataCivil;
  consentimentos?: readonly ConsentimentoNoCadastro[];
}

export const LIMITE_PADRAO_DA_LISTA = 20;
export const LIMITE_MAXIMO_DA_LISTA = 100;

/** CPF só com dígitos e válido; e-mail minúsculo; texto vazio vira nulo. */
export function normalizarDadosPessoais(dados: DadosPessoaisDoAluno): DadosPessoaisDoAluno {
  const vazioParaNulo = (valor: string | null): string | null => {
    const limpo = valor?.trim() ?? '';
    return limpo === '' ? null : limpo;
  };
  const nome = dados.nome.trim();
  if (nome === '') {
    throw new AlunoInvalidoError('O aluno precisa de um nome.');
  }
  if (!validarCpf(dados.cpf)) {
    throw new AlunoInvalidoError('CPF inválido.');
  }
  const email = vazioParaNulo(dados.email)?.toLowerCase() ?? null;
  if (email !== null && !validarEmail(email)) {
    throw new AlunoInvalidoError('E-mail inválido.');
  }
  const telefone = vazioParaNulo(dados.telefone);
  return {
    ...dados,
    nome,
    cpf: somenteDigitos(dados.cpf),
    email,
    telefone: telefone === null ? null : somenteDigitos(telefone),
    meta: vazioParaNulo(dados.meta),
    restricoes: vazioParaNulo(dados.restricoes),
  };
}

/** Cadastro, edição, exclusão (LGPD) e consulta de alunos; o acesso ao app nasce aqui. */
@Injectable()
export class Alunos {
  constructor(
    private readonly alunos: RepositorioDeAlunos,
    private readonly contratos: Contratos,
    private readonly consentimentos: Consentimentos,
    private readonly direitos: DireitosDoTitular,
    private readonly codigo: GerarCodigoDePrimeiroAcesso,
    private readonly publicador: PublicadorDeEventos,
    private readonly atividade: RegistroDeAtividade,
  ) {}

  /** CPF já cadastrado no tenant é recusado (índice cego único). */
  async cadastrar(executor: Executor | null, novo: NovoAluno): Promise<Aluno> {
    const dados = normalizarDadosPessoais(novo);
    if (await this.alunos.idPorCpf(dados.cpf)) {
      throw new ConflitoError('Já existe um aluno com este CPF.');
    }
    const unidadeId = novo.unidadeId ?? (await this.alunos.unidadePadrao());
    const aluno = await this.alunos.criar({ ...dados, unidadeId });
    for (const consentimento of novo.consentimentos ?? []) {
      await this.consentimentos.registrar({
        alunoId: aluno.id,
        origem: 'cadastro',
        ...consentimento,
      });
    }
    await this.publicador.publicar({
      tipo: 'AlunoCadastrado',
      payload: { alunoId: aluno.id, unidadeId, nome: aluno.nome },
    });
    if (novo.planoId) {
      await this.contratos.aderir(aluno.id, novo.planoId, novo.inicioDoContrato);
    }
    if (executor) {
      await this.atividade.registrar(executor, { acao: 'cadastrou-aluno', detalhe: aluno.nome });
    }
    return aluno;
  }

  async editar(id: string, dados: DadosPessoaisDoAluno): Promise<Aluno> {
    const normalizados = normalizarDadosPessoais(dados);
    if (!(await this.alunos.nome(id))) {
      throw new NaoEncontradoError('Aluno');
    }
    const outro = await this.alunos.idPorCpf(normalizados.cpf);
    if (outro && outro !== id) {
      throw new ConflitoError('Já existe um aluno com este CPF.');
    }
    return this.alunos.atualizar(id, normalizados);
  }

  /** Só confere que o aluno existe (404 antes de ler o contrato). */
  async obterNome(id: string): Promise<string> {
    const nome = await this.alunos.nome(id);
    if (!nome) {
      throw new NaoEncontradoError('Aluno');
    }
    return nome;
  }

  async obter(id: string, quem: string): Promise<Aluno> {
    const aluno = await this.alunos.porId(id, quem);
    if (!aluno) {
      throw new NaoEncontradoError('Aluno');
    }
    return aluno;
  }

  listar(
    filtro: FiltroDeAlunos,
    paginacao: { limite?: number; cursor?: string },
  ): Promise<PaginaDeAlunos> {
    const limite = Math.min(
      Math.max(paginacao.limite ?? LIMITE_PADRAO_DA_LISTA, 1),
      LIMITE_MAXIMO_DA_LISTA,
    );
    return this.alunos.listar(
      filtro,
      { limite, ...(paginacao.cursor ? { cursor: paginacao.cursor } : {}) },
      this.contratos.hoje(),
    );
  }

  /** Exclusão do titular em todos os domínios (T13c) e a auditoria sensível "Excluiu aluno". */
  async excluir(executor: Executor, id: string, motivo?: string): Promise<void> {
    const nome = await this.alunos.nome(id);
    if (!nome) {
      throw new NaoEncontradoError('Aluno');
    }
    await this.direitos.excluir(id);
    await this.atividade.registrar(executor, {
      acao: 'excluiu-aluno',
      detalhe: motivo?.trim() ? `${motivo.trim()}: ${nome}` : nome,
    });
  }

  /** Código de primeiro acesso ao app, entregue pela recepção (vale 7 dias, T12). */
  async gerarCodigoDeAcesso(id: string): Promise<string> {
    if (!(await this.alunos.nome(id))) {
      throw new NaoEncontradoError('Aluno');
    }
    // O e-mail não vai para a credencial: o login por e-mail usa o índice cego do aluno (T13c).
    return this.codigo.executar(id, null);
  }
}
