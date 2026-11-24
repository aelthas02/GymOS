import { Directive, input } from '@angular/core';
import {
  centavos,
  formatarBrl,
  formatarPercentual,
  interpretarBrl,
  pontosBase,
  type Centavos,
  type PontosBase,
} from '@gymos/shared-money';
import { apenasDigitos } from './gabarito';
import { MascaraBase, provedorDeMascara } from './mascara-base';

/** Reais em centavos: digitar `11900` exibe `R$ 119,00` e guarda `11900`; vazio guarda `null`. */
@Directive({
  selector: 'input[appBrl]',
  providers: [provedorDeMascara(() => MascaraBrl)],
  host: { '(paste)': 'aoColar($event)' },
})
export class MascaraBrl extends MascaraBase<Centavos> {
  protected readonly padrao = { inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'next' };
  protected override readonly cursorNoFim = true;

  protected formatar(texto: string): string {
    const digitos = apenasDigitos(texto)
      .replace(/^0+(?=\d)/, '')
      .slice(0, 15);
    return digitos ? formatarBrl(centavos(Number(digitos))) : '';
  }
  protected paraValor(exibido: string): Centavos | null {
    const digitos = apenasDigitos(exibido);
    return digitos ? centavos(Number(digitos)) : null;
  }
  protected paraTexto(valor: Centavos | null): string {
    return valor === null ? '' : formatarBrl(valor);
  }

  /** `R$ 1.234,56` vira 123456 e `119` vira 11900 (reais inteiros); texto sem valor não muda nada. */
  protected aoColar(evento: ClipboardEvent): void {
    evento.preventDefault();
    const valor = interpretarBrl(evento.clipboardData?.getData('text') ?? '');
    if (valor !== null) {
      this.definir(valor);
    }
  }
}

/** Mantém dígitos e uma vírgula (o ponto também vale), com até `casas` decimais. */
function decimalDigitado(texto: string, casas: number): string {
  const limpo = texto.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [inteiro = '', ...resto] = limpo.split(',');
  return resto.length === 0 ? inteiro : `${inteiro},${resto.join('').slice(0, casas)}`;
}

/** Percentual: digitar `2,5` guarda `250` (pontos-base); ao sair, exibe `2,5%`. */
@Directive({
  selector: 'input[appPercent]',
  providers: [provedorDeMascara(() => MascaraPercentual)],
})
export class MascaraPercentual extends MascaraBase<PontosBase> {
  protected readonly padrao = { inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next' };

  protected formatar(texto: string): string {
    return decimalDigitado(texto, 2);
  }
  protected paraValor(exibido: string): PontosBase | null {
    if (exibido === '' || exibido === ',') {
      return null;
    }
    const [inteiro = '', decimais = ''] = exibido.split(',');
    return pontosBase(Number(inteiro || '0') * 100 + Number(decimais.padEnd(2, '0')));
  }
  protected paraTexto(valor: PontosBase | null): string {
    if (valor === null) {
      return '';
    }
    const exibido = formatarPercentual(valor, 2);
    // Em edição, o texto não leva `%` nem separador de milhar.
    return this.emFoco ? exibido.replace(/[%.]/g, '') : exibido;
  }

  protected override aoEntrar(): void {
    super.aoEntrar();
    this.mostrar(this.paraTexto(this.valor));
  }
  protected override aoSair(): void {
    super.aoSair();
    this.mostrar(this.paraTexto(this.valor));
  }
}

/** Medida decimal (peso, altura, carga): `72,5` guarda o número `72.5`. */
@Directive({
  selector: 'input[appDecimal]',
  providers: [provedorDeMascara(() => MascaraDecimal)],
})
export class MascaraDecimal extends MascaraBase<number> {
  /** Casas decimais aceitas. */
  readonly appDecimalCasas = input(1);

  protected readonly padrao = { inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next' };

  protected formatar(texto: string): string {
    return decimalDigitado(texto, this.appDecimalCasas());
  }
  protected paraValor(exibido: string): number | null {
    return exibido === '' || exibido === ',' ? null : Number(exibido.replace(',', '.'));
  }
  protected paraTexto(valor: number | null): string {
    return valor === null ? '' : String(valor).replace('.', ',');
  }

  protected override aoSair(): void {
    super.aoSair();
    this.mostrar(this.paraTexto(this.valor));
  }
}
