import { somenteDigitos, validarCpf, validarEmail } from '@gymos/shared-validation';

export type IdentificadorDoAluno = { tipo: 'cpf'; cpf: string } | { tipo: 'email'; email: string };

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** O campo único do login do aluno: CPF com ou sem pontuação, ou e-mail. */
export function interpretarIdentificador(texto: string): IdentificadorDoAluno | null {
  const valor = texto.trim();
  if (validarCpf(valor)) {
    return { tipo: 'cpf', cpf: somenteDigitos(valor) };
  }
  if (validarEmail(valor)) {
    return { tipo: 'email', email: normalizarEmail(valor) };
  }
  return null;
}

/** Chave da conta no limite de tentativas: o identificador normalizado. */
export function chaveDoIdentificador(identificador: IdentificadorDoAluno): string {
  return identificador.tipo === 'cpf' ? `cpf:${identificador.cpf}` : `email:${identificador.email}`;
}

/** Quem usa a sessão: a equipe no painel ou o aluno no app. Cada um tem cookie e caminho próprios. */
export type Publico = 'staff' | 'aluno';

export const DURACAO_DO_ACESSO_MS = 10 * 60 * 1000;
export const DURACAO_DO_REFRESH_MS: Readonly<Record<Publico, number>> = {
  staff: 7 * 24 * 60 * 60 * 1000,
  aluno: 30 * 24 * 60 * 60 * 1000,
};
export const DURACAO_DO_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;
export const DURACAO_DA_REDEFINICAO_MS = 60 * 60 * 1000;
export const DURACAO_DO_CODIGO_DE_PRIMEIRO_ACESSO_MS = 7 * 24 * 60 * 60 * 1000;

/** Tentativas erradas por janela antes do bloqueio: por conta e, mais folgado, por IP. */
export const LIMITE_DE_TENTATIVAS = { janelaMs: 15 * 60 * 1000, porConta: 5, porIp: 20 } as const;

export interface RegistroDeUsoUnico {
  expiraEm: Date;
  usadoEm: Date | null;
}

/** Convite, redefinição de senha e código de primeiro acesso: válidos uma vez e até expirar. */
export function usoUnicoDisponivel(registro: RegistroDeUsoUnico, agora: Date): boolean {
  return registro.usadoEm === null && agora.getTime() < registro.expiraEm.getTime();
}

export interface EstadoDoRefresh extends RegistroDeUsoUnico {
  revogadoEm: Date | null;
}

export type UsoDoRefresh = 'valido' | 'reuso' | 'expirado';

/**
 * Um refresh já usado ou revogado que volta é reuso (token vazado ou roubado): a família inteira é
 * revogada. Expirado só é recusado.
 */
export function avaliarRefresh(refresh: EstadoDoRefresh, agora: Date): UsoDoRefresh {
  if (refresh.usadoEm !== null || refresh.revogadoEm !== null) {
    return 'reuso';
  }
  return agora.getTime() < refresh.expiraEm.getTime() ? 'valido' : 'expirado';
}

export function emMs(instante: Date, ms: number): Date {
  return new Date(instante.getTime() + ms);
}
