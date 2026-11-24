// Domínio Aviso (T13e): quem recebe, os tipos do catálogo e as regras de um aviso. TypeScript puro.

/** Tipos de aviso (chave no banco; a tela agrupa o ícone e a cor por tipo). */
export const TIPOS_DE_AVISO = [
  'plano',
  'aula',
  'reserva',
  'ficha',
  'comunicado',
  'loja',
  'saude',
] as const;
export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

export function ehTipoDeAviso(valor: unknown): valor is TipoDeAviso {
  return typeof valor === 'string' && (TIPOS_DE_AVISO as readonly string[]).includes(valor);
}

/** O aluno do app ou um funcionário do painel (id do usuário da sessão da equipe). */
export type TipoDeDestinatario = 'aluno' | 'funcionario';

export interface Destinatario {
  tipo: TipoDeDestinatario;
  id: string;
}

export const LIMITE_DO_TITULO = 120;
export const LIMITE_DO_TEXTO = 500;
export const LIMITE_DO_LINK = 300;

export interface DadosDoAviso {
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  /** Caminho interno do app (`/plano`, `/aulas`); nunca um endereço externo. */
  link?: string | null;
}

export class AvisoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'AvisoInvalidoError';
  }
}

/** Caminho interno: começa com uma barra, sem `//` (host implícito) nem barra invertida. */
export function ehLinkInterno(link: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(link) && link.length <= LIMITE_DO_LINK;
}

/**
 * Endereço de um provedor de push: https, com nome de domínio (nunca IP nem localhost). O servidor
 * faz POST nesse endereço, então um valor qualquer do cliente seria uma porta para a rede interna.
 */
export function validarEndpointDePush(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AvisoInvalidoError('Endpoint de push inválido.');
  }
  const host = url.hostname.toLowerCase();
  const ehIp = /^[\d.]+$/.test(host) || host.includes(':');
  const ehLocal = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    ehIp ||
    ehLocal ||
    !host.includes('.')
  ) {
    throw new AvisoInvalidoError('O endpoint de push deve ser um endereço https público.');
  }
}

/** Valida e normaliza (sem espaços nas pontas) os dados de um aviso. */
export function validarAviso(dados: DadosDoAviso): Required<DadosDoAviso> {
  if (!ehTipoDeAviso(dados.tipo)) {
    throw new AvisoInvalidoError(`Tipo de aviso desconhecido: ${String(dados.tipo)}.`);
  }
  const titulo = dados.titulo.trim();
  const texto = dados.texto.trim();
  if (titulo === '' || titulo.length > LIMITE_DO_TITULO) {
    throw new AvisoInvalidoError(`O título deve ter de 1 a ${LIMITE_DO_TITULO} caracteres.`);
  }
  if (texto === '' || texto.length > LIMITE_DO_TEXTO) {
    throw new AvisoInvalidoError(`O texto deve ter de 1 a ${LIMITE_DO_TEXTO} caracteres.`);
  }
  const link = dados.link?.trim() || null;
  if (link !== null && !ehLinkInterno(link)) {
    throw new AvisoInvalidoError('O link deve ser um caminho interno do app, como "/plano".');
  }
  return { tipo: dados.tipo, titulo, texto, link };
}

/** Cursor opaco da lista: o último aviso entregue (criado em, id). */
export interface PosicaoDaLista {
  criadoEm: Date;
  id: string;
}

export function codificarCursor(posicao: PosicaoDaLista): string {
  return Buffer.from(`${posicao.criadoEm.toISOString()}|${posicao.id}`).toString('base64url');
}

export function decodificarCursor(cursor: string): PosicaoDaLista {
  const [instante, id, ...resto] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const criadoEm = new Date(instante ?? '');
  if (resto.length > 0 || !id || Number.isNaN(criadoEm.getTime())) {
    throw new AvisoInvalidoError('Cursor inválido.');
  }
  return { criadoEm, id };
}
