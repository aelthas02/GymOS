import { Directive } from '@angular/core';
import { aplicarGabarito, apenasDigitos } from './gabarito';
import { MascaraBase, provedorDeMascara } from './mascara-base';

/** Máscara de dígitos com gabarito fixo; o valor guardado é o próprio texto exibido. */
abstract class MascaraDeGabarito extends MascaraBase {
  protected abstract readonly gabarito: string;
  protected abstract readonly limite: number;
  protected readonly padrao = { inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'next' };

  protected formatar(texto: string): string {
    return aplicarGabarito(apenasDigitos(texto).slice(0, this.limite), this.gabarito);
  }
  protected paraValor(exibido: string): string | null {
    return exibido || null;
  }
  protected paraTexto(valor: string | null): string {
    return this.formatar(valor ?? '');
  }
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data `dd/MM/yyyy`; guarda o texto exibido, que os validadores de data já aceitam. */
@Directive({
  selector: 'input[appData]',
  providers: [provedorDeMascara(() => MascaraData)],
})
export class MascaraData extends MascaraDeGabarito {
  protected readonly gabarito = '##/##/####';
  protected readonly limite = 8;

  /** Do modelo, aceita também `yyyy-MM-dd`. */
  protected override paraTexto(valor: string | null): string {
    const iso = DATA_ISO.exec(valor ?? '');
    return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : super.paraTexto(valor);
  }
}

/** Competência `MM/yyyy`. */
@Directive({
  selector: 'input[appCompetencia]',
  providers: [provedorDeMascara(() => MascaraCompetencia)],
})
export class MascaraCompetencia extends MascaraDeGabarito {
  protected readonly gabarito = '##/####';
  protected readonly limite = 6;
}

/** Horário `HH:mm`. */
@Directive({
  selector: 'input[appHorario]',
  providers: [provedorDeMascara(() => MascaraHorario)],
})
export class MascaraHorario extends MascaraDeGabarito {
  protected readonly gabarito = '##:##';
  protected readonly limite = 4;
}
