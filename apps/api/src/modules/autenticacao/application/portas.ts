import type { Publico } from '../domain/credenciais';
import type { ModuloExtra, Permissao } from '../domain/permissoes';
import type { Sobrescritas } from '../domain/modulos-do-plano';
import type { TipoDeAcesso, TipoPadrao } from '../domain/tipos-de-acesso';

// Portas do domínio de autenticação. Os repositórios rodam no contexto do tenant (RLS); os demais
// são serviços de infraestrutura com adapter próprio.

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string | null;
  ativo: boolean;
  tipoDeAcesso: TipoDeAcesso;
}

export abstract class RepositorioDeUsuarios {
  abstract porEmail(email: string): Promise<Usuario | null>;
  abstract porId(id: string): Promise<Usuario | null>;
  abstract criar(dados: {
    nome: string;
    email: string;
    senhaHash: string;
    tipoDeAcessoId: string;
  }): Promise<Usuario>;
  abstract definirSenha(id: string, senhaHash: string): Promise<void>;
}

export interface CredencialDoAluno {
  id: string;
  alunoId: string;
  email: string | null;
  senhaHash: string | null;
  codigoHash: string | null;
  codigoExpiraEm: Date | null;
}

export abstract class RepositorioDeCredenciaisDeAluno {
  abstract porAluno(alunoId: string): Promise<CredencialDoAluno | null>;
  abstract porEmail(email: string): Promise<CredencialDoAluno | null>;
  /** Cria ou atualiza a credencial do aluno (T15a chama ao cadastrar ou gerar o código). */
  abstract salvar(
    dados: Pick<CredencialDoAluno, 'alunoId'> & Partial<Omit<CredencialDoAluno, 'id' | 'alunoId'>>,
  ): Promise<CredencialDoAluno>;
}

/**
 * Busca do aluno pelo CPF ou pelo e-mail, com o índice cego do T13c (adapter do T15a em
 * `alunos/infra`). O e-mail só cai na coluna da credencial quando o aluno não o tem no cadastro.
 */
export abstract class LocalizadorDeAlunoPorCpf {
  abstract alunoDoCpf(cpf: string): Promise<string | null>;
  abstract alunoDoEmail(email: string): Promise<string | null>;
}

export abstract class RepositorioDeTiposDeAcesso {
  abstract porId(id: string): Promise<TipoDeAcesso | null>;
  abstract porChave(chave: string): Promise<TipoDeAcesso | null>;
  /** Cria os tipos padrão que faltarem no tenant do contexto. Idempotente. */
  abstract garantirPadrao(padrao: readonly TipoPadrao[]): Promise<void>;
}

export interface Convite {
  id: string;
  email: string;
  nome: string | null;
  tipoDeAcessoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class RepositorioDeConvites {
  abstract criar(dados: Omit<Convite, 'id' | 'usadoEm'> & { tokenHash: string }): Promise<Convite>;
  abstract porTokenHash(tokenHash: string): Promise<Convite | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<void>;
}

export interface TokenDeRefresh {
  id: string;
  familiaId: string;
  publico: Publico;
  sujeitoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
}

export abstract class RepositorioDeRefresh {
  abstract criar(
    dados: Omit<TokenDeRefresh, 'id' | 'usadoEm' | 'revogadoEm'> & {
      tokenHash: string;
    },
  ): Promise<void>;
  abstract porTokenHash(tokenHash: string): Promise<TokenDeRefresh | null>;
  /** Marca como usado só se ainda não foi: devolve false quando outro uso chegou antes. */
  abstract marcarUsado(id: string, quando: Date): Promise<boolean>;
  abstract revogarFamilia(familiaId: string, quando: Date): Promise<void>;
  abstract revogarDoSujeito(publico: Publico, sujeitoId: string, quando: Date): Promise<void>;
}

export interface RedefinicaoDeSenha {
  id: string;
  publico: Publico;
  sujeitoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class RepositorioDeRedefinicoes {
  abstract criar(
    dados: Omit<RedefinicaoDeSenha, 'id' | 'usadoEm'> & { tokenHash: string },
  ): Promise<void>;
  abstract porTokenHash(tokenHash: string): Promise<RedefinicaoDeSenha | null>;
  abstract marcarUsada(id: string, quando: Date): Promise<void>;
}

export abstract class RepositorioDeModulos {
  abstract sobrescritas(): Promise<Sobrescritas>;
  abstract sobrescrever(modulo: ModuloExtra, ativo: boolean | null): Promise<void>;
}

/** Hash de senha (argon2id). */
export abstract class CifraDeSenha {
  abstract cifrar(senha: string): Promise<string>;
  abstract conferir(senha: string, hash: string): Promise<boolean>;
}

/** Segredos aleatórios (tokens de refresh, convites, códigos) e o hash com que são guardados. */
export abstract class GeradorDeSegredos {
  abstract token(): string;
  abstract codigo(): string;
  abstract hash(segredo: string): string;
}

export interface ReivindicacoesDoAcesso {
  publico: Publico;
  sujeitoId: string;
  tenantId: string;
}

export abstract class EmissorDeTokens {
  abstract emitir(reivindicacoes: ReivindicacoesDoAcesso, agora: Date): string;
  /** null quando o token é inválido, expirado ou de outro emissor. */
  abstract verificar(token: string, agora: Date): ReivindicacoesDoAcesso | null;
}

/** Um contador de tentativas erradas: a chave já leva o tenant (`<tenantId>:ip:<ip>`). */
export interface Contador {
  chave: string;
  limite: number;
  janelaMs: number;
}

/** Contagem de tentativas erradas de login por IP e por conta, em janela deslizante. */
export abstract class LimiteDeTentativas {
  /** true quando algum contador já chegou ao limite dentro da janela. */
  abstract bloqueado(contadores: readonly Contador[], agora: Date): Promise<boolean>;
  abstract registrarFalha(contadores: readonly Contador[], agora: Date): Promise<void>;
  abstract limpar(contador: Contador): Promise<void>;
}

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  /** `transacional` (acesso, senha) ou `marketing`, como as demais mensagens (T13d). */
  finalidade: 'transacional' | 'marketing';
}

/** Única porta de e-mail do sistema: o canal de e-mail da Mensageria (T13d) delega a ela. */
export abstract class EnvioDeEmail {
  abstract enviar(email: Email): Promise<void>;
}

export interface PermissaoNegada {
  tenantId: string;
  usuarioId: string;
  permissao: Permissao;
  /** Método e rota do Nest, por exemplo `DELETE /api/alunos/:id`. */
  rota: string;
}

/** Gancho do 403 do guard; o T13b implementa gravando "Tentativa negada" na auditoria. */
export abstract class AoNegarPermissao {
  abstract registrar(negada: PermissaoNegada): Promise<void>;
}

/** Endereços do painel e do app do aluno de uma academia, para os links dos e-mails. */
export abstract class EnderecosDosApps {
  abstract painel(slug: string): string;
  abstract app(slug: string): string;
}
