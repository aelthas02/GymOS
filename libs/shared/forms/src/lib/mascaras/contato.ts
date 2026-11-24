import { Directive, input } from '@angular/core';
import { aplicarGabarito, apenasDigitos } from './gabarito';
import { MascaraBase, provedorDeMascara, SEM_AUTOCORRECAO } from './mascara-base';

function formatarTelefoneDigitado(texto: string): string {
  let digitos = apenasDigitos(texto);
  if (digitos.length > 11 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);
  if (digitos.length <= 2) {
    return digitos ? `(${digitos}` : '';
  }
  const corte = digitos.length > 10 ? 7 : 6;
  const ddd = digitos.slice(0, 2);
  const inicio = digitos.slice(2, corte);
  const fim = digitos.slice(corte);
  return fim ? `(${ddd}) ${inicio}-${fim}` : `(${ddd}) ${inicio}`;
}

/** Telefone: exibe `(11) 99999-0000` e guarda `11999990000`; ao colar, tira o `+55`. */
@Directive({
  selector: 'input[appTelefone]',
  providers: [provedorDeMascara(() => MascaraTelefone)],
})
export class MascaraTelefone extends MascaraBase {
  protected readonly padrao = {
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel-national',
    enterkeyhint: 'next',
  };

  protected formatar(texto: string): string {
    return formatarTelefoneDigitado(texto);
  }
  protected paraValor(exibido: string): string | null {
    return apenasDigitos(exibido) || null;
  }
  protected paraTexto(valor: string | null): string {
    return formatarTelefoneDigitado(valor ?? '');
  }
}

function formatarCepDigitado(texto: string): string {
  return aplicarGabarito(apenasDigitos(texto).slice(0, 8), '#####-###');
}

/** CEP: exibe `01310-100` e guarda `01310100`. */
@Directive({
  selector: 'input[appCep]',
  providers: [provedorDeMascara(() => MascaraCep)],
})
export class MascaraCep extends MascaraBase {
  protected readonly padrao = {
    inputmode: 'numeric',
    autocomplete: 'postal-code',
    enterkeyhint: 'next',
  };

  protected formatar(texto: string): string {
    return formatarCepDigitado(texto);
  }
  protected paraValor(exibido: string): string | null {
    return apenasDigitos(exibido) || null;
  }
  protected paraTexto(valor: string | null): string {
    return formatarCepDigitado(valor ?? '');
  }
}

/** Sem máscara: o texto vale como está. Base dos campos que só definem atributos de teclado. */
abstract class CampoDeTexto extends MascaraBase {
  protected formatar(texto: string): string {
    return texto;
  }
  protected paraValor(exibido: string): string | null {
    return exibido || null;
  }
  protected paraTexto(valor: string | null): string {
    return valor ?? '';
  }
}

/** E-mail: `type="email"`, `autocomplete="email"` e sem capitalização nem correção. */
@Directive({
  selector: 'input[appEmail]',
  providers: [provedorDeMascara(() => CampoDeEmail)],
})
export class CampoDeEmail extends CampoDeTexto {
  protected readonly padrao = {
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    enterkeyhint: 'next',
    ...SEM_AUTOCORRECAO,
  };
}

/** Senha: `appSenha` para a senha atual, `appSenha="nova"` para cadastro ou troca. */
@Directive({
  selector: 'input[appSenha]',
  providers: [provedorDeMascara(() => CampoDeSenha)],
})
export class CampoDeSenha extends CampoDeTexto {
  readonly appSenha = input<'' | 'atual' | 'nova'>('');

  protected get padrao() {
    return {
      type: 'password',
      autocomplete: this.appSenha() === 'nova' ? 'new-password' : 'current-password',
      enterkeyhint: 'go',
      ...SEM_AUTOCORRECAO,
    };
  }
}

/** Código de uso único (primeiro acesso, pareamento): `autocomplete="one-time-code"`. */
@Directive({
  selector: 'input[appCodigo]',
  providers: [provedorDeMascara(() => CampoDeCodigo)],
})
export class CampoDeCodigo extends CampoDeTexto {
  protected readonly padrao = {
    inputmode: 'text',
    autocomplete: 'one-time-code',
    enterkeyhint: 'go',
    ...SEM_AUTOCORRECAO,
  };
}
