import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// Regras puras de dispositivos e do agente da catraca (T23b): estado pelo batimento, código de
// pareamento, credencial do agente e o texto dos alertas.

export const TIPOS_DE_DISPOSITIVO = ['catraca', 'leitor'] as const;
export type TipoDeDispositivo = (typeof TIPOS_DE_DISPOSITIVO)[number];

export const METODOS_DO_DISPOSITIVO = ['facial', 'biometria', 'qr_code'] as const;
export type MetodoDoDispositivo = (typeof METODOS_DO_DISPOSITIVO)[number];

export const TIPOS_DE_BIOMETRIA = ['facial', 'biometria'] as const;
export type TipoDeBiometria = (typeof TIPOS_DE_BIOMETRIA)[number];

/** Sem sinal do agente por tanto tempo, o dispositivo fica offline. */
export const SEGUNDOS_PARA_OFFLINE = 90;
export const VALIDADE_DO_CODIGO_MS = 30 * 60 * 1000;
/** O agente tem este tempo para responder a um comando (Testar conexão). */
export const VALIDADE_DO_COMANDO_MS = 60 * 1000;

export type TipoDeComando = 'ping' | 'cadastrar_biometria' | 'remover_biometria';
export type StatusDoComando = 'pendente' | 'entregue' | 'concluido' | 'falhou' | 'expirado';

export const estaOnline = (ultimoBatimentoEm: Date | null, agora: Date): boolean =>
  ultimoBatimentoEm !== null &&
  agora.getTime() - ultimoBatimentoEm.getTime() <= SEGUNDOS_PARA_OFFLINE * 1000;

// ---------- Código de pareamento ----------

// Sem 0, O, 1, I e L: o código é digitado a partir da tela.
const ALFABETO_DO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TAMANHO_DO_CODIGO = 6;

export function gerarCodigoDePareamento(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) {
    codigo += ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)];
  }
  return codigo;
}

/** Aceita minúsculas, espaços e hífen (`4f7-92k`); devolve `null` se não tem o formato. */
export function normalizarCodigo(texto: string): string | null {
  const codigo = texto.replace(/[\s-]/g, '').toUpperCase();
  return codigo.length === TAMANHO_DO_CODIGO &&
    [...codigo].every((c) => ALFABETO_DO_CODIGO.includes(c))
    ? codigo
    : null;
}

/** `4F792K` → `4F7-92K`, como o Passo 4 mostra. */
export const codigoFormatado = (codigo: string): string =>
  `${codigo.slice(0, 3)}-${codigo.slice(3)}`;

// ---------- Credencial do agente ----------

const PREFIXO_DA_CREDENCIAL = 'ga1';

const hashDoSegredo = (segredo: string): string =>
  createHash('sha256').update(segredo).digest('hex');

/** `ga1.<agenteId>.<segredo>`: o id acha o agente e só o hash do segredo é guardado. */
export function gerarCredencial(agenteId: string): { credencial: string; hash: string } {
  const segredo = randomBytes(32).toString('base64url');
  return {
    credencial: `${PREFIXO_DA_CREDENCIAL}.${agenteId}.${segredo}`,
    hash: hashDoSegredo(segredo),
  };
}

export function lerCredencial(texto: string): { agenteId: string; segredo: string } | null {
  const [prefixo, agenteId, segredo, resto] = texto.split('.');
  if (prefixo !== PREFIXO_DA_CREDENCIAL || !agenteId || !segredo || resto !== undefined) {
    return null;
  }
  return { agenteId, segredo };
}

export function segredoConfere(segredo: string, hashGuardado: string): boolean {
  const calculado = Buffer.from(hashDoSegredo(segredo), 'hex');
  const guardado = Buffer.from(hashGuardado, 'hex');
  return calculado.length === guardado.length && timingSafeEqual(calculado, guardado);
}

// ---------- Alertas ----------

export function duracaoPorExtenso(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 1) {
    return 'menos de 1 minuto';
  }
  if (minutos < 60) {
    return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const h = horas === 1 ? '1 hora' : `${horas} horas`;
  return resto === 0 ? h : `${h} e ${resto === 1 ? '1 minuto' : `${resto} minutos`}`;
}

const horaEmSaoPaulo = (instante: Date): string =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante);

/**
 * "Catraca 2 ficou 4 minutos sem resposta às 07:12 e já voltou"; enquanto a queda está aberta,
 * "Catraca 2 está sem resposta desde 07:12". A hora é a do último sinal, em São Paulo.
 */
export function textoDoAlertaDeQueda(nome: string, desde: Date, voltouEm: Date | null): string {
  if (voltouEm === null) {
    return `${nome} está sem resposta desde ${horaEmSaoPaulo(desde)}`;
  }
  const segundos = Math.max(0, Math.round((voltouEm.getTime() - desde.getTime()) / 1000));
  return `${nome} ficou ${duracaoPorExtenso(segundos)} sem resposta às ${horaEmSaoPaulo(desde)} e já voltou`;
}
