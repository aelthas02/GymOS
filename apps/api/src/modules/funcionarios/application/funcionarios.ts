import { Injectable } from '@nestjs/common';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { ConvidarParaEquipe } from '../../autenticacao/application/convites';
import {
  RepositorioDeRefresh,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
  type Usuario,
} from '../../autenticacao/application/portas';
import type { TipoDeAcesso } from '../../autenticacao/domain/tipos-de-acesso';
import type { ChaveDaAcao } from '../../platform/domain/atividade';
import { Relogio } from '../../platform/domain/relogio';
import type { Tenant } from '../../platform/domain/tenant';
import {
  CARGOS_DE_ATENDIMENTO,
  type DadosDoFuncionario,
  type EntradaDoFuncionario,
  type FiltroDeCargo,
  FuncionarioInvalidoError,
  mudancaDeAcesso,
  normalizarFuncionario,
} from '../domain/funcionario';
import { AutoriaDosFuncionarios, type Executor } from './autoria';
import { ConflitoError, NaoEncontradoError } from './erros';
import {
  type FiltroDeFuncionarios,
  type Funcionario,
  type PaginaDeFuncionarios,
  RegistroDeVinculos,
  RepositorioDeFuncionarios,
} from './portas';

export const LIMITE_PADRAO_DA_LISTA = 20;
export const LIMITE_MAXIMO_DA_LISTA = 100;

export interface ConsultaDeFuncionarios {
  cargo?: FiltroDeCargo;
  busca?: string;
  pagina?: number;
  limite?: number;
}

export interface CustoDeFuncionario {
  funcionarioId: string;
  nome: string;
  cargo: string;
  cargoDescricao: string | null;
  custoMensalCentavos: number;
}

/** Folha de pagamento da equipe ativa, para o Financeiro (T21, "Custo da equipe"). */
export interface CustoDaEquipe {
  itens: CustoDeFuncionario[];
  quantidade: number;
  totalCentavos: number;
  /** Total dividido pela quantidade, arredondado (0 sem funcionários). */
  mediaCentavos: number;
}

export interface Profissional {
  id: string;
  nome: string;
  cargo: string;
  cargoDescricao: string | null;
}

export interface ResultadoDaCriacao {
  funcionario: Funcionario;
  /** Falso quando já existia um funcionário com o e-mail e nada foi criado nem enviado. */
  criado: boolean;
}

interface EstadoDeAcesso {
  tipoDeAcessoId: string | null;
  ativo: boolean;
}

/** Usuário criado pelo cadastro que ainda não aceitou o convite. */
const pendente = (usuario: Usuario): boolean => usuario.senhaHash === null && usuario.ativo;

/**
 * Equipe da academia (T26a): cadastro, edição, inativação e exclusão de funcionários, e o acesso ao
 * painel que vem junto. Com tipo de acesso, o cadastro cria o `Usuario` (sem senha) e convida por
 * e-mail (T12); sem acesso, é só cadastro. Voltar para "Sem acesso" ou inativar desativa o usuário e
 * derruba as sessões. Tudo roda na transação da requisição, junto com a auditoria.
 */
@Injectable()
export class Funcionarios {
  constructor(
    private readonly repositorio: RepositorioDeFuncionarios,
    private readonly tipos: RepositorioDeTiposDeAcesso,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly refresh: RepositorioDeRefresh,
    private readonly convidar: ConvidarParaEquipe,
    private readonly vinculos: RegistroDeVinculos,
    private readonly autoria: AutoriaDosFuncionarios,
    private readonly relogio: Relogio,
  ) {}

  listar(consulta: ConsultaDeFuncionarios): Promise<PaginaDeFuncionarios> {
    const filtro: FiltroDeFuncionarios = {
      cargo: consulta.cargo,
      busca: consulta.busca?.trim() || undefined,
      pagina: Math.max(1, consulta.pagina ?? 1),
      limite: Math.min(
        Math.max(1, consulta.limite ?? LIMITE_PADRAO_DA_LISTA),
        LIMITE_MAXIMO_DA_LISTA,
      ),
    };
    return this.repositorio.listar(filtro);
  }

  async buscar(id: string): Promise<Funcionario> {
    const funcionario = await this.repositorio.porId(id);
    if (!funcionario) {
      throw new NaoEncontradoError('Funcionário');
    }
    return funcionario;
  }

  /** Tipos de acesso dos funcionários, por id (a lista mostra o tipo ao lado do cargo). */
  async tiposDeAcesso(funcionarios: readonly Funcionario[]): Promise<Map<string, TipoDeAcesso>> {
    const ids = [
      ...new Set(funcionarios.flatMap((f) => (f.tipoDeAcessoId ? [f.tipoDeAcessoId] : []))),
    ];
    const tipos = ids.length > 0 ? await this.tipos.porIds(ids) : [];
    return new Map(tipos.map((tipo) => [tipo.id, tipo]));
  }

  async criar(
    tenant: Tenant,
    executor: Executor,
    entrada: EntradaDoFuncionario,
  ): Promise<Funcionario> {
    const dados = await this.preparar(entrada);
    if (dados.email !== null && (await this.repositorio.porEmail(dados.email))) {
      throw new ConflitoError('Já existe um funcionário com este e-mail.');
    }
    return this.gravarNovo(tenant, executor, dados);
  }

  /**
   * Cria o funcionário só se o e-mail ainda não for de nenhum (Passo 3 do onboarding, que pode ser
   * reenviado): a segunda chamada devolve o mesmo funcionário e não envia outro convite.
   */
  async criarSeNaoExistir(
    tenant: Tenant,
    executor: Executor,
    entrada: EntradaDoFuncionario,
  ): Promise<ResultadoDaCriacao> {
    const dados = await this.preparar(entrada);
    if (dados.email === null) {
      throw new FuncionarioInvalidoError('O e-mail é obrigatório para convidar a equipe.');
    }
    const existente = await this.repositorio.porEmail(dados.email);
    if (existente) {
      return { funcionario: existente, criado: false };
    }
    return { funcionario: await this.gravarNovo(tenant, executor, dados), criado: true };
  }

  async editar(
    tenant: Tenant,
    executor: Executor,
    id: string,
    entrada: EntradaDoFuncionario,
  ): Promise<Funcionario> {
    const atual = await this.buscar(id);
    const dados = await this.preparar(entrada);
    if (dados.email !== atual.email) {
      if (atual.usuarioId !== null) {
        throw new FuncionarioInvalidoError(
          'O e-mail de login de quem já teve acesso não pode ser alterado.',
        );
      }
      if (dados.email !== null && (await this.repositorio.porEmail(dados.email))) {
        throw new ConflitoError('Já existe um funcionário com este e-mail.');
      }
    }
    const usuarioId = await this.aplicarAcesso(
      tenant,
      atual,
      { tipoDeAcessoId: atual.tipoDeAcessoId, ativo: atual.ativo },
      { tipoDeAcessoId: dados.tipoDeAcessoId, ativo: atual.ativo },
      dados,
    );
    const novo = await this.repositorio.atualizar(id, { ...dados, usuarioId });
    await this.auditarEdicao(executor, atual, novo);
    return novo;
  }

  inativar(tenant: Tenant, executor: Executor, id: string): Promise<Funcionario> {
    return this.mudarAtividade(tenant, executor, id, false);
  }

  reativar(tenant: Tenant, executor: Executor, id: string): Promise<Funcionario> {
    return this.mudarAtividade(tenant, executor, id, true);
  }

  /** Só sem vínculos (aluno que ele acompanha, aula, atendimento); com vínculo, inative. */
  async excluir(executor: Executor, id: string): Promise<void> {
    const atual = await this.buscar(id);
    const vinculos = await this.vinculos.descrever(id);
    if (vinculos.length > 0) {
      throw new ConflitoError(
        `${atual.nome} não pode ser excluído: ${vinculos.join('; ')}. Inative o funcionário.`,
      );
    }
    if (atual.usuarioId !== null) {
      await this.desativarUsuario(atual.usuarioId);
    }
    await this.repositorio.excluir(id);
    await this.autoria.registrar(executor, {
      acao: 'excluiu-funcionario',
      detalhe: `${atual.nome} (${atual.cargo})`,
    });
  }

  /** Custo mensal dos funcionários ativos (T21). */
  async custoDaEquipe(): Promise<CustoDaEquipe> {
    const ativos = await this.repositorio.ativosPorCargo([]);
    const itens = ativos.map((f) => ({
      funcionarioId: f.id,
      nome: f.nome,
      cargo: f.cargo,
      cargoDescricao: f.cargoDescricao,
      custoMensalCentavos: f.custoMensalCentavos,
    }));
    const totalCentavos = itens.reduce((soma, item) => soma + item.custoMensalCentavos, 0);
    return {
      itens,
      quantidade: itens.length,
      totalCentavos,
      mediaCentavos: itens.length === 0 ? 0 : Math.round(totalCentavos / itens.length),
    };
  }

  /** Ativos que atendem alunos (professores e nutricionistas), ou só os cargos pedidos (T28, T30). */
  async profissionais(cargos?: readonly string[]): Promise<Profissional[]> {
    const lista = await this.repositorio.ativosPorCargo(
      cargos && cargos.length > 0 ? cargos : CARGOS_DE_ATENDIMENTO,
    );
    return lista.map(({ id, nome, cargo, cargoDescricao }) => ({
      id,
      nome,
      cargo,
      cargoDescricao,
    }));
  }

  // --- internos -----------------------------------------------------------------------------

  /** Normaliza e resolve o tipo de acesso: o tipo padrão "Sem acesso" é o mesmo que nenhum. */
  private async preparar(entrada: EntradaDoFuncionario): Promise<DadosDoFuncionario> {
    let tipoDeAcessoId = entrada.tipoDeAcessoId ?? null;
    if (tipoDeAcessoId !== null) {
      const tipo = await this.tipos.porId(tipoDeAcessoId);
      if (!tipo) {
        throw new FuncionarioInvalidoError('Tipo de acesso inexistente.');
      }
      tipoDeAcessoId = tipo.chave === 'sem-acesso' ? null : tipo.id;
    }
    return normalizarFuncionario({ ...entrada, tipoDeAcessoId });
  }

  private async gravarNovo(
    tenant: Tenant,
    executor: Executor,
    dados: DadosDoFuncionario,
  ): Promise<Funcionario> {
    const usuarioId = await this.garantirUsuario(tenant, null, dados);
    const criado = await this.repositorio.criar({ ...dados, usuarioId });
    await this.autoria.registrar(executor, {
      acao: 'cadastrou-funcionario',
      detalhe: `${criado.nome} (${criado.cargo})`,
    });
    return criado;
  }

  private async mudarAtividade(
    tenant: Tenant,
    executor: Executor,
    id: string,
    ativo: boolean,
  ): Promise<Funcionario> {
    const atual = await this.buscar(id);
    if (atual.ativo === ativo) {
      return atual;
    }
    const usuarioId = await this.aplicarAcesso(
      tenant,
      atual,
      { tipoDeAcessoId: atual.tipoDeAcessoId, ativo: atual.ativo },
      { tipoDeAcessoId: atual.tipoDeAcessoId, ativo },
      atual,
    );
    const novo = await this.repositorio.atualizar(id, { ativo, usuarioId });
    await this.autoria.registrar(executor, {
      acao: 'editou-funcionario',
      detalhe: `${ativo ? 'Reativou' : 'Inativou'} ${atual.nome}`,
    });
    if (atual.tipoDeAcessoId !== null) {
      await this.autoria.registrar(executor, {
        acao: 'alterou-acesso-de-funcionario',
        detalhe: `${atual.nome}: acesso ${ativo ? 'religado' : 'desligado'}`,
      });
    }
    return novo;
  }

  /** Cria, religa, troca ou desliga o usuário do painel conforme a mudança; devolve o `usuarioId`. */
  private async aplicarAcesso(
    tenant: Tenant,
    atual: Funcionario,
    antes: EstadoDeAcesso,
    depois: EstadoDeAcesso,
    dados: DadosDoFuncionario,
  ): Promise<string | null> {
    const mudanca = mudancaDeAcesso(antes, depois);
    switch (mudanca.tipo) {
      case 'conceder':
      case 'trocar-tipo':
        return this.garantirUsuario(tenant, atual.usuarioId, {
          ...dados,
          tipoDeAcessoId: depois.tipoDeAcessoId,
        });
      case 'revogar':
        if (atual.usuarioId !== null) {
          await this.desativarUsuario(atual.usuarioId);
        }
        return atual.usuarioId;
      case 'nenhuma':
        return atual.usuarioId;
    }
  }

  /**
   * Garante o usuário de quem tem acesso: cria sem senha, ou religa o que já existe com o tipo
   * atual, e convida quem ainda não definiu senha. Sem tipo de acesso, não faz nada.
   */
  private async garantirUsuario(
    tenant: Tenant,
    usuarioId: string | null,
    dados: DadosDoFuncionario,
  ): Promise<string | null> {
    if (dados.tipoDeAcessoId === null || dados.email === null) {
      return usuarioId;
    }
    let usuario = usuarioId !== null ? await this.usuarios.porId(usuarioId) : null;
    if (!usuario) {
      const mesmoEmail = await this.usuarios.porEmail(dados.email);
      if (mesmoEmail && !pendente(mesmoEmail)) {
        throw new ConflitoError('Este e-mail já tem um acesso ao sistema.');
      }
      usuario = mesmoEmail;
    }
    if (!usuario) {
      usuario = await this.usuarios.criar({
        nome: dados.nome,
        email: dados.email,
        senhaHash: null,
        tipoDeAcessoId: dados.tipoDeAcessoId,
      });
    } else {
      if (!usuario.ativo) {
        await this.usuarios.definirAtivo(usuario.id, true);
      }
      if (usuario.tipoDeAcesso.id !== dados.tipoDeAcessoId) {
        await this.usuarios.definirTipoDeAcesso(usuario.id, dados.tipoDeAcessoId);
      }
    }
    if (usuario.senhaHash === null) {
      const convite = await this.convidar.executar(tenant, {
        email: dados.email,
        nome: dados.nome,
        tipoDeAcessoId: dados.tipoDeAcessoId,
      });
      if (convite.tipo !== 'ok') {
        throw new ConflitoError('Não foi possível enviar o convite para este e-mail.');
      }
    }
    return usuario.id;
  }

  private async desativarUsuario(usuarioId: string): Promise<void> {
    await this.usuarios.definirAtivo(usuarioId, false);
    await this.refresh.revogarDoSujeito('staff', usuarioId, this.relogio.agora());
  }

  private async auditarEdicao(
    executor: Executor,
    antes: Funcionario,
    depois: Funcionario,
  ): Promise<void> {
    const registrar = (acao: ChaveDaAcao, detalhe: string) =>
      this.autoria.registrar(executor, { acao, detalhe });
    if (antes.custoMensalCentavos !== depois.custoMensalCentavos) {
      await registrar(
        'alterou-custo-de-funcionario',
        `${depois.nome}: ${formatarBrl(centavos(antes.custoMensalCentavos))} → ${formatarBrl(centavos(depois.custoMensalCentavos))}`,
      );
    }
    if (antes.tipoDeAcessoId !== depois.tipoDeAcessoId) {
      const rotulo = (tipo: string | null): string => (tipo === null ? 'sem acesso' : 'com acesso');
      await registrar(
        'alterou-acesso-de-funcionario',
        `${depois.nome}: ${rotulo(antes.tipoDeAcessoId)} → ${rotulo(depois.tipoDeAcessoId)}`,
      );
    }
    const campos = ['nome', 'cargo', 'cargoDescricao', 'telefone', 'email'] as const;
    if (campos.some((campo) => antes[campo] !== depois[campo])) {
      await registrar('editou-funcionario', `${depois.nome} (${depois.cargo})`);
    }
  }
}
