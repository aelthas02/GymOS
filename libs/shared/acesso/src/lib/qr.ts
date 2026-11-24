import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

// QR de check-in do app (T23a). Token assinado com Ed25519 que o aluno mostra na Recepção ou na
// catraca: o servidor emite e confere; o agente local (T24a) confere a assinatura offline só com a
// chave pública e guarda os nonces usados até sincronizar.
//
//   gq1.<kid>.<payload em base64url>.<assinatura em base64url>
//
// - A assinatura cobre o texto exato `gymos-qr-v1\n` + `gq1.<kid>.<payload>` (separação de domínio);
//   o payload nunca é reserializado, então não há ambiguidade de JSON nem de canonicalização.
// - Não há campo de algoritmo no token: o algoritmo é sempre Ed25519 (sem confusão de algoritmo).
// - O payload só é lido depois de a assinatura valer.
// - Validade de 60 s a partir da emissão, com 5 s de tolerância para relógio adiantado do emissor.
// - Uso único: o `nonce` (128 bits) é consumido uma vez (servidor: tabela com unicidade; agente: lista
//   local). Replay entre academias é barrado pelo `tid` (tenant) dentro do payload assinado.

export const VALIDADE_DO_QR_SEGUNDOS = 60;
export const TOLERANCIA_DE_RELOGIO_SEGUNDOS = 5;

const PREFIXO_DO_TOKEN = 'gq1';
const DOMINIO_DA_ASSINATURA = 'gymos-qr-v1\n';
const TAMANHO_MAXIMO_DO_TOKEN = 700;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const NONCE = /^[A-Za-z0-9_-]{22}$/; // 16 bytes em base64url

/** O que o QR afirma (o payload assinado). */
export interface DadosDoQr {
  chaveId: string;
  tenantId: string;
  alunoId: string;
  nonce: string;
  /** Emissão, em segundos desde a época Unix. */
  emitidoEm: number;
}

export interface ParDeChavesDoQr {
  /** SPKI DER em base64: vai para o agente. */
  chavePublica: string;
  /** PKCS#8 DER em base64: fica só no servidor (cifrada em repouso). */
  chavePrivada: string;
}

export function gerarParDeChavesDoQr(): ParDeChavesDoQr {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    chavePublica: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    chavePrivada: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  };
}

const paraBase64Url = (dados: Buffer | string): string => Buffer.from(dados).toString('base64url');

/** Decodifica só a forma canônica: rejeita o que não volta idêntico ao ser recodificado. */
function deBase64UrlEstrito(texto: string): Buffer | null {
  if (!BASE64URL.test(texto)) {
    return null;
  }
  const bytes = Buffer.from(texto, 'base64url');
  return bytes.toString('base64url') === texto ? bytes : null;
}

export interface PedidoDeEmissaoDoQr {
  chavePrivada: string;
  chaveId: string;
  tenantId: string;
  alunoId: string;
  agora: Date;
}

export interface QrEmitido {
  token: string;
  nonce: string;
  emitidoEm: number;
  expiraEm: Date;
}

export function emitirQr(pedido: PedidoDeEmissaoDoQr): QrEmitido {
  const emitidoEm = Math.floor(pedido.agora.getTime() / 1000);
  const nonce = paraBase64Url(randomBytes(16));
  const payload = paraBase64Url(
    JSON.stringify({ v: 1, tid: pedido.tenantId, aid: pedido.alunoId, nonce, iat: emitidoEm }),
  );
  const corpo = `${PREFIXO_DO_TOKEN}.${pedido.chaveId}.${payload}`;
  const chave = createPrivateKey({
    key: Buffer.from(pedido.chavePrivada, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const assinatura = sign(null, Buffer.from(DOMINIO_DA_ASSINATURA + corpo), chave);
  return {
    token: `${corpo}.${paraBase64Url(assinatura)}`,
    nonce,
    emitidoEm,
    expiraEm: new Date((emitidoEm + VALIDADE_DO_QR_SEGUNDOS) * 1000),
  };
}

export type MotivoDeQrRecusado =
  'formato' | 'chave_desconhecida' | 'assinatura' | 'tenant' | 'expirado' | 'emitido_no_futuro';

export type ResultadoDoQr = { ok: true; qr: DadosDoQr } | { ok: false; motivo: MotivoDeQrRecusado };

export interface ConferenciaDoQr {
  /** `kid` → chave pública (SPKI DER em base64). Mais de uma por causa da rotação. */
  chavesPublicas: Readonly<Record<string, string>>;
  /** Academia que está conferindo: o QR de outra academia é recusado. */
  tenantId: string;
  agora: Date;
}

const recusado = (motivo: MotivoDeQrRecusado): ResultadoDoQr => ({ ok: false, motivo });

/**
 * Confere forma, chave, assinatura, academia e validade. Não consome o nonce: o uso único é de quem
 * chama (`validarQrOffline` ou a tabela de nonces do servidor), só depois de este passo aceitar.
 */
export function verificarQr(token: string, conferencia: ConferenciaDoQr): ResultadoDoQr {
  if (typeof token !== 'string' || token.length > TAMANHO_MAXIMO_DO_TOKEN) {
    return recusado('formato');
  }
  const partes = token.split('.');
  if (partes.length !== 4 || partes[0] !== PREFIXO_DO_TOKEN) {
    return recusado('formato');
  }
  const [, chaveId = '', payloadTexto = '', assinaturaTexto = ''] = partes;
  const assinatura = deBase64UrlEstrito(assinaturaTexto);
  if (
    !UUID.test(chaveId) ||
    deBase64UrlEstrito(payloadTexto) === null ||
    assinatura?.length !== 64
  ) {
    return recusado('formato');
  }
  const chavePublica = Object.hasOwn(conferencia.chavesPublicas, chaveId)
    ? conferencia.chavesPublicas[chaveId]
    : undefined;
  if (!chavePublica) {
    return recusado('chave_desconhecida');
  }
  const corpo = `${DOMINIO_DA_ASSINATURA}${PREFIXO_DO_TOKEN}.${chaveId}.${payloadTexto}`;
  if (!assinaturaConfere(corpo, assinatura, chavePublica)) {
    return recusado('assinatura');
  }
  const dados = lerPayload(payloadTexto, chaveId);
  if (!dados) {
    return recusado('formato');
  }
  if (dados.tenantId !== conferencia.tenantId) {
    return recusado('tenant');
  }
  const decorrido = conferencia.agora.getTime() / 1000 - dados.emitidoEm;
  if (decorrido < -TOLERANCIA_DE_RELOGIO_SEGUNDOS) {
    return recusado('emitido_no_futuro');
  }
  if (decorrido > VALIDADE_DO_QR_SEGUNDOS) {
    return recusado('expirado');
  }
  return { ok: true, qr: dados };
}

function assinaturaConfere(corpo: string, assinatura: Buffer, chavePublica: string): boolean {
  try {
    const chave = createPublicKey({
      key: Buffer.from(chavePublica, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return (
      chave.asymmetricKeyType === 'ed25519' && verify(null, Buffer.from(corpo), chave, assinatura)
    );
  } catch {
    return false;
  }
}

function lerPayload(payloadTexto: string, chaveId: string): DadosDoQr | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(Buffer.from(payloadTexto, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return null;
  }
  const { v, tid, aid, nonce, iat } = bruto as Record<string, unknown>;
  if (
    v !== 1 ||
    typeof tid !== 'string' ||
    !UUID.test(tid) ||
    typeof aid !== 'string' ||
    !UUID.test(aid) ||
    typeof nonce !== 'string' ||
    !NONCE.test(nonce) ||
    typeof iat !== 'number' ||
    !Number.isSafeInteger(iat)
  ) {
    return null;
  }
  return { chaveId, tenantId: tid, alunoId: aid, nonce, emitidoEm: iat };
}

/** Nonces já usados; o agente persiste a lista até sincronizar com a API. */
export interface RegistroDeNonces {
  jaUsado(nonce: string): boolean;
  marcar(nonce: string, usadoEm: Date): void;
}

/** Implementação em memória; o agente a hidrata do disco ao subir. Esquece o que já expirou. */
export class NoncesEmMemoria implements RegistroDeNonces {
  private readonly usados = new Map<string, number>();

  constructor(inicial: Iterable<readonly [string, Date]> = []) {
    for (const [nonce, quando] of inicial) {
      this.usados.set(nonce, quando.getTime());
    }
  }

  jaUsado(nonce: string): boolean {
    return this.usados.has(nonce);
  }

  marcar(nonce: string, usadoEm: Date): void {
    this.usados.set(nonce, usadoEm.getTime());
  }

  /** Nonces usados e ainda não sincronizados (para o agente enviar à API). */
  todos(): [string, Date][] {
    return [...this.usados].map(([nonce, ms]) => [nonce, new Date(ms)]);
  }

  /** Descarta os que passaram da validade (um nonce vencido já é recusado pela validade). */
  esquecerAntesDe(limite: Date): void {
    const margem = (VALIDADE_DO_QR_SEGUNDOS + TOLERANCIA_DE_RELOGIO_SEGUNDOS) * 1000;
    for (const [nonce, ms] of this.usados) {
      if (ms < limite.getTime() - margem) {
        this.usados.delete(nonce);
      }
    }
  }
}

export type ResultadoDoQrOffline =
  { ok: true; qr: DadosDoQr } | { ok: false; motivo: MotivoDeQrRecusado | 'ja_usado' };

/**
 * Validação completa offline (agente da catraca): confere o token e consome o nonce. O nonce só é
 * marcado depois de assinatura, academia e validade passarem, e é marcado antes de devolver `ok`.
 */
export function validarQrOffline(
  token: string,
  conferencia: ConferenciaDoQr & { nonces: RegistroDeNonces },
): ResultadoDoQrOffline {
  const resultado = verificarQr(token, conferencia);
  if (!resultado.ok) {
    return resultado;
  }
  if (conferencia.nonces.jaUsado(resultado.qr.nonce)) {
    return { ok: false, motivo: 'ja_usado' };
  }
  conferencia.nonces.marcar(resultado.qr.nonce, conferencia.agora);
  return resultado;
}

/** Motivo de negação de acesso para cada recusa do QR. */
export function motivoDeNegacaoDoQr(
  motivo: MotivoDeQrRecusado | 'ja_usado',
): 'qr_ja_usado' | 'qr_expirado' | 'qr_invalido' {
  if (motivo === 'ja_usado') {
    return 'qr_ja_usado';
  }
  return motivo === 'expirado' ? 'qr_expirado' : 'qr_invalido';
}
