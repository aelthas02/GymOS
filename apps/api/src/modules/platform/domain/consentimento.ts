/**
 * Finalidades do tratamento (LGPD). `transacional` (cobrança, lembrete de vencimento, link de
 * pagamento, nota fiscal, avisos de reserva) tem base contratual e não depende de aceite; as demais
 * só valem com aceite, que o titular pode revogar.
 */
export const FINALIDADES = ['transacional', 'marketing', 'dados_de_saude', 'biometria'] as const;

export type Finalidade = (typeof FINALIDADES)[number];

export type DecisaoDeConsentimento = 'aceite' | 'revogacao';

export interface RegistroDeConsentimento {
  finalidade: Finalidade;
  decisao: DecisaoDeConsentimento;
  /** De onde veio a decisão: `painel`, `app-do-aluno`, `importacao`... */
  origem: string;
  registradoEm: Date;
}

export class ConsentimentoInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ConsentimentoInvalidoError';
  }
}

export function dependeDeAceite(finalidade: Finalidade): boolean {
  return finalidade !== 'transacional';
}

/** Elegibilidade pela decisão mais recente da finalidade (null: o titular nunca decidiu). */
export function elegivelPara(
  finalidade: Finalidade,
  ultimaDecisao: DecisaoDeConsentimento | null,
): boolean {
  return !dependeDeAceite(finalidade) || ultimaDecisao === 'aceite';
}

export function validarRegistro(registro: Omit<RegistroDeConsentimento, 'registradoEm'>): void {
  if (!(FINALIDADES as readonly string[]).includes(registro.finalidade)) {
    throw new ConsentimentoInvalidoError(`Finalidade desconhecida: ${registro.finalidade}.`);
  }
  if (!dependeDeAceite(registro.finalidade)) {
    throw new ConsentimentoInvalidoError(
      'A finalidade transacional tem base contratual: não se registra aceite nem revogação.',
    );
  }
  if (registro.origem.trim() === '') {
    throw new ConsentimentoInvalidoError('A decisão de consentimento precisa da origem.');
  }
}
