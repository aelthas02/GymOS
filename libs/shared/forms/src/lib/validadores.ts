import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  validarCep,
  validarCnpj,
  validarCompetencia,
  validarCpf,
  validarData,
  validarEmail,
  validarIntervaloDeDatas,
  validarMaximo,
  validarMinimo,
  validarSenhaForte,
  validarTelefone,
  validarUrlYoutube,
  type TipoDeTelefone,
} from '@gymos/shared-validation';

/** Detalhe dos erros `minimo` e `maximo`; `exibicao` é o limite já formatado para a mensagem. */
export interface ErroDeLimite {
  limite: number;
  atual: unknown;
  exibicao: string;
}

// Como nos validadores do Angular, valor vazio é assunto do `Validators.required`.
function vazio(valor: unknown): boolean {
  return valor == null || valor === '';
}

function deTexto(chave: string, valido: (texto: string) => boolean): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor: unknown = controle.value;
    if (vazio(valor)) {
      return null;
    }
    return typeof valor === 'string' && valido(valor) ? null : { [chave]: true };
  };
}

function deLimite(
  chave: 'minimo' | 'maximo',
  limite: number,
  dentro: (valor: number, limite: number) => boolean,
  exibir: (valor: number) => string,
): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor: unknown = controle.value;
    if (vazio(valor) || (typeof valor === 'number' && dentro(valor, limite))) {
      return null;
    }
    const erro: ErroDeLimite = { limite, atual: valor, exibicao: exibir(limite) };
    return { [chave]: erro };
  };
}

/**
 * Os validadores de `@gymos/shared-validation` como `ValidatorFn`. A chave do erro é o nome do
 * validador, e `MENSAGENS_DE_ERRO` tem o texto de cada uma.
 */
export const Validadores = {
  cpf: deTexto('cpf', validarCpf),
  cnpj: deTexto('cnpj', validarCnpj),
  /** Com `tipo`, exige celular (WhatsApp) ou fixo. */
  telefone: (tipo?: TipoDeTelefone): ValidatorFn =>
    deTexto('telefone', (texto) => validarTelefone(texto, tipo)),
  email: deTexto('email', validarEmail),
  cep: deTexto('cep', validarCep),
  senhaForte: deTexto('senhaForte', validarSenhaForte),
  competencia: deTexto('competencia', validarCompetencia),
  urlYoutube: deTexto('urlYoutube', validarUrlYoutube),
  data: ((controle: AbstractControl): ValidationErrors | null => {
    const valor: unknown = controle.value;
    if (
      vazio(valor) ||
      ((typeof valor === 'string' || valor instanceof Date) && validarData(valor))
    ) {
      return null;
    }
    return { data: true };
  }) satisfies ValidatorFn,
  /**
   * Limite inclusivo. Para dinheiro, o limite é em centavos e `exibir` o formata:
   * `Validadores.minimo(1000, (valor) => formatarBrl(centavos(valor)))`.
   */
  minimo: (limite: number, exibir: (valor: number) => string = String): ValidatorFn =>
    deLimite('minimo', limite, validarMinimo, exibir),
  maximo: (limite: number, exibir: (valor: number) => string = String): ValidatorFn =>
    deLimite('maximo', limite, validarMaximo, exibir),
  /** Validador do grupo: o campo `fim` não pode vir antes do `inicio`. */
  intervaloDeDatas:
    (inicio: string, fim: string, opcoes: { permitirIgual?: boolean } = {}): ValidatorFn =>
    (grupo: AbstractControl): ValidationErrors | null => {
      const de: unknown = grupo.get(inicio)?.value;
      const ate: unknown = grupo.get(fim)?.value;
      if (vazio(de) || vazio(ate)) {
        return null;
      }
      const datas = [de, ate].every((data) => typeof data === 'string' || data instanceof Date);
      return datas && validarIntervaloDeDatas(de as string | Date, ate as string | Date, opcoes)
        ? null
        : { intervaloDeDatas: true };
    },
} as const;
