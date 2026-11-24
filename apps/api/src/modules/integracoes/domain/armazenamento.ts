// Armazenamento (T13d): chaves por tenant e validação de tipo e tamanho dos uploads.

export const MB = 1024 * 1024;

interface RegraDeTipo {
  extensoes: readonly string[];
  limiteEmBytes: number;
  /** Confere os primeiros bytes: o tipo declarado pelo cliente não basta. */
  assinatura: (inicio: Buffer) => boolean;
}

const comeca = (inicio: Buffer, bytes: readonly number[], deslocamento = 0): boolean =>
  bytes.every((byte, indice) => inicio[deslocamento + indice] === byte);

export const TIPOS_PERMITIDOS: Readonly<Record<string, RegraDeTipo>> = {
  'image/jpeg': {
    extensoes: ['jpg', 'jpeg'],
    limiteEmBytes: 5 * MB,
    assinatura: (b) => comeca(b, [0xff, 0xd8, 0xff]),
  },
  'image/png': {
    extensoes: ['png'],
    limiteEmBytes: 5 * MB,
    assinatura: (b) => comeca(b, [0x89, 0x50, 0x4e, 0x47]),
  },
  'image/webp': {
    extensoes: ['webp'],
    limiteEmBytes: 5 * MB,
    assinatura: (b) =>
      comeca(b, [0x52, 0x49, 0x46, 0x46]) && comeca(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
  'application/pdf': {
    extensoes: ['pdf'],
    limiteEmBytes: 10 * MB,
    assinatura: (b) => comeca(b, [0x25, 0x50, 0x44, 0x46]),
  },
  'video/mp4': {
    extensoes: ['mp4'],
    limiteEmBytes: 50 * MB,
    assinatura: (b) => comeca(b, [0x66, 0x74, 0x79, 0x70], 4),
  },
};

export const LIMITE_MAXIMO_DO_UPLOAD = Math.max(
  ...Object.values(TIPOS_PERMITIDOS).map((regra) => regra.limiteEmBytes),
);

export type MotivoDoArquivoRecusado =
  | 'tipo_nao_permitido'
  | 'extensao_diferente_do_tipo'
  | 'conteudo_diferente_do_tipo'
  | 'arquivo_vazio'
  | 'arquivo_grande_demais';

export class ArquivoRecusadoError extends Error {
  constructor(
    readonly motivo: MotivoDoArquivoRecusado,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ArquivoRecusadoError';
  }
}

export class ChaveDeOutroTenantError extends Error {
  constructor() {
    super('O arquivo não pertence a esta academia.');
    this.name = 'ChaveDeOutroTenantError';
  }
}

export interface ArquivoParaValidar {
  nome: string;
  tipo: string;
  conteudo: Buffer;
}

/** Valida o tipo (lista fechada), a extensão, os primeiros bytes e o tamanho; devolve a extensão. */
export function validarArquivo(arquivo: ArquivoParaValidar): string {
  const regra = TIPOS_PERMITIDOS[arquivo.tipo.toLowerCase()];
  if (!regra) {
    throw new ArquivoRecusadoError('tipo_nao_permitido', 'Tipo de arquivo não permitido.');
  }
  const extensao = arquivo.nome.split('.').pop()?.toLowerCase() ?? '';
  if (!regra.extensoes.includes(extensao)) {
    throw new ArquivoRecusadoError(
      'extensao_diferente_do_tipo',
      'A extensão do arquivo não corresponde ao tipo.',
    );
  }
  if (arquivo.conteudo.length === 0) {
    throw new ArquivoRecusadoError('arquivo_vazio', 'O arquivo está vazio.');
  }
  if (arquivo.conteudo.length > regra.limiteEmBytes) {
    throw new ArquivoRecusadoError(
      'arquivo_grande_demais',
      `O arquivo passa do limite de ${Math.floor(regra.limiteEmBytes / MB)} MB para este tipo.`,
    );
  }
  if (!regra.assinatura(arquivo.conteudo.subarray(0, 16))) {
    throw new ArquivoRecusadoError(
      'conteudo_diferente_do_tipo',
      'O conteúdo do arquivo não corresponde ao tipo.',
    );
  }
  return regra.extensoes[0] as string;
}

const PASTA = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

export function ehPastaValida(pasta: string): boolean {
  return PASTA.test(pasta) && pasta.length <= 80;
}

export const prefixoDoTenant = (tenantId: string): string => `tenant/${tenantId}/`;

/** `tenant/<id>/<pasta>/<objetoId>.<extensao>`: o nome do cliente nunca entra na chave. */
export function chaveDoObjeto(
  tenantId: string,
  pasta: string,
  objetoId: string,
  extensao: string,
): string {
  return `${prefixoDoTenant(tenantId)}${pasta}/${objetoId}.${extensao}`;
}

/** Recusa chave de outro tenant ou com tentativa de sair da pasta (`..`, barras duplas). */
export function conferirChaveDoTenant(tenantId: string, chave: string): void {
  const segmentos = chave.split('/');
  if (
    !chave.startsWith(prefixoDoTenant(tenantId)) ||
    segmentos.some((segmento) => segmento === '' || segmento === '.' || segmento === '..')
  ) {
    throw new ChaveDeOutroTenantError();
  }
}
