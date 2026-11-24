import { Directive } from '@angular/core';
import { aplicarGabarito, apenasDigitos } from './gabarito';
import { MascaraBase, provedorDeMascara, SEM_AUTOCORRECAO } from './mascara-base';

const GABARITO_CPF = '###.###.###-##';
const GABARITO_CNPJ = '##.###.###/####-##';

function formatarCpfDigitado(texto: string): string {
  return aplicarGabarito(apenasDigitos(texto).slice(0, 11), GABARITO_CPF);
}

/** CPF: exibe `123.456.789-09` e guarda `12345678909`. */
@Directive({
  selector: 'input[appCpf]',
  providers: [provedorDeMascara(() => MascaraCpf)],
})
export class MascaraCpf extends MascaraBase {
  protected readonly padrao = {
    inputmode: 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'next',
    ...SEM_AUTOCORRECAO,
  };

  protected formatar(texto: string): string {
    return formatarCpfDigitado(texto);
  }
  protected paraValor(exibido: string): string | null {
    return apenasDigitos(exibido) || null;
  }
  protected paraTexto(valor: string | null): string {
    return formatarCpfDigitado(valor ?? '');
  }
}

function caracteresDoCnpj(texto: string): string {
  return texto
    .replace(/[^\dA-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 14);
}

/** CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): exibe `12.345.678/0001-95`, guarda sem máscara. */
@Directive({
  selector: 'input[appCnpj]',
  providers: [provedorDeMascara(() => MascaraCnpj)],
})
export class MascaraCnpj extends MascaraBase {
  protected readonly padrao = {
    inputmode: 'text',
    autocomplete: 'off',
    enterkeyhint: 'next',
    ...SEM_AUTOCORRECAO,
  };

  protected formatar(texto: string): string {
    return aplicarGabarito(caracteresDoCnpj(texto), GABARITO_CNPJ);
  }
  protected paraValor(exibido: string): string | null {
    return caracteresDoCnpj(exibido) || null;
  }
  protected paraTexto(valor: string | null): string {
    return this.formatar(valor ?? '');
  }
}

const SO_NUMERICO = /^[\d.\-\s]*$/;
const SO_MASCARA_DE_CPF = /^[\d.-]*$/;

/**
 * "CPF ou e-mail" do login do aluno. Enquanto o texto for só dígitos, aplica a máscara de CPF; ao
 * aparecer uma letra, tira a máscara, mantém os caracteres e deixa o cursor onde estava. Sem
 * `inputmode="numeric"`, porque o teclado precisa de letras.
 */
@Directive({
  selector: 'input[appCpfOuEmail]',
  providers: [provedorDeMascara(() => MascaraCpfOuEmail)],
})
export class MascaraCpfOuEmail extends MascaraBase {
  protected readonly padrao = {
    type: 'text',
    inputmode: 'text',
    autocomplete: 'username',
    enterkeyhint: 'next',
    ...SEM_AUTOCORRECAO,
  };

  protected formatar(texto: string, anterior: string): string {
    if (SO_NUMERICO.test(texto)) {
      return formatarCpfDigitado(texto);
    }
    return anterior && SO_MASCARA_DE_CPF.test(anterior) ? texto.replace(/[.-]/g, '') : texto;
  }
  protected paraValor(exibido: string): string | null {
    if (!exibido) {
      return null;
    }
    return SO_MASCARA_DE_CPF.test(exibido) ? apenasDigitos(exibido) : exibido;
  }
  protected paraTexto(valor: string | null): string {
    return this.formatar(valor ?? '', '');
  }
}
