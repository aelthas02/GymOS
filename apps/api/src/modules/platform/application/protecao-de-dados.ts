import type {
  DecisaoDeConsentimento,
  Finalidade,
  RegistroDeConsentimento,
} from '../domain/consentimento';
import type { TipoDeIndice } from '../domain/indice-cego';

// Portas da proteção de dados pessoais (T13c, ADR-015): cifra de campo com chave por tenant, índice
// cego, consentimento por finalidade e log de acesso a dado sensível.

/**
 * Guarda da chave mestra (KMS em staging e produção, chave local em dev e teste). Só envelopa e
 * desenvelopa as chaves dos tenants: a chave mestra nunca sai do provedor.
 */
export abstract class ProvedorDeChaves {
  abstract envelopar(chave: Buffer): Promise<{ envelope: string; idDaChaveMestra: string }>;
  abstract desenvelopar(envelope: string, idDaChaveMestra: string): Promise<Buffer>;
}

export interface CampoProtegido {
  /** Grava também `<campo>Hash`, o índice cego para busca exata e unicidade. */
  indice?: TipoDeIndice;
  /** Dado sensível (saúde, biometria): cada leitura grava o log de acesso. */
  sensivel?: boolean;
}

export interface DefinicaoDeCampos<C extends Record<string, CampoProtegido>> {
  /** Nome da entidade, parte do nome do campo nos logs e na cifra (`aluno.cpf`). */
  entidade: string;
  campos: C;
}

/** Marca os campos cifrados de uma entidade; a definição fica junto do repositório do domínio. */
export function definirCamposProtegidos<const C extends Record<string, CampoProtegido>>(
  entidade: string,
  campos: C,
): DefinicaoDeCampos<C> {
  return { entidade, campos };
}

type ComIndice<C> = {
  [K in keyof C]: C[K] extends { indice: TipoDeIndice } ? K : never;
}[keyof C];

/** Os dados com os campos marcados cifrados e o `<campo>Hash` de cada campo com índice. */
export type DadosProtegidos<T, C> = T & {
  [K in ComIndice<C> & string as `${K}Hash`]: string | null;
};

export interface LeituraDoTitular {
  /** Titular do dado (o aluno). */
  titularId: string;
  /** Quem lê: o id do usuário da sessão, ou `sistema:<processo>` em jobs. */
  quem: string;
}

/**
 * Cifra AES-256-GCM e índice HMAC-SHA256 com as chaves do tenant do contexto. `proteger` e
 * `revelar` são o helper dos repositórios Prisma: recebem e devolvem o objeto de `data` ou a linha.
 */
export abstract class CifraDeCampos {
  /** `campo` é `<entidade>.<campo>` e entra como dado autenticado: o texto só decifra no mesmo campo. */
  abstract cifrar(campo: string, valor: string): Promise<string>;
  abstract decifrar(campo: string, cifrado: string): Promise<string>;
  abstract indiceCego(tipo: TipoDeIndice, valor: string): Promise<string>;
  /** Cifra de novo com a chave ativa do tenant (depois de uma rotação). */
  abstract recifrar(campo: string, cifrado: string): Promise<string>;
  abstract proteger<C extends Record<string, CampoProtegido>, T extends object>(
    definicao: DefinicaoDeCampos<C>,
    dados: T,
  ): Promise<DadosProtegidos<T, C>>;
  abstract revelar<C extends Record<string, CampoProtegido>, T extends object>(
    definicao: DefinicaoDeCampos<C>,
    linha: T,
    leitura: LeituraDoTitular,
  ): Promise<T>;
}

/** Log de leitura de dado sensível, no tenant do contexto. */
export abstract class RegistroDeAcessoSensivel {
  abstract registrar(acesso: LeituraDoTitular & { campos: string[] }): Promise<void>;
}

export interface NovaDecisaoDeConsentimento {
  alunoId: string;
  finalidade: Finalidade;
  decisao: DecisaoDeConsentimento;
  origem: string;
}

/** Histórico de aceite e revogação por finalidade, no tenant do contexto. */
export abstract class Consentimentos {
  abstract registrar(decisao: NovaDecisaoDeConsentimento): Promise<RegistroDeConsentimento>;
  /** Em ordem de registro. */
  abstract historico(alunoId: string): Promise<RegistroDeConsentimento[]>;
  abstract elegivel(alunoId: string, finalidade: Finalidade): Promise<boolean>;
  /** Os alunos da lista que podem receber mensagem da finalidade (envio em lote). */
  abstract elegiveis(alunoIds: readonly string[], finalidade: Finalidade): Promise<string[]>;
}
