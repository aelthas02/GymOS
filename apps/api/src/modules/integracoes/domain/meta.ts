// Conexões da academia com a Meta (T13d): canais, estados e a transição de cada um.

export const CANAIS_META = ['instagram', 'facebook', 'whatsapp'] as const;
export type CanalMeta = (typeof CANAIS_META)[number];

export const ESTADOS_DA_CONEXAO = [
  'conectado',
  'verificacao_pendente',
  'desconectado',
  'expirado',
] as const;
export type EstadoDaConexao = (typeof ESTADOS_DA_CONEXAO)[number];

export const NOMES_DOS_CANAIS: Readonly<Record<CanalMeta, string>> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
};

export interface ConexaoMeta {
  canal: CanalMeta;
  estado: EstadoDaConexao;
  contaId: string | null;
  contaNome: string | null;
  expiraEm: Date | null;
  conectadoEm: Date | null;
}

/** Renova o token quando faltam até 7 dias para vencer. */
export const ANTECEDENCIA_DA_RENOVACAO_MS = 7 * 24 * 60 * 60 * 1000;

export function ehCanalMeta(valor: string): valor is CanalMeta {
  return (CANAIS_META as readonly string[]).includes(valor);
}

export class ConexaoInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ConexaoInvalidaError';
  }
}

/** Estado "desconectado" de um canal que nunca foi conectado. */
export function conexaoVazia(canal: CanalMeta): ConexaoMeta {
  return {
    canal,
    estado: 'desconectado',
    contaId: null,
    contaNome: null,
    expiraEm: null,
    conectadoEm: null,
  };
}
