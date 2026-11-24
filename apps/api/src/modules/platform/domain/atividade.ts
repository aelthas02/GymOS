import { CATALOGO_DE_MODULOS } from '../../autenticacao/domain/permissoes';

// Log de atividades (T13b): catálogo de ações e módulos com os textos de Log.html, regras de
// retenção e cursor. A chave da ação é o que fica no banco; o texto vem do código.

export interface AcaoDaAuditoria {
  texto: string;
  /** Módulo do menu a que a ação pertence (chave do catálogo do T12). */
  modulo: string;
  /** Aparece com a etiqueta "Sensível" e vem primeiro em "sensíveis em destaque". */
  sensivel: boolean;
}

export const ACOES_DA_AUDITORIA = {
  'alterou-valor': { texto: 'Alterou valor', modulo: 'planos', sensivel: true },
  'alterou-permissao': { texto: 'Alterou permissão', modulo: 'permissoes', sensivel: true },
  'cadastrou-aluno': { texto: 'Cadastrou aluno', modulo: 'alunos', sensivel: false },
  'enviou-cobranca-em-lote': {
    texto: 'Enviou cobrança em lote',
    modulo: 'alunos',
    sensivel: false,
  },
  'registrou-pagamento': { texto: 'Registrou pagamento', modulo: 'financeiro', sensivel: false },
  'estornou-pagamento': { texto: 'Estornou pagamento', modulo: 'financeiro', sensivel: true },
  'combinou-nova-data': { texto: 'Combinou nova data', modulo: 'financeiro', sensivel: false },
  'trocou-forma-de-pagamento': {
    texto: 'Trocou forma de pagamento',
    modulo: 'financeiro',
    sensivel: false,
  },
  'alterou-configuracao-financeira': {
    texto: 'Alterou configuração financeira',
    modulo: 'configuracoes',
    sensivel: true,
  },
  'editou-ficha-de-treino': { texto: 'Editou ficha de treino', modulo: 'treinos', sensivel: false },
  'excluiu-aluno': { texto: 'Excluiu aluno', modulo: 'alunos', sensivel: true },
  'trocou-cor-do-app': { texto: 'Trocou a cor do app', modulo: 'configuracoes', sensivel: false },
  'cadastrou-funcionario': { texto: 'Cadastrou funcionário', modulo: 'equipe', sensivel: false },
  'editou-funcionario': { texto: 'Editou funcionário', modulo: 'equipe', sensivel: false },
  'alterou-custo-de-funcionario': {
    texto: 'Alterou custo de funcionário',
    modulo: 'equipe',
    sensivel: true,
  },
  'alterou-acesso-de-funcionario': {
    texto: 'Alterou acesso de funcionário',
    modulo: 'equipe',
    sensivel: true,
  },
  'excluiu-funcionario': { texto: 'Excluiu funcionário', modulo: 'equipe', sensivel: true },
  'enviou-comunicado': { texto: 'Enviou comunicado', modulo: 'alunos', sensivel: false },
  /** O 403 do guard (gancho aoNegarPermissao do T12); o módulo é o da permissão negada. */
  'tentativa-negada': { texto: 'Tentativa negada', modulo: 'permissoes', sensivel: true },
} as const satisfies Record<string, AcaoDaAuditoria>;

export type ChaveDaAcao = keyof typeof ACOES_DA_AUDITORIA;

export const ETIQUETA_SENSIVEL = 'Sensível';

const MODULOS = new Map(CATALOGO_DE_MODULOS.map((modulo) => [modulo.chave, modulo.nome]));

const acaoDoCatalogo = (chave: string): AcaoDaAuditoria | undefined =>
  (ACOES_DA_AUDITORIA as Record<string, AcaoDaAuditoria | undefined>)[chave];

/** Módulo do menu de uma permissão: as seções de Configurações contam como Configurações. */
export function moduloDaAuditoria(permissao: string): string {
  const modulo = permissao.slice(0, permissao.lastIndexOf(':'));
  return modulo.split('.')[0] ?? modulo;
}

/** Chave desconhecida (ação ou módulo removido do código) volta como está, sem quebrar a lista. */
export function textoDoModulo(chave: string): string {
  return MODULOS.get(chave) ?? chave;
}

export function textoDaAcao(chave: string): string {
  return acaoDoCatalogo(chave)?.texto ?? chave;
}

export interface AutorDaAtividade {
  /** Usuário da equipe; `null` para o sistema. */
  id: string | null;
  nome: string;
}

export interface NovaAtividade {
  quem: AutorDaAtividade;
  /** Nome do tipo de acesso no momento da ação, por exemplo "Gerente". */
  papel: string;
  acao: ChaveDaAcao;
  /** Padrão: o módulo da ação no catálogo. */
  modulo?: string;
  detalhe: string;
  /** Padrão: a sensibilidade da ação no catálogo; o caso de uso pode marcar uma ação comum. */
  sensivel?: boolean;
}

export type AtividadeResolvida = Required<NovaAtividade>;

export class AtividadeInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'AtividadeInvalidaError';
  }
}

/** Aplica os padrões do catálogo e recusa o que não existe nele. */
export function resolverAtividade(nova: NovaAtividade): AtividadeResolvida {
  const acao = acaoDoCatalogo(nova.acao);
  if (!acao) {
    throw new AtividadeInvalidaError(`Ação de auditoria desconhecida: ${nova.acao}.`);
  }
  const modulo = nova.modulo ?? acao.modulo;
  if (!MODULOS.has(modulo)) {
    throw new AtividadeInvalidaError(`Módulo de auditoria desconhecido: ${modulo}.`);
  }
  if (nova.detalhe.trim() === '') {
    throw new AtividadeInvalidaError('A atividade precisa de detalhe.');
  }
  return { ...nova, modulo, sensivel: nova.sensivel ?? acao.sensivel };
}

export const MESES_DE_RETENCAO = 12;

/**
 * Registros com `ocorridoEm` anterior a este instante saem; o que tem exatamente 12 meses fica.
 * 29 de fevereiro volta para 28, em vez de escorregar para 1º de março.
 */
export function limiteDaRetencao(agora: Date): Date {
  const limite = new Date(agora);
  const dia = limite.getUTCDate();
  limite.setUTCDate(1);
  limite.setUTCMonth(limite.getUTCMonth() - MESES_DE_RETENCAO);
  const ultimoDia = new Date(
    Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth() + 1, 0),
  ).getUTCDate();
  limite.setUTCDate(Math.min(dia, ultimoDia));
  return limite;
}

/** Posição de um registro na ordem da listagem; a `ordem` desempata o mesmo milissegundo. */
export interface PosicaoNaLista {
  sensivel: boolean;
  ocorridoEm: Date;
  ordem: bigint;
}

export class CursorInvalidoError extends Error {
  constructor() {
    super('Cursor inválido.');
    this.name = 'CursorInvalidoError';
  }
}

export function codificarCursor(posicao: PosicaoNaLista): string {
  return Buffer.from(
    JSON.stringify([posicao.sensivel, posicao.ocorridoEm.getTime(), posicao.ordem.toString()]),
  ).toString('base64url');
}

export function decodificarCursor(cursor: string): PosicaoNaLista {
  try {
    const [sensivel, instante, ordem] = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8'),
    ) as unknown[];
    if (
      typeof sensivel !== 'boolean' ||
      typeof instante !== 'number' ||
      !Number.isSafeInteger(instante) ||
      typeof ordem !== 'string' ||
      !/^\d+$/.test(ordem)
    ) {
      throw new CursorInvalidoError();
    }
    return { sensivel, ocorridoEm: new Date(instante), ordem: BigInt(ordem) };
  } catch {
    throw new CursorInvalidoError();
  }
}
